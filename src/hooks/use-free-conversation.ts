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
      if (recRef.current) {
        try { recRef.current.stop(); } catch(e){}
      }

      emit("speaking");
      
      const finalize = () => {
        emit("listening");
        setTimeout(() => {
          if (recRef.current && modeRef.current === "listening" && sessionActiveRef.current && !isMutedRef.current) {
            try { recRef.current.start(); } catch(e){}
          }
        }, 1100);
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
        audioRef.current.src = `data:audio/mp3;base64,${audioContent}`;
        await audioRef.current.play();

      } catch (err) {
        console.warn("[TTS] API Failed, using Browser Fallback:", err);
        // ── BROWSER FALLBACK ────────────────────────────────────────────────
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(text);
        utt.lang = "en-IN";
        const voices = window.speechSynthesis.getVoices();
        const pref = optionsRef.current.overrides?.agent?.voicePreference || "female";
        const inVoices = voices.filter(v => v.lang.startsWith("en-I") || v.lang.startsWith("hi-I"));
        
        const fKey = ["Google Hindi", "Female", "Sangeeta", "Heera"];
        const mKey = ["Male", "Ravi", "Hemant"];
        
        const vCandidate = pref === "female" 
           ? inVoices.find(v => fKey.some(k => v.name.includes(k))) || inVoices[0]
           : inVoices.find(v => mKey.some(k => v.name.includes(k))) || inVoices[1] || inVoices[0];

        if (vCandidate) utt.voice = vCandidate;
        utt.onend = finalize;
        utt.onerror = finalize;
        window.speechSynthesis.speak(utt);
      }
    });
  }, [emit]);

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
    
    const Speech = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!Speech) {
      optionsRef.current.onError?.("Browser not supported (speech)");
      return;
    }

    const rec = new Speech();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-IN";

    rec.onresult = (e: any) => {
      if (modeRef.current === "speaking" || modeRef.current === "processing" || isMutedRef.current) return;

      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          handleUserSpeech(transcript);
          dispatch("user", transcript, "final");
        } else {
          interim += transcript;
        }
      }
      if (interim) {
        dispatch("user", interim, "live");
        optionsRef.current.onVadScore?.(0.9);
      }
    };

    rec.onend = () => {
      if (sessionActiveRef.current && modeRef.current === "listening" && !isMutedRef.current) {
        try { rec.start(); } catch(e){}
      }
    };

    recRef.current = rec;
    emit("listening");
    optionsRef.current.onConnect?.();

    // TRIGGER INITIAL GREETING IMMEDIATELY
    if (window) (window as any).YARA_DEBUG_LOG = [...((window as any).YARA_DEBUG_LOG || []), "🚀 Session Starting..."];
    
    setTimeout(() => {
      if (sessionActiveRef.current) {
        if (window) (window as any).YARA_DEBUG_LOG = [...((window as any).YARA_DEBUG_LOG || []), "📡 Requesting Greeting..."];
        // Force state to processing to avoid double-trigger
        handleUserSpeech("", true);
      }
    }, 400); // Shorter timeout for desktop responsiveness

  }, [emit, handleUserSpeech, dispatch]);

  const endSession = useCallback(() => {
    sessionActiveRef.current = false;
    if (recRef.current) {
      try { recRef.current.stop(); } catch(e){}
    }
    window.speechSynthesis.cancel();
    emit("idle");
    optionsRef.current.onDisconnect?.();
  }, [emit]);

  const setMuted = useCallback((muted: boolean) => {
    isMutedRef.current = muted;
    if (muted && recRef.current) {
      try { recRef.current.stop(); } catch(e){}
    } else if (!muted && recRef.current && modeRef.current === "listening") {
      try { recRef.current.start(); } catch(e){}
    }
  }, []);

  return { mode, startSession, endSession, requestSilenceResponse, setMuted, agentAudio: audioRef.current };
}
