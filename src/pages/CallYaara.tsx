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
import { Mic, MicOff, PhoneOff, AudioLines } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { YAARA_AGENT_PROMPT } from "@/lib/yaara-agent";

// ─── Transcript types ─────────────────────────────────────────────────────────
type TranscriptRole   = "user" | "yaara";
type TranscriptStatus = "live" | "final";

interface TranscriptEntry {
  id:        string;
  role:      TranscriptRole;
  text:      string;
  status:    TranscriptStatus;
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
  const navigate  = useNavigate();
  const { toast } = useToast();

  // ── call lifecycle ────────────────────────────────────────────────────────
  const [callActive,      setCallActive]      = useState(false);
  const [connecting,      setConnecting]      = useState(false);
  const [isEndingCall,    setIsEndingCall]    = useState(false);
  const [isMicMuted,      setIsMicMuted]      = useState(false);

  // ── voice state (synced from hook) ────────────────────────────────────────
  const [voiceMode,       setVoiceMode]       = useState<ConversationMode>("listening");

  // ── transcript ────────────────────────────────────────────────────────────
  const [transcripts,     setTranscripts]     = useState<TranscriptEntry[]>([]);
  const transcriptEndRef  = useRef<HTMLDivElement>(null);

  // ── silence prompts ───────────────────────────────────────────────────────
  const silenceTimerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSpeechAtRef      = useRef<number | null>(null);
  const hasUserSpokenRef     = useRef(false);
  const silenceStageRef      = useRef(0);
  const silenceInflightRef   = useRef(false);

