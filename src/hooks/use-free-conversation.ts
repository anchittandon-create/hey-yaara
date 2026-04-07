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
 * RESTORED: 'onMessage' compatibility for CallYaara.tsx legacy event system.
 * STILL PROTECTED: Hardware Gating prevents AI loopback.
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
    // Standard Hook API
    optionsRef.current.onTranscript?.(role, text, status);
    
    // Legacy CallYaara.tsx compatibility API (onMessage)
    optionsRef.current.onMessage?.({
      type: role === "user" ? "user_speech" : "yaara_response",
      text,
      is_final: status === "final"
    });
  }, []);

  // ─── AI Proxy Bridge ──────────────────────────────────────────────────────
  const callLLM = useCallback(async (messages: any[]) => {
    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages,
          contents: messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }))
        }),
      });

      if (resp.headers.get("content-type")?.includes("application/json")) {
        const data = await resp.json();
        const text = data.text || data.response || data.final_response;
        if (text) return text;
        if (data.error) throw new Error(`${data.error} | ${data.diagnostic || ""}`);
      }
      throw new Error(`Connection Error: ${resp.status}`);
    } catch (err) {
      console.error("[AI] Bridge Error:", err);
      throw new Error("Connectivity issues. AI providers unreachable.");
    }
  }, []);

  // ─── Speech Synthesis (Hardware Gating Protection) ────────────────────────
  const speak = useCallback(async (text: string) => {
    return new Promise<void>((resolve) => {
      if (!text) { resolve(); return; }

      if (recRef.current) {
        try { recRef.current.stop(); } catch(e){}
      }

      emit("speaking");
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = "en-IN";
      
      const pref = optionsRef.current.overrides?.agent?.voicePreference || "female";
      const voices = window.speechSynthesis.getVoices();
      const inVoices = voices.filter(v => v.lang.startsWith("en-I") || v.lang.startsWith("en_I"));
      
      const fKeywords = ["Google Hindi", "Female", "Sangeeta", "Heera", "Raveena", "Zira", "Ava", "Samantha", "Allison", "Google US English", "en-IN"];
      const mKeywords = ["Google Male", "Male", "Ravi", "Hemant", "Rishi", "David", "Google UK English", "en-GB"];
      
      const vCandidate = pref === "female" 
        ? inVoices.find(v => fKeywords.some(k => v.name.includes(k))) || inVoices.find(v => !v.name.includes("Male") && !v.name.includes("Hemant") && !v.name.includes("Ravi")) || inVoices[0]
        : inVoices.find(v => mKeywords.some(k => v.name.includes(k))) || inVoices.find(v => v.name.includes("Male") || v.name.includes("Hemant") || v.name.includes("Ravi")) || inVoices[1] || inVoices[0];

      if (vCandidate) utt.voice = vCandidate;
      
      const finalize = () => {
        emit("listening");
        setTimeout(() => {
          if (recRef.current && modeRef.current === "listening" && sessionActiveRef.current && !isMutedRef.current) {
            try { recRef.current.start(); } catch(e){}
          }
        }, 1100);
        resolve();
      };

      utt.onend = finalize;
      utt.onerror = finalize;
      window.speechSynthesis.speak(utt);
    });
  }, [emit]);

  // ─── Interaction Logic ────────────────────────────────────────────────────
  const handleUserSpeech = useCallback(async (text: string) => {
    if (!sessionActiveRef.current || modeRef.current === "processing" || modeRef.current === "speaking") return;
    
    emit("processing");
    try {
      let finalReply = "";
      const raw = await callLLM([
        { role: "system", content: optionsRef.current.overrides?.agent?.prompt?.prompt || "You are Yaara." },
        ...historyRef.current.slice(-6),
        { role: "user", content: text }
      ]);

      try {
        const parsed = JSON.parse(raw);
        finalReply = parsed.response || parsed.final_response || raw;
      } catch {
        const match = raw.match(/"response":\s*"(.*)"/) || raw.match(/"final_response":\s*"(.*)"/);
        finalReply = match ? match[1] : raw;
      }
      
      finalReply = finalReply.replace(/[^\x00-\x7F]/g, "").trim() || finalReply;
      finalReply = finalReply.replace(/^(Yaara|Yaar|Agent|Assistant|Model|Bot):\s*/i, "");

      historyRef.current.push({ role: "user", content: text });
      historyRef.current.push({ role: "assistant", content: finalReply });
      
      dispatch("assistant", finalReply, "final");
      await speak(finalReply);

    } catch (err) {
      console.error("[Chat] Interaction failed:", err);
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
    
    await handleUserSpeech(`[System Note: ${prompt}]`);
  }, [handleUserSpeech]);

  // ─── Browser Recognition System ───────────────────────────────────────────
  const startSession = useCallback(() => {
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
    rec.start();
    emit("listening");
    optionsRef.current.onConnect?.();
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

  return { mode, startSession, endSession, requestSilenceResponse, setMuted };
}
