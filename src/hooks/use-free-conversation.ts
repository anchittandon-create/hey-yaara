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
  onTranscript?: (role: TranscriptRole, text: string, status: TranscriptStatus) => void;
  onError?: (err: any) => void;
}

/**
 * useFreeConversation
 *
 * Hardened STT/TTS engine with Hardware Gating to prevent echo attribution.
 */
export function useFreeConversation(options: UseFreeConversationOptions) {
  const [mode, setMode] = useState<ConversationMode>("idle");
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const modeRef = useRef<ConversationMode>("idle");
  const recRef = useRef<any>(null);
  const sessionActiveRef = useRef(false);
  const historyRef = useRef<{ role: string; content: string }[]>([]);

  const emit = useCallback((m: ConversationMode) => {
    setMode(m);
    modeRef.current = m;
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

  // ─── Speech Synthesis (Hardened Hardware Gating) ──────────────────────────
  const speak = useCallback(async (text: string) => {
    return new Promise<void>((resolve) => {
      if (!text) { resolve(); return; }

      // HARDWARE SHIELD: Physically disable STT hardware to protect from AI echo
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
        // GRACE PERIOD: Wait for room echo to settle before re-enabling mic
        setTimeout(() => {
          if (recRef.current && modeRef.current === "listening" && sessionActiveRef.current) {
            try { recRef.current.start(); } catch(e){}
          }
        }, 1200);
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
      // Strip common label prefixes
      finalReply = finalReply.replace(/^(Yaara|Yaar|Agent|Assistant|Model):\s*/i, "");

      historyRef.current.push({ role: "user", content: text });
      historyRef.current.push({ role: "assistant", content: finalReply });
      
      optionsRef.current.onTranscript?.("assistant", finalReply, "final");
      await speak(finalReply);

    } catch (err) {
      console.error("[Chat] Interaction failed:", err);
      optionsRef.current.onError?.(err);
      emit("listening");
    }
  }, [callLLM, speak, emit]);

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
      // PRE-EMPTIVE BLOCK: If we are speaking, ignore everything from the mic hardware
      if (modeRef.current === "speaking" || modeRef.current === "processing") return;

      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          handleUserSpeech(transcript);
          optionsRef.current.onTranscript?.("user", transcript, "final");
        } else {
          interim += transcript;
        }
      }
      if (interim) {
        optionsRef.current.onTranscript?.("user", interim, "live");
      }
    };

    rec.onend = () => {
      if (sessionActiveRef.current && modeRef.current === "listening") {
        try { rec.start(); } catch(e){}
      }
    };

    recRef.current = rec;
    rec.start();
    emit("listening");
    optionsRef.current.onConnect?.();
  }, [emit, handleUserSpeech]);

  const endSession = useCallback(() => {
    sessionActiveRef.current = false;
    if (recRef.current) {
      try { recRef.current.stop(); } catch(e){}
    }
    window.speechSynthesis.cancel();
    emit("idle");
    optionsRef.current.onDisconnect?.();
  }, [emit]);

  return { mode, startSession, endSession };
}
