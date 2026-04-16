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
import { useFreeConversation } from "@/hooks/use-free-conversation";
import { useNavigate } from "react-router-dom";
import { Mic, MicOff, PhoneOff, PhoneCall, Phone, ArrowLeft } from "lucide-react";
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
import VoiceOrb from "@/components/VoiceOrb";

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
  const [callError, setCallError] = useState<string | null>(null);
  const callStartTimeRef = useRef<Date | null>(null);

  // ─── voice UI (gender picker); hook `mode` is source of truth for listen/think/speak ─
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
  const {
    mode: voiceMode,
    startSession,
    endSession,
    requestSilenceResponse,
    setMuted,
    agentAudioRef,
  } = useFreeConversation({
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
    },

    onModeChange: ({ mode }) => {
      console.log("[UI] mode →", mode);
      if (mode === "listening") {
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

    // Only use onMessage - onTranscript causes duplicates
    onMessage: (msg) => {
      console.log("[UI] onMessage:", msg);
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

        if (isFinal && pendingEndRef.current) {
          pendingEndRef.current = false;
          pendingEndAfterSpeechRef.current = true;
        }
      }
    },

    onError: (err: unknown) => {
      console.error("[UI] onError:", err);
      setCallError("Connection error occurred");
      setCallActive(false);
      setConnecting(false);
      
      const msg = (
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message?: unknown }).message)
          : String(err ?? "unknown")
      ).toLowerCase();
      
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
          await requestSilenceResponse("long-initial").catch(() => { });
          silenceInflightRef.current = false;
        } else if (elapsed > 15000 && silenceStageRef.current < 1) {
          silenceStageRef.current = 1;
          silenceInflightRef.current = true;
          await requestSilenceResponse("short-initial").catch(() => { });
          silenceInflightRef.current = false;
        }
      } else {
        // Mid-conversation silence - ONLY prompt after 25 SECONDS
        if (elapsed > 25000 && silenceStageRef.current < 1) {
          silenceStageRef.current = 1;
          silenceInflightRef.current = true;
          await requestSilenceResponse("mid-conversation").catch(() => { });
          silenceInflightRef.current = false;
        }
      }
    }, 1000);

    return () => {
      if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
    };
  }, [callActive, voiceMode, isMicMuted, requestSilenceResponse]);

  // ─── Scroll transcript to bottom ─────────────────────────────────────────
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  // ─── Start call ───────────────────────────────────────────────────────────
  const startCall = useCallback(async () => {
    if (connecting || callActive) return;
    setCallError(null);
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
          const agentAudio = agentAudioRef.current;
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
        setCallError("Microphone access failed. Please allow microphone permissions and try again.");
      }

      await startSession();

    } catch (err) {
      console.error("[Call] Start error:", err);
      setConnecting(false);
      const errorMsg = err instanceof Error ? err.message : "Could not start call. Please try again.";
      setCallError(errorMsg);
      toast({
        variant: "destructive",
        title: "Could not start call",
        description: errorMsg,
      });
    }
  }, [connecting, callActive, startSession, toast, user, voiceGender, agentAudioRef]);

  // ─── End call ─────────────────────────────────────────────────────────────
  const endCall = useCallback(async () => {
    if (isEndingCall) return;
    setIsEndingCall(true);
    setCallError(null);

    try {
      await endSession();
    } catch { /* ignore */ }

    setCallActive(false);
    setConnecting(false);
    setIsMicMuted(false);
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

  }, [isEndingCall, endSession, transcripts, user?.mobile]);

  // Keep endCallFnRef fresh
  useEffect(() => { endCallFnRef.current = endCall; }, [endCall]);

  // ─── Mute toggle ──────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const next = !isMicMuted;
    setIsMicMuted(next);
    setMuted(next);
  }, [isMicMuted, setMuted]);

  // ─── Derived UI strings ───────────────────────────────────────────────────
  const modeLabel = useMemo(() => {
    if (connecting) return "Connecting…";
    if (!callActive) return "Tap to start your call";
    if (isMicMuted) return "Mic is muted";
    if (voiceMode === "speaking") return "Yaara is speaking…";
    if (voiceMode === "processing") return "Thinking…";
    return "Listening — speak now";
  }, [connecting, callActive, isMicMuted, voiceMode]);

  const currentVoiceLabel = useMemo(() => {
    const voice = findVoiceOption(sessionVoiceId);
    return voice ? voice.label : (sessionVoiceGender === "female" ? "Yaara" : "Yaar");
  }, [sessionVoiceGender, sessionVoiceId]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-x-hidden bg-background px-4 pb-28 pt-10 transition-all duration-700 sm:px-8 md:min-h-screen md:px-12 md:pb-20 md:pt-12 lg:px-16 lg:pb-16 xl:px-20">
      {/* Background ambient glow — scale blur radius on wide screens */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[5%] top-[8%] h-[45%] w-[55%] rounded-full bg-blue-500/5 blur-[100px] lg:left-[12%] lg:h-[50%] lg:w-[42%] lg:blur-[140px]" />
        <div className="absolute bottom-[8%] right-[5%] h-[38%] w-[45%] rounded-full bg-indigo-500/5 blur-[100px] lg:bottom-[10%] lg:right-[12%] lg:h-[45%] lg:w-[35%] lg:blur-[140px]" />
      </div>

      <div
        className={cn(
          "relative z-20 flex w-full flex-col items-stretch gap-10 md:gap-14 lg:gap-12",
          "max-w-md sm:max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl",
          "lg:flex-row lg:items-start lg:justify-between xl:gap-16",
        )}
      >
        {/* Back — avoid display:contents (Safari/WebKit can drop flex children on re-render) */}
        <div className="flex w-full shrink-0 justify-start lg:w-auto lg:pt-1">
          <button
            type="button"
            onClick={() => navigate("/")}
            disabled={callActive}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400 transition hover:text-amber-50 active:scale-95 disabled:opacity-30 lg:h-14 lg:w-14"
            aria-label="Go back"
          >
            <ArrowLeft className="h-6 w-6 lg:h-7 lg:w-7" />
          </button>
        </div>

        {/* Centerpiece: Voice Hub — grows on laptop / desktop */}
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col items-center text-center lg:max-w-[min(100%,42rem)] xl:max-w-[min(100%,48rem)]">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground/80 sm:mb-6 sm:text-xs md:text-sm">
            Talk with Yaara
          </p>

          <div className="relative flex items-center justify-center">
            <VoiceOrb
              isActive={callActive && voiceMode === "speaking"}
              isProcessing={callActive && voiceMode === "processing"}
              isListening={connecting || (callActive && voiceMode === "listening")}
              size="xl"
            />
            {connecting && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-24 w-24 animate-spin rounded-full border-2 border-amber-500/20 border-t-amber-500 md:h-28 md:w-28 lg:h-36 lg:w-36" />
              </div>
            )}
          </div>

          <div className="mt-8 flex w-full max-w-xl flex-col items-center gap-2 sm:mt-10 sm:gap-3 md:max-w-2xl lg:mt-12">
            <p className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl md:text-3xl lg:text-4xl">
              {user?.name || "Friend"}
            </p>
            <p
              className={cn(
                "max-w-lg text-center text-sm font-medium leading-snug transition-colors duration-500 sm:text-base md:text-lg lg:max-w-2xl lg:text-xl",
                callError ? "text-red-400" : callActive ? "text-emerald-400/95" : "text-muted-foreground",
              )}
            >
              {callError || modeLabel}
            </p>
            <p className="text-[11px] text-muted-foreground/70 md:text-xs">
              Voice: <span className="text-muted-foreground/90">{currentVoiceLabel}</span>
            </p>
          </div>

          {/* Live Transcript Display */}
          {callActive && (
            <div className="mt-6 w-full max-w-2xl rounded-2xl glass-card-premium p-4 max-h-48 overflow-y-auto">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Live Transcript</p>
              <div className="space-y-2">
                {transcripts.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">Waiting for conversation to start...</p>
                ) : (
                  transcripts.map((t) => (
                    <div
                      key={t.id}
                      className={cn(
                        "rounded-xl px-3 py-2 text-sm",
                        t.role === "user"
                          ? "ml-auto max-w-[85%] bg-blue-500/10 border border-blue-500/20 text-blue-200"
                          : "mr-auto max-w-[85%] bg-white/5 border border-white/10 text-slate-300",
                      )}
                    >
                      <span className="mb-0.5 block text-xs font-bold opacity-60">
                        {t.role === "user" ? "You" : "Yaara"}
                      </span>
                      {t.text}
                    </div>
                  ))
                )}
                <div ref={transcriptEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* Action Panel — wider companion strip + larger controls on desktop */}
        <div
          className={cn(
            "flex w-full shrink-0 flex-col items-center gap-8 md:gap-10 lg:max-w-[min(100%,24rem)] lg:gap-12 xl:max-w-[26rem]",
            "lg:pt-1",
          )}
        >
          {!callActive && (
            <div className="flex w-full max-w-md flex-col items-center gap-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 md:text-xs">
                Choose Voice
              </p>
              <div className="flex w-full items-center rounded-2xl border border-white/10 bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => setVoiceGender("female")}
                  disabled={connecting}
                  className={cn(
                    "flex-1 rounded-xl py-3 text-sm font-bold transition-all",
                    voiceGender === "female"
                      ? "bg-amber-500 text-slate-900 shadow-xl"
                      : "text-slate-500 hover:text-slate-300",
                  )}
                >
                  Yaara (F)
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceGender("male")}
                  disabled={connecting}
                  className={cn(
                    "flex-1 rounded-xl py-3 text-sm font-bold transition-all",
                    voiceGender === "male"
                      ? "bg-sky-500 text-slate-900 shadow-xl"
                      : "text-slate-500 hover:text-slate-300",
                  )}
                >
                  Yaar (M)
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col items-center justify-center gap-6">
            {!callActive ? (
              <button
                type="button"
                onClick={startCall}
                disabled={connecting}
                className="group relative flex h-36 w-36 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-2xl shadow-emerald-500/30 transition hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                <div className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-20" />
                <div className="relative z-10 flex flex-col items-center gap-1">
                  <Phone className="h-12 w-12" />
                  <span className="text-sm font-bold">START</span>
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={endCall}
                className="flex h-36 w-36 shrink-0 items-center justify-center rounded-full bg-red-500 text-white shadow-2xl shadow-red-500/40 transition hover:scale-105 active:scale-95"
              >
                <div className="flex flex-col items-center gap-1">
                  <PhoneOff className="h-12 w-12" />
                  <span className="text-sm font-bold">END</span>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status Footer */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 opacity-20 sm:bottom-8 md:bottom-10">
        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
        <span className="whitespace-nowrap text-[9px] font-black uppercase tracking-widest text-white sm:text-[10px]">
          Engine: HuggingFace TTS
        </span>
      </div>
    </div>
  );
};

export default CallYaara;