  // ── misc ─────────────────────────────────────────────────────────────────
  const pendingEndRef = useRef(false);
  const endCallFnRef  = useRef<() => Promise<void>>(async () => {});

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
        last.text   = text;
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
        silenceStageRef.current  = 0;
        silenceInflightRef.current = false;
      }
    },

    onMessage: (msg) => {
      const type      = String(msg.type ?? "").toLowerCase();
      const isFinal   = msg.is_final !== false;
      const isUser    = type.includes("user");
      const isAgent   = type.includes("agent") || type.includes("assistant");
      const text      = (msg.user_transcript || msg.agent_response || msg.text || "").trim();

      if (!text) return;

      if (isUser) {
        upsert("user", text, isFinal ? "final" : "live");
        if (isFinal && hasEndKeyword(text)) pendingEndRef.current = true;
        lastSpeechAtRef.current  = Date.now();
        hasUserSpokenRef.current = true;
        silenceStageRef.current  = 0;
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
      toast({
        variant: "destructive",
        title: "Connection Problem",
        description: err.message.length < 100 ? err.message : "Thodi problem hui, dobara try karein.",
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

      const now  = Date.now();
      const last = lastSpeechAtRef.current ?? now;
      const elapsed = now - last;

      if (!hasUserSpokenRef.current) {
        // Stages for initial silence
        if (elapsed > 8000 && silenceStageRef.current < 2) {
          silenceStageRef.current = 2;
          silenceInflightRef.current = true;
          await conversation.requestSilenceResponse("long-initial").catch(() => {});
          silenceInflightRef.current = false;
        } else if (elapsed > 4000 && silenceStageRef.current < 1) {
          silenceStageRef.current = 1;
          silenceInflightRef.current = true;
          await conversation.requestSilenceResponse("short-initial").catch(() => {});
          silenceInflightRef.current = false;
        }
      } else {
        // Mid-conversation silence
        if (elapsed > 7000 && silenceStageRef.current < 1) {
          silenceStageRef.current = 1;
          silenceInflightRef.current = true;
          await conversation.requestSilenceResponse("mid-conversation").catch(() => {});
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
    hasUserSpokenRef.current   = false;
    silenceStageRef.current    = 0;
    pendingEndRef.current      = false;

    try {
      await conversation.startSession();
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
    pendingEndRef.current    = false;
    setIsEndingCall(false);

    // Save call to localStorage for history
    const callData = {
      id:       uid(),
      endTime:  new Date().toISOString(),
      transcript: transcripts.map(t => ({ role: t.role, text: t.text })),
    };
    try {
      const existing = JSON.parse(localStorage.getItem("yaara_calls") || "[]");
      existing.push(callData);
      localStorage.setItem("yaara_calls", JSON.stringify(existing));
      window.dispatchEvent(new Event("yaara_calls_updated"));
    } catch { /* ignore */ }

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
    if (connecting)            return "Connecting…";
    if (!callActive)           return "Tap to start your call";
    if (isMicMuted)            return "Mic is muted";
    if (voiceMode === "speaking")   return "Yaara is speaking…";
    if (voiceMode === "processing") return "Thinking…";
    return "Listening — speak now";
  }, [connecting, callActive, isMicMuted, voiceMode]);

  // ─── Orb colors ───────────────────────────────────────────────────────────
  const orbColor = useMemo(() => {
    if (!callActive || connecting) return "from-gray-400 to-gray-500";
    if (voiceMode === "speaking")   return "from-orange-400 to-orange-600";
    if (voiceMode === "processing") return "from-purple-500 to-indigo-600";
    return "from-blue-400 to-blue-600";           // listening
  }, [callActive, connecting, voiceMode]);

  const orbAnimate = useMemo(() => {
    if (!callActive) return "animate-pulse";
    if (voiceMode === "speaking")   return "animate-bounce";
    if (voiceMode === "processing") return "animate-spin";
    return "animate-pulse";                       // listening
  }, [callActive, voiceMode]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-screen flex-col bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-4 md:px-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 rounded-xl bg-white/70 px-4 py-2 text-sm font-semibold text-gray-700 shadow backdrop-blur hover:bg-white transition"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold text-gray-800">Yaara Call</h1>
        <div className="w-20" />
      </header>

      {/* ── Main ── */}
      <main className="flex flex-1 flex-col items-center gap-6 px-4 pb-8 md:flex-row md:items-start md:justify-center md:gap-10 md:px-8">

        {/* ── Left: Orb + controls ── */}
        <div className="flex flex-col items-center gap-6">

          {/* Orb */}
          <div className="relative flex items-center justify-center">
            {/* Pulse rings */}
            {callActive && (
              <>
                <span className={cn(
                  "absolute inline-flex h-64 w-64 rounded-full opacity-20",
                  voiceMode === "speaking" ? "bg-orange-400 animate-ping" :
                  voiceMode === "processing" ? "bg-purple-400" :
                  "bg-blue-400 animate-ping"
                )} />
                <span className={cn(
                  "absolute inline-flex h-52 w-52 rounded-full opacity-30",
                  voiceMode === "speaking" ? "bg-orange-400 animate-ping" :
                  voiceMode === "processing" ? "bg-purple-400 animate-pulse" :
                  "bg-blue-300 animate-pulse"
                )} style={{ animationDelay: "0.3s" }} />
              </>
            )}

            {/* Core orb */}
            <button
              onClick={callActive ? undefined : startCall}
              disabled={connecting || isEndingCall}
              aria-label={callActive ? "Call active" : "Start call"}
              className={cn(
                "relative z-10 flex h-44 w-44 items-center justify-center rounded-full shadow-2xl transition-transform duration-200",
                "bg-gradient-to-br",
                orbColor,
                !callActive && !connecting && "hover:scale-105 cursor-pointer",
                connecting && "cursor-wait",
              )}
            >
              {connecting ? (
                <svg className="h-12 w-12 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : voiceMode === "processing" && callActive ? (
                <svg className="h-12 w-12 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a4 4 0 00-4 4v6a4 4 0 008 0V5a4 4 0 00-4-4z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v1a7 7 0 01-14 0v-1" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8"  y1="23" x2="16" y2="23" />
                </svg>
              )}
            </button>
          </div>

          {/* Mode label */}
          <p className="text-center text-lg font-semibold text-gray-700">{modeLabel}</p>

          {/* State pills */}
          {callActive && (
            <div className="flex gap-2">
              {(["listening", "processing", "speaking"] as ConversationMode[]).map(m => (
                <span
                  key={m}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide transition-all",
                    voiceMode === m
                      ? m === "listening"   ? "bg-blue-500 text-white shadow-lg scale-105"
                        : m === "processing" ? "bg-purple-500 text-white shadow-lg scale-105"
                        : "bg-orange-500 text-white shadow-lg scale-105"
                      : "bg-white/60 text-gray-400",
                  )}
                >
                  {m}
                </span>
              ))}
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-4">
            {callActive && (
              <button
                id="mute-btn"
                onClick={toggleMute}
                aria-label={isMicMuted ? "Unmute" : "Mute"}
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition",
                  isMicMuted ? "bg-gray-700 text-white" : "bg-white text-gray-700 hover:bg-gray-100",
                )}
              >
                {isMicMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </button>
            )}

            {callActive ? (
              <button
                id="end-call-btn"
                onClick={endCall}
                disabled={isEndingCall}
                aria-label="End call"
                className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-xl hover:bg-red-600 transition disabled:opacity-60"
              >
                <PhoneOff className="h-7 w-7" />
              </button>
            ) : (
              <button
                id="start-call-btn"
                onClick={startCall}
                disabled={connecting}
                aria-label="Start call"
                className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500 text-white shadow-xl hover:bg-blue-600 transition disabled:opacity-60"
              >
                {connecting ? (
                  <svg className="h-7 w-7 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                ) : (
                  <Mic className="h-7 w-7" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* ── Right: Transcript ── */}
        <div className="w-full max-w-sm rounded-3xl bg-white/80 p-5 shadow-xl backdrop-blur md:max-w-md md:p-7 lg:max-w-lg">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">💬 Conversation</h2>
            <AudioLines className="h-5 w-5 text-blue-500" />
          </div>

          <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1 md:max-h-[60vh]">
            {transcripts.length === 0 ? (
              <div className="rounded-2xl bg-blue-50 px-5 py-8 text-center text-base font-medium text-blue-600">
                {callActive ? "Start speaking…" : "Start a call to begin conversation"}
              </div>
            ) : (
              transcripts.map(entry => (
                <div
                  key={entry.id}
                  className={cn(
                    "rounded-2xl px-4 py-3 text-base leading-relaxed shadow",
                    entry.role === "yaara"
                      ? "mr-auto max-w-[88%] bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-blue-400 text-gray-800"
                      : "ml-auto max-w-[88%] bg-gradient-to-r from-green-50 to-green-100 border-l-4 border-green-400 text-gray-800",
                    entry.status === "live" && "opacity-75 animate-pulse",
                  )}
                >
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide opacity-60">
                    {entry.role === "yaara" ? "🤖 Yaara" : "👤 You"}
                  </span>
                  {entry.text}
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default CallYaara;
