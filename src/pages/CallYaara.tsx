/**
 * CallYaara.tsx  –  Talk with Yaara screen
 *
 * Strict 3-state UI:
 *   LISTENING  → blue waveform
 *   PROCESSING → purple spinner
 *   SPEAKING   → orange pulse
 *
 * Mirrors the exact state emitted by use-free-conversation.ts.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useFreeConversation, ConversationMode } from "@/hooks/use-free-conversation";
import { useNavigate } from "react-router-dom";
import { Mic, MicOff, PhoneOff, Phone, AudioLines } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { YAARA_AGENT_PROMPT } from "@/lib/yaara-agent";
import { callStorage } from "@/lib/call-storage";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEFAULT_FEMALE_VOICE_ID,
  DEFAULT_MALE_VOICE_ID,
  findVoiceOption,
} from "@/lib/voice-options";

// ─── Transcript types ─────────────────────────────────────────────────────────
type TranscriptRole = "user" | "yaara";
type TranscriptStatus = "live" | "final";

interface TranscriptEntry {
  id: string;
  role: TranscriptRole;
  text: string;
  status: TranscriptStatus;
  timestamp: Date;
}

type LameJsModule = {
  Mp3Encoder: new (channels: number, sampleRate: number, kbps: number) => {
    encodeBuffer: (samples: Int16Array) => ArrayLike<number>;
    flush: () => ArrayLike<number>;
  };
};

type DebugWindow = Window & typeof globalThis & {
  lamejs?: LameJsModule;
  YARA_DEBUG_LOG?: string[];
};

// ─── End-of-call keywords ─────────────────────────────────────────────────────
const END_KEYWORDS = [
  "bye", "goodbye", "bye bye", "alvida", "alvidha",
  "end call", "call end", "khatam", "band karo", "ruk jao", "finish",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const hasEndKeyword = (text: string) => {
  const lower = text.toLowerCase();
  return END_KEYWORDS.some(k => lower.includes(k));
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const getFirstName = (name?: string | null) => name?.trim().split(/\s+/)[0] || "Dost";
const getProfileVoicePreference = (gender?: string | null): "female" | "male" => {
  const normalizedGender = gender?.trim().toLowerCase();
  return normalizedGender === "male" ? "male" : "female";
};

const getSessionVoiceId = (
  selectedVoice: "female" | "male",
  user: ReturnType<typeof useAuth>["user"],
) => selectedVoice === "female"
  ? user?.yaaraFemaleVoiceId || DEFAULT_FEMALE_VOICE_ID
  : user?.yaarMaleVoiceId || DEFAULT_MALE_VOICE_ID;

// ─── Component ────────────────────────────────────────────────────────────────
const CallYaara = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const profileVoicePreference = useMemo(() => getProfileVoicePreference(user?.gender), [user?.gender]);

  // ── call lifecycle ────────────────────────────────────────────────────────
  const [callActive, setCallActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isEndingCall, setIsEndingCall] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const callStartTimeRef = useRef<Date | null>(null);

  // ─── voice state (synced from hook) ────────────────────────────────────────
  const [voiceMode, setVoiceMode] = useState<ConversationMode>("listening");
  const [voiceGender, setVoiceGender] = useState<"female" | "male">(profileVoicePreference);
  const [sessionVoiceGender, setSessionVoiceGender] = useState<"female" | "male">(profileVoicePreference);
  const [sessionVoiceId, setSessionVoiceId] = useState<string>(getSessionVoiceId(profileVoicePreference, user));

  // ── audio mixing & recording ─────────────────────────────────────────────
  const audioContextRef = useRef<AudioContext | null>(null);
  const mixedDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const aiAudioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const isConvertingRef = useRef(false);

  // ── transcript ────────────────────────────────────────────────────────────
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // ── silence prompts ───────────────────────────────────────────────────────
  const silenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSpeechAtRef = useRef<number | null>(null);
  const hasUserSpokenRef = useRef(false);
  const silenceStageRef = useRef(0);
  const silenceInflightRef = useRef(false);

  // ── misc ─────────────────────────────────────────────────────────────────
  const pendingEndRef = useRef(false);
  const pendingEndAfterSpeechRef = useRef(false);
  const endCallFnRef = useRef<() => Promise<void>>(async () => { });
  const audioDataUrlRef = useRef<string | null>(null);

  // FIXED: Voice switching only allowed when call is NOT active
  const chooseVoice = useCallback((nextVoice: "female" | "male") => {
    if (callActive || connecting) {
      // Don't allow mid-call voice switch — this was causing voice inconsistency
      return;
    }
    setVoiceGender(nextVoice);
  }, [callActive, connecting]);

  // ─── Transcript helpers ───────────────────────────────────────────────────
  const upsert = useCallback((role: TranscriptRole, text: string, status: TranscriptStatus) => {
    setTranscripts(prev => {
      const next = [...prev];
      const lastIndex = next.length - 1;
      const last = next[lastIndex];

      // Merge interim into same bubble - IMMUTABLE UPDATE
      if (status === "live" && last && last.role === role && last.status === "live") {
        next[lastIndex] = { ...last, text, timestamp: new Date() };
        return next;
      }
      
      // Finalize live bubble - IMMUTABLE UPDATE
      if (status === "final" && last && last.role === role && last.status === "live") {
        next[lastIndex] = { ...last, text, status: "final", timestamp: new Date() };
        return next;
      }

      next.push({ id: uid(), role, text, status, timestamp: new Date() });
      return next;
    });
  }, []);

  const userFirstName = useMemo(() => getFirstName(user?.name), [user?.name]);
  const personalizedAgentPrompt = useMemo(
    () => `${YAARA_AGENT_PROMPT}

USER PROFILE
- User name: ${user?.name || userFirstName}

ADDRESSING RULES
- Naturally address the user as ${userFirstName} during the greeting and sometimes while comforting or guiding them.
- Do not repeat the name in every reply.
- Keep the tone human, warm, and phone-call natural.`,
    [user?.name, userFirstName],
  );

  useEffect(() => {
    if (!callActive && !connecting) {
      setVoiceGender(profileVoicePreference);
      setSessionVoiceGender(profileVoicePreference);
      setSessionVoiceId(getSessionVoiceId(profileVoicePreference, user));
    }
  }, [callActive, connecting, profileVoicePreference, user]);

  // ─── Hook ─────────────────────────────────────────────────────────────────
  // FIXED: Using reactive state (voiceGender, sessionVoiceId) instead of stale refs
  // This ensures the hook always reads fresh voice params via optionsRef.current
  const conversation = useFreeConversation({
    overrides: { 
      agent: { 
        prompt: { prompt: personalizedAgentPrompt },
        voicePreference: sessionVoiceGender,
        voiceId: sessionVoiceId,
      } 
    },

    onConnect: () => {
      console.log("[UI] onConnect");
      setCallActive(true);
      setConnecting(false);
    },

    onDisconnect: () => {
      console.log("[UI] onDisconnect");
      setCallActive(false);
      setConnecting(false);
      setVoiceMode("listening");
    },

    onModeChange: ({ mode }) => {
      console.log("[UI] mode →", mode);
      setVoiceMode(mode);
      if (mode === "listening") {
        // Reset silence tracking each time we enter listening mode
        lastSpeechAtRef.current = null;
        silenceStageRef.current = 0;

        if (pendingEndAfterSpeechRef.current) {
          pendingEndAfterSpeechRef.current = false;
          void endCallFnRef.current?.();
        }
      }
    },

    onVadScore: (score) => {
      if (score > 0.4) {
        lastSpeechAtRef.current = Date.now();
        hasUserSpokenRef.current = true;
        silenceStageRef.current = 0;
        silenceInflightRef.current = false;
      }
    },

    onMessage: (msg) => {
      const type = msg.type;
      const isFinal = msg.is_final !== false;
      const isUser = type === "user_speech";
      const isAgent = type === "yaara_response";
      const text = (msg.text || "").trim();

      if (!text) return;

      if (isUser) {
        upsert("user", text, isFinal ? "final" : "live");
        if (isFinal && hasEndKeyword(text)) pendingEndRef.current = true;
        lastSpeechAtRef.current = Date.now();
        hasUserSpokenRef.current = true;
        silenceStageRef.current = 0;
      }

      if (isAgent) {
        upsert("yaara", text, isFinal ? "final" : "live");

        // Auto-end only after Yaara fully finishes speaking the farewell reply.
        if (isFinal && pendingEndRef.current) {
          pendingEndRef.current = false;
          pendingEndAfterSpeechRef.current = true;
        }
      }
    },

    onError: (err) => {
      console.error("[UI] onError:", err);
      const msg = err.message.toLowerCase();
      
      let title = "Connection Problem";
      let description = "Thodi problem hui, dobara try karein.";

      if (msg.includes("429") || msg.includes("limit reached")) {
        title = "Gemini Quota Exceeded";
        description = "The daily limit for Gemini API has been reached. Please check back later or add your own key.";
      } else if (msg.includes("network")) {
        title = "Internet Issue";
        description = "Aapka internet thoda slow lag raha hai. Wi-Fi check karein.";
      } else if (msg.includes("not-allowed") || msg.includes("permission")) {
        title = "Microphone Blocked";
        description = "Please allow microphone access in your browser settings to talk with Yaara.";
      } else if (msg.includes("no-audio")) {
        title = "No Audio Detected";
        description = "Aapki awaaz nahi sunai di. Kya mic sahi se kaam kar raha hai?";
      }

      toast({ variant: "destructive", title, description });
    },
  });

  // ─── Silence prompts ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!callActive) return;

    silenceTimerRef.current = setInterval(async () => {
      if (voiceMode !== "listening") return;
      if (isMicMuted) return;
      if (silenceInflightRef.current) return;

      const now = Date.now();
      const last = lastSpeechAtRef.current ?? now;
      const elapsed = now - last;

      // INCREASED SILENCE THRESHOLDS SIGNIFICANTLY - NO MORE AUTO SPEAKING
      if (!hasUserSpokenRef.current) {
        // Stages for initial silence
        if (elapsed > 25000 && silenceStageRef.current < 2) {
          silenceStageRef.current = 2;
          silenceInflightRef.current = true;
          await conversation.requestSilenceResponse("long-initial").catch(() => { });
          silenceInflightRef.current = false;
        } else if (elapsed > 15000 && silenceStageRef.current < 1) {
          silenceStageRef.current = 1;
          silenceInflightRef.current = true;
          await conversation.requestSilenceResponse("short-initial").catch(() => { });
          silenceInflightRef.current = false;
        }
      } else {
        // Mid-conversation silence - ONLY prompt after 25 SECONDS
        if (elapsed > 25000 && silenceStageRef.current < 1) {
          silenceStageRef.current = 1;
          silenceInflightRef.current = true;
          await conversation.requestSilenceResponse("mid-conversation").catch(() => { });
          silenceInflightRef.current = false;
        }
      }
    }, 1000);

    return () => {
      if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
    };
  }, [callActive, voiceMode, isMicMuted, conversation]);

  // ─── Scroll transcript to bottom ─────────────────────────────────────────
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  // ─── Start call ───────────────────────────────────────────────────────────
  const startCall = useCallback(async () => {
    if (connecting || callActive) return;
    setConnecting(true);
    setTranscripts([]);
    setIsMicMuted(false);
    hasUserSpokenRef.current = false;
    silenceStageRef.current = 0;
    pendingEndRef.current = false;
    pendingEndAfterSpeechRef.current = false;

    callStartTimeRef.current = new Date();
    audioDataUrlRef.current = null;
    audioChunksRef.current = [];
    const pinnedVoiceGender = voiceGender;
    const pinnedVoiceId = getSessionVoiceId(pinnedVoiceGender, user);
    flushSync(() => {
      setSessionVoiceGender(pinnedVoiceGender);
      setSessionVoiceId(pinnedVoiceId);
    });

    try {
      // ─── START MIXED RECORDING (Mic + AI) BEFORE SESSION SO THE FIRST GREETING IS CAPTURED ───
      try {
        if (!audioContextRef.current || audioContextRef.current.state === "closed") {
          const AudioContextCtor = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (!AudioContextCtor) {
            throw new Error("AudioContext is not supported on this device.");
          }
          audioContextRef.current = new AudioContextCtor();
        }
        
        const audioCtx = audioContextRef.current;
        if (audioCtx.state === "suspended") await audioCtx.resume();

        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const destination = audioCtx.createMediaStreamDestination();
        mixedDestinationRef.current = destination;

        const micSource = audioCtx.createMediaStreamSource(micStream);
        micSource.connect(destination);

        const rec = new MediaRecorder(destination.stream, { mimeType: "audio/webm" });
        rec.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        rec.start(1000);
        mediaRecorderRef.current = rec;

        const checkAndConnectAI = window.setInterval(() => {
          const agentAudio = conversation.agentAudioRef.current;
          const ctx = audioContextRef.current;
          const mixedDestination = mixedDestinationRef.current;
          
          if (!agentAudio || !ctx || !mixedDestination) return;

          try {
            // Already created? Just wire it to the NEW destination for this call.
            if (aiAudioSourceRef.current) {
              aiAudioSourceRef.current.connect(mixedDestination);
              // It's already connected to ctx.destination from the first run.
              window.clearInterval(checkAndConnectAI);
              console.log("[Audio] Re-routed existing AI source to new recorder.");
              return;
            }

            const aiSource = ctx.createMediaElementSource(agentAudio);
            aiSource.connect(mixedDestination);
            aiSource.connect(ctx.destination);
            aiAudioSourceRef.current = aiSource;
            window.clearInterval(checkAndConnectAI);
            console.log("[Audio] Final Routing: AI -> [Recorder + Speakers]");
          } catch (e) {
            console.warn("[Audio] AI Routing collision, ensuring direct playback:", e);
            window.clearInterval(checkAndConnectAI);
          }
        }, 50);
      } catch (e) {
        console.error("[Audio] Mixing setup failed:", e);
      }

      await conversation.startSession();

    } catch (err) {
      setConnecting(false);
      toast({
        variant: "destructive",
        title: "Could not start call",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  }, [connecting, callActive, conversation, toast, user, voiceGender]);

  // ─── End call ─────────────────────────────────────────────────────────────
  const endCall = useCallback(async () => {
    if (isEndingCall) return;
    setIsEndingCall(true);

    try {
      await conversation.endSession();
    } catch { /* ignore */ }

    setCallActive(false);
    setConnecting(false);
    setIsMicMuted(false);
    setVoiceMode("listening");
    hasUserSpokenRef.current = false;
    pendingEndRef.current = false;
    pendingEndAfterSpeechRef.current = false;
    setIsEndingCall(false);

    // Stop mixed recorder and convert to MP3 so the file is directly playable on phones.
    const finalizeCallAudio = async (): Promise<string | null> => {
      return new Promise((resolve) => {
        const rec = mediaRecorderRef.current;
        if (!rec || rec.state === "inactive") { resolve(null); return; }
        
        rec.onstop = async () => {
          const webmBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          if (webmBlob.size < 100) { resolve(null); return; }

          try {
            // ENCODE TO MP3 (In-browser)
            // We use the AudioContext to decode the webm into PCM and then LameJS to MP3
            const arrayBuf = await webmBlob.arrayBuffer();
            const audioCtx = audioContextRef.current || new AudioContext();
            const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
            
            const runtimeWindow = window as DebugWindow;
            if (!runtimeWindow.lamejs) {
              const script = document.createElement("script");
              script.src = "https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js";
              document.head.appendChild(script);
              await new Promise<void>((loadResolve) => {
                script.onload = () => loadResolve();
              });
            }

            const Lame = runtimeWindow.lamejs;
            if (!Lame) {
              throw new Error("MP3 encoder failed to load.");
            }
            const mp3encoder = new Lame.Mp3Encoder(1, audioBuf.sampleRate, 128); // mono, bitRate 128
            const samples = audioBuf.getChannelData(0);
            
            // Convert Float32 to Int16 for LameJS
            const int16Samples = new Int16Array(samples.length);
            for (let i = 0; i < samples.length; i++) {
                const s = Math.max(-1, Math.min(1, samples[i]));
                int16Samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }

            const mp3Data = [];
            const sampleBlockSize = 1152;
            for (let i = 0; i < int16Samples.length; i += sampleBlockSize) {
                const chunk = int16Samples.subarray(i, i + sampleBlockSize);
                const mp3buf = mp3encoder.encodeBuffer(chunk);
                if (mp3buf.length > 0) mp3Data.push(new Uint8Array(mp3buf));
            }
            const endBuf = mp3encoder.flush();
            if (endBuf.length > 0) mp3Data.push(new Uint8Array(endBuf));

            const mp3Blob = new Blob(mp3Data, { type: "audio/mpeg" });
            const reader = new FileReader();
            reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
            reader.readAsDataURL(mp3Blob);

          } catch (e) {
            console.error("[Audio] MP3 conversion failed:", e);
            resolve(null);
          }
        };

        try { rec.stop(); } catch { resolve(null); }
        // We do NOT close the AudioContext here. 
        // Re-using the same <audio> element across multiple AudioContexts throws InvalidStateError.
        // We suspend it instead to save resources.
        audioContextRef.current?.suspend().catch(() => {});
      });
    };

    const audioDataUrl = await finalizeCallAudio();
    audioDataUrlRef.current = audioDataUrl;
    // DO NOT reset aiAudioSourceRef.current to null; it is reused on next call.

    // Save call to localStorage for history (schema matches Dashboard expectations)
    const endTime = new Date();
    const startTime = callStartTimeRef.current ?? endTime;
    const durationSec = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
    const callData = {
      id: uid(),
      userMobile: user?.mobile || "",
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: durationSec,
      status: "completed" as const,
      transcript: transcripts
        .filter(t => t.status === "final")
        .map(t => ({
          id: t.id,
          role: t.role,
          text: t.text,
          timestamp: t.timestamp.toISOString(),
          status: "final" as const,
        })),
      audioBlob: audioDataUrl,
      updatedAt: endTime.toISOString(),
    };
    try {
      await callStorage.saveCall(callData);
      window.dispatchEvent(new Event("yaara_calls_updated"));
    } catch (err) {
      console.error("[CallYaara] Save failed:", err);
    }

  }, [isEndingCall, conversation, transcripts, user?.mobile]);

  // Keep endCallFnRef fresh
  useEffect(() => { endCallFnRef.current = endCall; }, [endCall]);

  // ─── Mute toggle ──────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const next = !isMicMuted;
    setIsMicMuted(next);
    conversation.setMuted(next);
  }, [isMicMuted, conversation]);

  // ─── Derived UI strings ───────────────────────────────────────────────────
  const modeLabel = useMemo(() => {
    if (connecting) return "Connecting…";
    if (!callActive) return "Tap to start your call";
    if (isMicMuted) return "Mic is muted";
    if (voiceMode === "speaking") return "Yaara is speaking…";
    if (voiceMode === "processing") return "Thinking…";
    return "Listening — speak now";
  }, [connecting, callActive, isMicMuted, voiceMode]);

  // ─── Orb colors ───────────────────────────────────────────────────────────
  const orbColor = useMemo(() => {
    if (!callActive || connecting) return "from-gray-400 to-gray-500";
    if (voiceMode === "speaking") return "from-orange-400 to-orange-600";
    if (voiceMode === "processing") return "from-purple-500 to-indigo-600";
    return "from-blue-400 to-blue-600";           // listening
  }, [callActive, connecting, voiceMode]);

  const orbAnimate = useMemo(() => {
    if (!callActive) return "animate-pulse";
    if (voiceMode === "speaking") return "animate-bounce";
    if (voiceMode === "processing") return "animate-spin";
    return "animate-pulse";                       // listening
  }, [callActive, voiceMode]);

  const currentVoiceLabel = useMemo(() => {
    const voice = findVoiceOption(sessionVoiceId);
    return voice ? voice.label : (sessionVoiceGender === "female" ? "Yaara" : "Yaar");
  }, [sessionVoiceGender, sessionVoiceId]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-[#0c1222] via-[#162038] to-[#0a0f1d] relative overflow-hidden">

      {/* Background ambient glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-32 right-1/4 w-80 h-80 bg-purple-500/8 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-orange-500/5 to-purple-500/5 rounded-full blur-3xl" />
      </div>

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-5 pt-5 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur transition hover:bg-white/20"
          aria-label="Back"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="text-sm font-semibold uppercase tracking-widest text-[#4285F4]">
          {callActive ? (isEndingCall ? "Ending…" : "SYNCED CALL") : connecting ? "Connecting…" : "Talk with Yaara"}
        </p>
        <div className="w-10" />
      </header>
      
      {/* Debug console hidden for production — toggle with triple-tap on header if needed */}

      {/* ── Avatar orb + name ── */}
      <div className="flex flex-col items-center pt-6 pb-2">
        <div className="relative flex items-center justify-center">
          {callActive && (
            <>
              <span className={cn(
                "absolute rounded-full opacity-15 animate-ping",
                voiceMode === "speaking" ? "h-52 w-52 bg-orange-400" :
                  voiceMode === "processing" ? "h-52 w-52 bg-purple-400" :
                    "h-52 w-52 bg-blue-400"
              )} />
              <span className={cn(
                "absolute rounded-full opacity-20 animate-pulse",
                voiceMode === "speaking" ? "h-44 w-44 bg-orange-500" :
                  voiceMode === "processing" ? "h-44 w-44 bg-purple-500" :
                    "h-44 w-44 bg-blue-500"
              )} style={{ animationDelay: "0.4s" }} />
            </>
          )}
          <button
            onClick={callActive ? undefined : startCall}
            disabled={connecting || isEndingCall}
            aria-label={callActive ? "Active call" : "Start call"}
            className={cn(
              "relative z-10 flex h-36 w-36 items-center justify-center rounded-full shadow-2xl transition-all duration-300 bg-gradient-to-br",
              !callActive || connecting ? "from-gray-500 to-gray-700" :
                voiceMode === "speaking" ? "from-orange-400 to-orange-600" :
                  voiceMode === "processing" ? "from-purple-500 to-indigo-700" :
                    "from-blue-400 to-blue-600",
              !callActive && !connecting && "hover:scale-105 cursor-pointer active:scale-95",
            )}
          >
            {connecting || (voiceMode === "processing" && callActive) ? (
              <svg className="h-10 w-10 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            ) : (
              <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a4 4 0 00-4 4v6a4 4 0 008 0V5a4 4 0 00-4-4z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v1a7 7 0 01-14 0v-1" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>
        </div>

        <p className="mt-5 text-3xl font-bold tracking-tight text-white">Yaara</p>
        <p className="mt-1 text-sm font-semibold text-white/40">Talking with {userFirstName}</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/30">
          Voice: {currentVoiceLabel}{callActive ? " locked for this call" : ""}
        </p>
        <p className="mt-1 text-base font-medium text-white/50">{modeLabel}</p>

        {callActive && (
          <div className="mt-3 flex gap-2">
            {(["listening", "processing", "speaking"] as ConversationMode[]).map(m => (
              <span key={m} className={cn(
                "rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider transition-all duration-300",
                voiceMode === m
                  ? m === "listening" ? "bg-blue-500   text-white scale-110 shadow-lg shadow-blue-500/40"
                    : m === "processing" ? "bg-purple-500  text-white scale-110 shadow-lg shadow-purple-500/40"
                      : "bg-orange-500 text-white scale-110 shadow-lg shadow-orange-500/40"
                  : "bg-white/10 text-white/30",
              )}>
                {m}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Transcript panel ── */}
      <div className="mx-auto mt-4 w-full max-w-lg flex-1 overflow-hidden px-4">
        <div className="max-h-[30vh] overflow-y-auto rounded-3xl bg-white/5 p-4 backdrop-blur md:max-h-[38vh]">
          {transcripts.length === 0 ? (
            <div className="flex min-h-[80px] items-center justify-center">
              <p className="text-center text-sm font-medium text-white/30">
                {callActive ? "Start speaking — transcript will appear here" : "Tap the mic above to start your call"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {transcripts.map(entry => (
                <div key={entry.id} className={cn(
                  "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  entry.role === "yaara"
                    ? "mr-auto max-w-[90%] border border-blue-500/20 bg-blue-500/20 text-blue-100"
                    : "ml-auto max-w-[90%] border border-green-500/20 bg-green-500/20 text-green-100",
                  entry.status === "live" && "animate-pulse opacity-60",
                )}>
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wider opacity-50">
                    {entry.role === "yaara" ? "🤖 Yaara" : "👤 You"}
                  </span>
                  {entry.text}
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* ── Call controls ─────────────────────────────────────────────────────
           Active:  [Mute]   [END CALL — large red]   [spacer]
           Idle:    [Start Call — green]
      ────────────────────────────────────────────────────────────────────── */}
      <div className="mt-auto pb-14 pt-8">

        {callActive && (
          <div className="flex items-end justify-center gap-12">
            {/* Mute */}
            <div className="flex flex-col items-center gap-2">
              <button
                id="mute-btn"
                onClick={toggleMute}
                aria-label={isMicMuted ? "Unmute mic" : "Mute mic"}
                className={cn(
                  "flex h-16 w-16 items-center justify-center rounded-full transition-all duration-200 active:scale-95",
                  isMicMuted ? "bg-white/25 text-white ring-2 ring-white/40" : "bg-white/10 text-white/70 hover:bg-white/20",
                )}
              >
                {isMicMuted ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
              </button>
              <span className="text-xs font-semibold text-white/40">{isMicMuted ? "Unmute" : "Mute"}</span>
            </div>

            {/* END CALL — dominant red button */}
            <div className="flex flex-col items-center gap-2">
              <button
                id="end-call-btn"
                onClick={endCall}
                disabled={isEndingCall}
                aria-label="End call"
                className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500 text-white shadow-2xl shadow-red-500/50 ring-4 ring-red-400/30 transition-all duration-200 hover:bg-red-600 active:scale-95 disabled:opacity-60"
              >
                <PhoneOff className="h-9 w-9" />
              </button>
              <span className="text-sm font-bold text-red-400">End Call</span>
            </div>

            {/* Invisible balancer so End Call stays centred */}
            <div className="flex flex-col items-center gap-2 opacity-0 pointer-events-none" aria-hidden>
              <div className="h-16 w-16 rounded-full" />
              <span className="text-xs">—</span>
            </div>
          </div>
        )}

        {!callActive && (
          <div className="flex w-full max-w-lg flex-col items-center gap-6 px-4">
            
            {/* Gender Selection: Big, bold cards right above the start button */}
            <div className="w-full space-y-3">
              <p className="text-center text-xs font-black uppercase tracking-[0.2em] text-amber-300">Aapka Saathi Kaun Hoga? / Choose Companion</p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => chooseVoice("female")}
                  disabled={connecting}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-3xl border p-5 transition-all duration-300",
                    voiceGender === "female"
                      ? "border-amber-400 bg-amber-400/20 shadow-[0_0_20px_rgba(251,191,36,0.2)]"
                      : "border-white/10 bg-white/5 opacity-60 hover:opacity-100 hover:bg-white/10"
                  )}
                >
                  <div className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full text-2xl shadow-inner",
                    voiceGender === "female" ? "bg-amber-400 text-slate-900" : "bg-white/10 text-white/50"
                  )}>👩</div>
                  <p className="text-lg font-black text-white">Yaara (F)</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Warm & Friendly</p>
                </button>
                <button
                  onClick={() => chooseVoice("male")}
                  disabled={connecting}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-3xl border p-5 transition-all duration-300",
                    voiceGender === "male"
                      ? "border-sky-400 bg-sky-400/20 shadow-[0_0_20px_rgba(56,189,248,0.2)]"
                      : "border-white/10 bg-white/5 opacity-60 hover:opacity-100 hover:bg-white/10"
                  )}
                >
                  <div className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full text-2xl shadow-inner",
                    voiceGender === "male" ? "bg-sky-400 text-slate-900" : "bg-white/10 text-white/50"
                  )}>👨</div>
                  <p className="text-lg font-black text-white">Yaar (M)</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Calm & Steady</p>
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4">
              <button
                id="start-call-btn"
                onClick={startCall}
                disabled={connecting}
                aria-label="Start call"
                className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_0_30px_rgba(16,185,129,0.3)] ring-4 ring-emerald-400/20 transition-all duration-300 hover:scale-110 hover:bg-emerald-400 active:scale-95 disabled:opacity-60"
              >
                {connecting ? (
                  <svg className="h-10 w-10 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                ) : (
                  <Phone className="h-10 w-10 fill-current" />
                )}
              </button>
              <span className="text-lg font-black text-emerald-400 tracking-wide uppercase">
                {audioDataUrlRef.current ? "Start New Call" : "Start Call"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Status Footer */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 opacity-20 pointer-events-none">
        <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
        <span className="text-[10px] font-bold text-white uppercase tracking-tighter">Engine: Groq-Lead v2.1 (Sanitized) | {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  );
};

export default CallYaara;
