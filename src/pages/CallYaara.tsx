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
import { useFreeConversation, ConversationMode } from "@/hooks/use-free-conversation";
import { useNavigate } from "react-router-dom";
import { Mic, MicOff, PhoneOff, Phone, AudioLines } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { YAARA_AGENT_PROMPT } from "@/lib/yaara-agent";
import { callStorage } from "@/lib/call-storage";

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

// ─── Component ────────────────────────────────────────────────────────────────
const CallYaara = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // ── call lifecycle ────────────────────────────────────────────────────────
  const [callActive, setCallActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isEndingCall, setIsEndingCall] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const callStartTimeRef = useRef<Date | null>(null);

  // ── voice state (synced from hook) ────────────────────────────────────────
  const [voiceMode, setVoiceMode] = useState<ConversationMode>("listening");

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
  const endCallFnRef = useRef<() => Promise<void>>(async () => { });

  // ── audio recording ───────────────────────────────────────────────────────
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioDataUrlRef = useRef<string | null>(null);

  // ─── Transcript helpers ───────────────────────────────────────────────────
  const upsert = useCallback((role: TranscriptRole, text: string, status: TranscriptStatus) => {
    setTranscripts(prev => {
      const next = [...prev];
      const last = next[next.length - 1];

      // Merge interim into same bubble
      if (status === "live" && last?.role === role && last.status === "live") {
        last.text = text;
        return next;
      }
      // Finalise live bubble
      if (status === "final" && last?.role === role && last.status === "live") {
        last.text = text;
        last.status = "final";
        return next;
      }
      next.push({ id: uid(), role, text, status, timestamp: new Date() });
      return next;
    });
  }, []);

  // ─── Hook ─────────────────────────────────────────────────────────────────
  const conversation = useFreeConversation({
    overrides: { agent: { prompt: { prompt: YAARA_AGENT_PROMPT } } },

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
      const type = String(msg.type ?? "").toLowerCase();
      const isFinal = msg.is_final !== false;
      const isUser = type.includes("user");
      const isAgent = type.includes("agent") || type.includes("assistant");
      const text = (msg.user_transcript || msg.agent_response || msg.text || "").trim();

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

        // Auto-end after Yaara's final farewell reply
        if (isFinal && pendingEndRef.current) {
          pendingEndRef.current = false;
          const delay = Math.min(Math.max(text.split(/\s+/).length * 220, 1500), 3500);
          setTimeout(() => { endCallFnRef.current?.(); }, delay);
        }
      }
    },

    onError: (err) => {
      console.error("[UI] onError:", err);
      const isQuotaError = err.message.includes("429") || err.message.includes("limit reached");
      toast({
        variant: "destructive",
        title: isQuotaError ? "Gemini Quota Exceeded" : "Connection Problem",
        description: isQuotaError
          ? "The daily limit for Gemini API has been reached. To fix this, please add your own VITE_LLM_API_KEY in the .env file."
          : err.message.length < 100 ? err.message : "Thodi problem hui, dobara try karein.",
      });
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

      if (!hasUserSpokenRef.current) {
        // Stages for initial silence
        if (elapsed > 8000 && silenceStageRef.current < 2) {
          silenceStageRef.current = 2;
          silenceInflightRef.current = true;
          await conversation.requestSilenceResponse("long-initial").catch(() => { });
          silenceInflightRef.current = false;
        } else if (elapsed > 4000 && silenceStageRef.current < 1) {
          silenceStageRef.current = 1;
          silenceInflightRef.current = true;
          await conversation.requestSilenceResponse("short-initial").catch(() => { });
          silenceInflightRef.current = false;
        }
      } else {
        // Mid-conversation silence
        if (elapsed > 7000 && silenceStageRef.current < 1) {
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

    callStartTimeRef.current = new Date();
    audioDataUrlRef.current = null;
    audioChunksRef.current = [];

    try {
      await conversation.startSession();

      // Start audio recording after session connects (mic permission already granted)
      try {
        const recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : "audio/mp4";
        const rec = new MediaRecorder(recStream, { mimeType });
        rec.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        rec.start(1000); // collect chunks every 1s
        mediaRecorderRef.current = rec;
      } catch { /* recording optional — don't block call */ }

    } catch (err) {
      setConnecting(false);
      toast({
        variant: "destructive",
        title: "Could not start call",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  }, [connecting, callActive, conversation, toast]);

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
    setIsEndingCall(false);

    // Stop audio recorder and collect final blob
    const stopRecorderAndSave = (): Promise<string | null> =>
      new Promise((resolve) => {
        const rec = mediaRecorderRef.current;
        if (!rec || rec.state === "inactive") { resolve(null); return; }
        rec.onstop = () => {
          const chunks = audioChunksRef.current;
          if (!chunks.length) { resolve(null); return; }
          const blob = new Blob(chunks, { type: chunks[0]?.type || "audio/webm" });
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string ?? null);
          reader.onerror = () => resolve(null);
          // Only store if ≤ 25MB (IndexedDB handles much more than localStorage)
          if (blob.size > 25 * 1024 * 1024) { resolve(null); return; }
          reader.readAsDataURL(blob);
        };
        try { rec.stop(); } catch { resolve(null); }
        // Stop all recording tracks
        rec.stream?.getTracks().forEach(t => t.stop());
        mediaRecorderRef.current = null;
      });

    const audioDataUrl = await stopRecorderAndSave();
    audioDataUrlRef.current = audioDataUrl;

    // Save call to localStorage for history (schema matches Dashboard expectations)
    const endTime = new Date();
    const startTime = callStartTimeRef.current ?? endTime;
    const durationSec = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
    const callData = {
      id: uid(),
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
    };
    try {
      await callStorage.saveCall(callData);
      window.dispatchEvent(new Event("yaara_calls_updated"));
    } catch (err) {
      console.error("[CallYaara] Save failed:", err);
    }

  }, [isEndingCall, conversation, transcripts]);

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
        <p className="text-sm font-semibold uppercase tracking-widest text-white/50">
          {callActive ? (isEndingCall ? "Ending…" : "In Call") : connecting ? "Connecting…" : "Talk with Yaara"}
        </p>
        <div className="w-10" />
      </header>

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
          <div className="flex flex-col items-center gap-4">
            <button
              id="start-call-btn"
              onClick={startCall}
              disabled={connecting}
              aria-label="Start call"
              className="flex h-24 w-24 items-center justify-center rounded-full bg-green-500 text-white shadow-2xl shadow-green-500/40 ring-4 ring-green-400/20 transition-all duration-200 hover:bg-green-600 active:scale-95 disabled:opacity-60"
            >
              {connecting ? (
                <svg className="h-10 w-10 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <Phone className="h-10 w-10" />
              )}
            </button>
            <span className="text-base font-bold text-white/70 tracking-wide">
              {connecting ? "Connecting…" : "Start Call"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallYaara;


