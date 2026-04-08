import { useState, useEffect, useRef, useCallback } from "react";

export type ConversationMode = "idle" | "listening" | "processing" | "speaking";
export type TranscriptRole = "user" | "assistant";
export type TranscriptStatus = "live" | "final";

export interface TranscriptEntry {
  id: string;
  role: TranscriptRole;
  text: string;
  status: TranscriptStatus;
  timestamp: Date;
}

interface UseFreeConversationOptions {
  overrides?: {
    agent?: {
      prompt?: { prompt: string };
      voicePreference?: "male" | "female";
    };
  };
  onConnect?: () => void;
  onDisconnect?: () => void;
  onMessage?: (msg: { type: string; text: string; is_final: boolean }) => void;
  onTranscript?: (role: TranscriptRole, text: string, status: TranscriptStatus) => void;
  onModeChange?: (data: { mode: ConversationMode }) => void;
  onVadScore?: (score: number) => void;
  onError?: (err: any) => void;
}

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onspeechend?: (() => void) | null;
  onerror?: ((event: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionCtor = new () => BrowserSpeechRecognition;

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
  length: number;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

const selectBrowserVoice = (
  voices: SpeechSynthesisVoice[],
  preference: "male" | "female",
) => {
  const indiaVoices = voices.filter((voice) => voice.lang.startsWith("en-IN") || voice.lang.startsWith("hi-IN"));
  const voicePool = indiaVoices.length > 0 ? indiaVoices : voices;
  const femaleMarkers = ["female", "woman", "sangeeta", "veena", "heera", "zira", "samantha", "karen"];
  const maleMarkers = ["male", "man", "ravi", "hemant", "amit", "prabhat", "daniel", "david"];
  const forbiddenMarkers = preference === "female" ? maleMarkers : femaleMarkers;
  const preferredMarkers = preference === "female" ? femaleMarkers : maleMarkers;

  const strictMatch = voicePool.find((voice) => {
    const name = voice.name.toLowerCase();
    return preferredMarkers.some((marker) => name.includes(marker))
      && !forbiddenMarkers.some((marker) => name.includes(marker));
  });

  if (strictMatch) return strictMatch;

  const softMatch = voicePool.find((voice) => {
    const name = voice.name.toLowerCase();
    return !forbiddenMarkers.some((marker) => name.includes(marker));
  });

  return softMatch ?? voicePool[0] ?? voices[0] ?? null;
};

/**
 * useFreeConversation
 *
 * RESTORED & HARDENED:
 * 1. Automatic greeting from Yaara on startSession.
 * 2. Robust response handling (handles raw text or JSON).
 * 3. Protocol-Correction: Separates system prompts for Gemini 400 avoidance.
 */
export function useFreeConversation(options: UseFreeConversationOptions) {
  const [mode, setMode] = useState<ConversationMode>("idle");
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const modeRef = useRef<ConversationMode>("idle");
  const recRef = useRef<any>(null);
  const sessionActiveRef = useRef(false);
  const historyRef = useRef<{ role: string; content: string }[]>([]);
  const isMutedRef = useRef(false);
  const handleUserSpeechRef = useRef<(text: string) => Promise<void>>(async () => {});
  const finalUserSegmentsRef = useRef<string[]>([]);
  const interimUserTextRef = useRef("");
  const flushUserTurnTimerRef = useRef<number | null>(null);
  const isRecognitionStartingRef = useRef(false);

  const emit = useCallback((m: ConversationMode) => {
    setMode(m);
    modeRef.current = m;
    optionsRef.current.onModeChange?.({ mode: m });
  }, []);

  const dispatch = useCallback((role: TranscriptRole, text: string, status: TranscriptStatus) => {
    optionsRef.current.onTranscript?.(role, text, status);
    optionsRef.current.onMessage?.({
      type: role === "user" ? "user_speech" : "yaara_response",
      text,
      is_final: status === "final"
    });
  }, []);

  const clearFlushTimer = useCallback(() => {
    if (flushUserTurnTimerRef.current !== null) {
      window.clearTimeout(flushUserTurnTimerRef.current);
      flushUserTurnTimerRef.current = null;
    }
  }, []);

  const flushUserTurn = useCallback(async () => {
    clearFlushTimer();

    const finalText = finalUserSegmentsRef.current.join(" ").replace(/\s+/g, " ").trim();
    interimUserTextRef.current = "";
    finalUserSegmentsRef.current = [];

    if (!finalText) return;

    dispatch("user", finalText, "final");
    await handleUserSpeechRef.current(finalText);
  }, [clearFlushTimer, dispatch]);

  const scheduleFlushUserTurn = useCallback(() => {
    clearFlushTimer();
    flushUserTurnTimerRef.current = window.setTimeout(() => {
      void flushUserTurn();
    }, 700);
  }, [clearFlushTimer, flushUserTurn]);

  const stopRecognition = useCallback(() => {
    const rec = recRef.current as BrowserSpeechRecognition | null;
    if (!rec) return;
    try {
      rec.stop();
    } catch {
      // Ignore repeated stop attempts from browsers.
    }
  }, []);

  const startRecognition = useCallback(() => {
    const rec = recRef.current as BrowserSpeechRecognition | null;
    if (!rec || isMutedRef.current || !sessionActiveRef.current || modeRef.current !== "listening") return;
    if (isRecognitionStartingRef.current) return;

    isRecognitionStartingRef.current = true;
    try {
      rec.start();
    } catch {
      // Browsers often throw if recognition is already active.
    } finally {
      window.setTimeout(() => {
        isRecognitionStartingRef.current = false;
      }, 120);
    }
  }, []);

  // ─── AI Proxy Bridge ──────────────────────────────────────────────────────
  const callLLM = useCallback(async (messages: any[]) => {
    try {
      if (window) (window as any).YARA_DEBUG_LOG = [...((window as any).YARA_DEBUG_LOG || []), "📡 AI Bridge: Sending..."];
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });

      if (window) (window as any).YARA_DEBUG_LOG = [...((window as any).YARA_DEBUG_LOG || []), `🛰️ HTTP Status: ${resp.status}`];

      // RESILIENT PARSING: Try parsing even if header is wonky
      const data = await resp.json().catch(() => null);
      if (data) {
        if (data.text) {
          if (window) (window as any).YARA_DEBUG_LOG = [...((window as any).YARA_DEBUG_LOG || []), "✅ AI Response OK"];
          return data.text;
        }
        if (data.error) throw new Error(`${data.error}`);
      }
      
      throw new Error(`Data Format Error. (Status: ${resp.status})`);
    } catch (err: any) {
      console.error("[AI] Bridge Error:", err);
      if (window) (window as any).YARA_DEBUG_LOG = [...((window as any).YARA_DEBUG_LOG || []), `❌ Bridge Fail: ${err.message}`];
      throw new Error(`Connectivity issues. ${err.message}`);
    }
  }, []);

  // ─── API-Based Speech Synthesis (Capturable for Recording) ───────────────
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = useCallback(async (text: string) => {
    return new Promise<void>(async (resolve) => {
      if (!text) { resolve(); return; }

      // HARDWARE GATE: Explicitly stop mic during AI speech
      stopRecognition();

      emit("speaking");
      
      const finalize = () => {
        emit("listening");
        window.setTimeout(() => {
          startRecognition();
        }, 30);
        resolve();
      };

      try {
        const pref = optionsRef.current.overrides?.agent?.voicePreference || "female";
        const resp = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, gender: pref.toUpperCase() }),
        });

        if (!resp.ok) throw new Error("TTS API unavailable");
        const { audioContent } = await resp.json();

        if (!audioRef.current) {
          audioRef.current = new Audio();
          audioRef.current.autoplay = true;
          audioRef.current.crossOrigin = "anonymous";
        }

        audioRef.current.onended = finalize;
        audioRef.current.onerror = finalize;
        audioRef.current.src = `data:audio/mpeg;base64,${audioContent}`;
        await audioRef.current.play();

      } catch (err) {
        console.warn("[TTS] API Failed, using Browser Fallback:", err);
        // ── BROWSER FALLBACK ────────────────────────────────────────────────
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(text);
        const pref = optionsRef.current.overrides?.agent?.voicePreference || "female";
        utt.lang = "en-IN";
        utt.rate = 0.96;
        utt.pitch = pref === "female" ? 1.08 : 0.9;
        const voices = window.speechSynthesis.getVoices();
        const vCandidate = selectBrowserVoice(voices, pref);

        if (!vCandidate) {
          console.warn(`[TTS] No browser voice available for preference: ${pref}`);
          finalize();
          return;
        }

        utt.voice = vCandidate;
        utt.onend = finalize;
        utt.onerror = finalize;
        window.speechSynthesis.speak(utt);
      }
    });
  }, [emit, startRecognition, stopRecognition]);

  // ─── Interaction Logic ────────────────────────────────────────────────────
  const handleUserSpeech = useCallback(async (text: string, isSystemTrigger = false) => {
    if (!sessionActiveRef.current || modeRef.current === "processing" || modeRef.current === "speaking") return;
    
    emit("processing");
    try {
      const prompt = optionsRef.current.overrides?.agent?.prompt?.prompt || "You are Yaara.";
      const payload = [
        { role: "system", content: prompt },
        ...historyRef.current.slice(-6)
      ];
      if (text) {
        payload.push({ role: "user", content: text });
      } else if (isSystemTrigger) {
        payload.push({ role: "user", content: "[System: The conversation has just started. Please greet the user warmly and introduce yourself as Yaara in Roman English script.]" });
      }

      const raw = await callLLM(payload);

      // ROBUST PARSING: Only parse JSON if absolutely sure. Otherwise use raw text.
      let finalReply = raw;
      if (raw.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(raw);
          finalReply = parsed.response || parsed.final_response || raw;
        } catch {
          const match = raw.match(/"response":\s*"(.*?)"/) || raw.match(/"final_response":\s*"(.*?)"/);
          if (match) finalReply = match[1];
        }
      }
      
      finalReply = finalReply.replace(/[^\x00-\x7F]/g, "").trim();
      finalReply = finalReply.replace(/^(Yaara|Yaar|Agent|Assistant|Model|Bot):\s*/i, "");

      if (!isSystemTrigger && text) {
        historyRef.current.push({ role: "user", content: text });
      } else if (isSystemTrigger && !text) {
        historyRef.current.push({ role: "user", content: "[Start Conversation]" });
      }
      historyRef.current.push({ role: "assistant", content: finalReply });
      
      dispatch("assistant", finalReply, "final");
      await speak(finalReply);

    } catch (err: any) {
      console.error("[Chat] Interaction failed:", err);
      // EXPOSE ERROR TO UI LOGS
      if (window) (window as any).YARA_DEBUG_LOG = [...((window as any).YARA_DEBUG_LOG || []), `❌ ERROR: ${err.message}`];
      optionsRef.current.onError?.(err);
      emit("listening");
    }
  }, [callLLM, speak, emit, dispatch]);

  useEffect(() => {
    handleUserSpeechRef.current = async (text: string) => {
      await handleUserSpeech(text);
    };
  }, [handleUserSpeech]);

  // ─── Explicit Response Requests (Silence Prompts) ──────────────────────────
  const requestSilenceResponse = useCallback(async (type: string) => {
    if (modeRef.current !== "listening") return;
    const prompt = type === "mid-conversation" 
      ? "The user has been quiet for a long time. Ask them if they are still there or if they want to talk about something else in a very brief, friendly way."
      : "The call just started but the user hasn't said anything for 20 seconds. Greet them again very briefly.";
    
    await handleUserSpeech(`[System Note: ${prompt}]`, true);
  }, [handleUserSpeech]);

  // ─── Browser Recognition System ───────────────────────────────────────────
  const startSession = useCallback(async () => {
    if (sessionActiveRef.current) return;
    sessionActiveRef.current = true;
    
    const speechWindow = window as Window & typeof globalThis & {
      webkitSpeechRecognition?: BrowserSpeechRecognitionCtor;
      SpeechRecognition?: BrowserSpeechRecognitionCtor;
    };
    const Speech = speechWindow.webkitSpeechRecognition || speechWindow.SpeechRecognition;
    if (!Speech) {
      optionsRef.current.onError?.("Browser not supported (speech)");
      return;
    }

    const rec = new Speech();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-IN";

    rec.onresult = (e: SpeechRecognitionEventLike) => {
      if (modeRef.current === "speaking" || modeRef.current === "processing" || isMutedRef.current) return;

      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          const cleanTranscript = transcript.trim();
          if (cleanTranscript) {
            finalUserSegmentsRef.current.push(cleanTranscript);
          }
        } else {
          interim += transcript;
        }
      }

      interimUserTextRef.current = interim.trim();
      const liveText = [...finalUserSegmentsRef.current, interimUserTextRef.current]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (liveText) {
        dispatch("user", liveText, "live");
        optionsRef.current.onVadScore?.(0.9);
      }

      if (finalUserSegmentsRef.current.length > 0) {
        scheduleFlushUserTurn();
      }
    };

    rec.onspeechend = () => {
      if (finalUserSegmentsRef.current.length > 0) {
        scheduleFlushUserTurn();
      }
    };

    rec.onend = () => {
      if (sessionActiveRef.current && modeRef.current === "listening" && !isMutedRef.current) {
        startRecognition();
      }
    };

    recRef.current = rec;
    emit("listening");
    optionsRef.current.onConnect?.();
    startRecognition();

    // TRIGGER INITIAL GREETING IMMEDIATELY
    if (window) (window as any).YARA_DEBUG_LOG = [...((window as any).YARA_DEBUG_LOG || []), "🚀 Session Starting..."];
    
    setTimeout(() => {
      if (sessionActiveRef.current) {
        if (window) (window as any).YARA_DEBUG_LOG = [...((window as any).YARA_DEBUG_LOG || []), "📡 Requesting Greeting..."];
        // Force state to processing to avoid double-trigger
        handleUserSpeech("", true);
      }
    }, 400); // Shorter timeout for desktop responsiveness

  }, [dispatch, emit, handleUserSpeech, scheduleFlushUserTurn, startRecognition]);

  const endSession = useCallback(() => {
    sessionActiveRef.current = false;
    clearFlushTimer();
    finalUserSegmentsRef.current = [];
    interimUserTextRef.current = "";
    stopRecognition();
    window.speechSynthesis.cancel();
    emit("idle");
    optionsRef.current.onDisconnect?.();
  }, [clearFlushTimer, emit, stopRecognition]);

  const setMuted = useCallback((muted: boolean) => {
    isMutedRef.current = muted;
    if (muted) {
      stopRecognition();
    } else if (modeRef.current === "listening") {
      startRecognition();
    }
  }, [startRecognition, stopRecognition]);

  useEffect(() => () => clearFlushTimer(), [clearFlushTimer]);

  return { mode, startSession, endSession, requestSilenceResponse, setMuted, agentAudioRef: audioRef };
}
