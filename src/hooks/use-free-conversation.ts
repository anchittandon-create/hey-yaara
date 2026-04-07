/**
 * use-free-conversation.ts
 *
 * Core voice logic for Yaara.
 * Support for Roman script transcripts, Gender selection, and robust multi-API fallbacks.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type ConversationMode = "listening" | "processing" | "speaking";

export interface ConversationMessage {
  type: "user_transcript" | "agent_response" | "error";
  text?: string;
  user_transcript?: string;
  agent_response?: string;
  is_final?: boolean;
}

interface UseConversationOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onMessage?: (msg: ConversationMessage) => void;
  onError?: (err: Error) => void;
  onModeChange?: (mode: { mode: ConversationMode }) => void;
  onVadScore?: (score: number) => void;
  overrides?: {
    agent?: {
      prompt?: { prompt: string };
      firstMessage?: string;
      voicePreference?: "female" | "male";
    };
  };
}

export const useFreeConversation = (options: UseConversationOptions) => {
  const [mode, setMode] = useState<ConversationMode>("listening");
  
  // Refs for stable state across callbacks
  const optionsRef = useRef(options);
  const modeRef = useRef<ConversationMode>("listening");
  const sessionActiveRef = useRef(false);
  const historyRef = useRef<{ role: string; content: string }[]>([]);
  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const interimAccumRef = useRef("");
  const silenceTimerRef = useRef<any>(null);
  const isMutedRef = useRef(false);
  const wakeupRef = useRef<any>(null);
  const ttsTimeoutRef = useRef<any>(null);

  useEffect(() => { optionsRef.current = options; }, [options]);

  // Sync mode state
  const emit = useCallback((newMode: ConversationMode) => {
    setMode(newMode);
    modeRef.current = newMode;
    optionsRef.current.onModeChange?.({ mode: newMode });
  }, []);

  // ── Voice warmup ─────────────────────────────────────────────────────────
  useEffect(() => {
    const warmup = () => window.speechSynthesis.getVoices();
    warmup();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = warmup;
    }
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const getKeys = () => {
    const env = import.meta.env as Record<string, string>;
    const win = window as any;
    const llm = env["VITE_LLM_API_KEY"] || win["VITE_LLM_API_KEY"] || env["VITE_GEMINI_API_KEY"] || win["VITE_GEMINI_API_KEY"] || "AIzaSyA_6wJREDKfPND2_kJRyV0FDx9FSGqvgWk";
    const oai = env["VITE_OPENAI_API_KEY"] || win["VITE_OPENAI_API_KEY"] || "";
    return { llm, oai };
  };

  // ─── LLM Execution ──────────────────────────────────────────────────────────
  const callLLM = useCallback(async (messages: any[]): Promise<string> => {
    const { llm } = getKeys();
    
    try {
      // Primary: Gemini
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${llm}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { 
            parts: [{ 
              text: messages.filter(m => m.role === "system").map(m => m.content).join("\n\n") + 
              "\n\nSTRICT TRANSCRIPT RULE: USE ONLY ROMAN ENGLISH SCRIPT (A-Z). 1-2 SENTENCES ONLY."
            }] 
          },
          contents: messages.filter(m => m.role !== "system").map(m => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }]
          }))
        }),
      });

      if (!resp.ok) throw new Error(`Gemini status ${resp.status}`);
      const data = await resp.json();
      const resText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (resText) return resText;
      throw new Error("Empty Gemini response");

    } catch (err) {
      console.warn("[Yaara] Gemini failed, trying backup Groq...", err);
      try {
        const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer gsk_6u7nHcB7KvXgY9ZbF4WdE8RtY5UoI2pL3QmN6PqSjF0aDcVbKx"
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages,
            max_tokens: 512,
            temperature: 0.7,
            response_format: { type: "json_object" }
          }),
        });
        if (groqResp.ok) {
          const gData = await groqResp.json();
          return gData?.choices?.[0]?.message?.content?.trim() || "";
        }
      } catch (gErr) {
        console.error("[Yaara] Fallback failed:", gErr);
      }
      throw err;
    }
  }, []);

  // ─── Quality Controller ───────────────────────────────────────────────────
  const vetResponse = useCallback(async (userInput: string, aiResponse: string) => {
    const { llm } = getKeys();
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${llm}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Evaluate if the following AI response is correct, relevant, 1-2 sentences, and in ROMAN script.
User Input: "${userInput}"
AI Response: "${aiResponse}"
Return ONLY "APPROVED" or "REJECTED: <reason>".`
            }]
          }]
        }),
      });
      if (!resp.ok) return true; // Default to allow if vetting fails
      const data = await resp.json();
      const result = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      return result?.includes("APPROVED");
    } catch {
      return true;
    }
  }, []);

  // ─── Speech Synthesis ─────────────────────────────────────────────────────
  const speak = useCallback(async (text: string) => {
    return new Promise<void>((resolve) => {
      if (!text) { resolve(); return; }
      
      emit("speaking");
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = "en-IN";
      utt.rate = 1.0;
      utt.pitch = 1.0;

      const pref = optionsRef.current.overrides?.agent?.voicePreference || "female";
      const voices = window.speechSynthesis.getVoices();
      const enIn = voices.filter(v => v.lang.startsWith("en-IN") || v.lang.startsWith("en_IN"));
      
      const fKeys = ["Google Hindi", "Female", "Sangeeta", "Microsoft Heera", "Samantha"];
      const mKeys = ["Google Male", "Male", "Ravi", "Microsoft Hemant", "Rishi", "David"];
      
      let voice = null;
      if (pref === "female") {
        voice = enIn.find(v => fKeys.some(k => v.name.includes(k))) || enIn[0];
      } else {
        voice = enIn.find(v => mKeys.some(k => v.name.includes(k))) || enIn[1] || enIn[0];
      }

      if (voice) utt.voice = voice;
      
      utt.onend = () => {
        emit("listening");
        resolve();
      };
      utt.onerror = () => {
        emit("listening");
        resolve();
      };
      
      window.speechSynthesis.speak(utt);
    });
  }, [emit]);

  // ─── Thinking Loop ────────────────────────────────────────────────────────
  const handleUserSpeech = useCallback(async (text: string) => {
    if (!sessionActiveRef.current) return;
    emit("processing");

    try {
      let approved = false;
      let reply = "";
      let attempts = 0;

      while (!approved && attempts < 3) {
        attempts++;
        const rawJson = await callLLM([
          { role: "system", content: optionsRef.current.overrides?.agent?.prompt?.prompt || "You are Yaara." },
          ...historyRef.current.slice(-10),
          { role: "user", content: text }
        ]);

        try {
          const parsed = JSON.parse(rawJson);
          reply = parsed.response || parsed.final_response || rawJson;
        } catch {
          const match = rawJson.match(/"response":\s*"(.*)"/) || rawJson.match(/"final_response":\s*"(.*)"/);
          reply = match ? match[1] : rawJson;
        }

        approved = await vetResponse(text, reply);
      }

      historyRef.current.push({ role: "user", content: text });
      historyRef.current.push({ role: "assistant", content: reply });
      
      optionsRef.current.onMessage?.({ type: "agent_response", text: reply, is_final: true });
      await speak(reply);

    } catch (err) {
      console.error("[Yaara] Pipeline Error:", err);
      const errTxt = "Suniye... thoda network issue lag raha hai. Kya aap dobara bol sakte hain?";
      optionsRef.current.onMessage?.({ type: "agent_response", text: errTxt, is_final: true });
      await speak(errTxt);
    }
  }, [callLLM, emit, speak, vetResponse]);

  // ─── Recognition Engine ───────────────────────────────────────────────────
  const startSession = useCallback(async () => {
    if (sessionActiveRef.current) return;
    sessionActiveRef.current = true;
    historyRef.current = [];
    
    // Wake Lock
    try {
      if ("wakeLock" in navigator) {
        wakeupRef.current = await (navigator as any).wakeLock.request("screen");
      }
    } catch {}

    const SpeechType = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechType) throw new Error("Browser voice support missing.");

    const rec = new SpeechType();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-IN";

    rec.onstart = () => optionsRef.current.onConnect?.();
    
    rec.onresult = (e: any) => {
      let currentInterim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          optionsRef.current.onMessage?.({ type: "user_transcript", text: transcript, is_final: true });
          handleUserSpeech(transcript);
        } else {
          currentInterim += transcript;
        }
      }
      if (currentInterim) {
        optionsRef.current.onMessage?.({ type: "user_transcript", text: currentInterim, is_final: false });
      }
    };

    rec.onerror = (e: any) => {
      if (e.error === "no-speech") return;
      console.error("[Recognition] Error:", e.error);
    };

    rec.onend = () => {
      if (sessionActiveRef.current) rec.start();
    };

    recognitionRef.current = rec;
    rec.start();
    
    // Greeting
    const first = optionsRef.current.overrides?.agent?.firstMessage || "Namaste! Main Yaara hoon. Aap kaise hain?";
    optionsRef.current.onMessage?.({ type: "agent_response", text: first, is_final: true });
    await speak(first);

  }, [handleUserSpeech, speak]);

  const endSession = useCallback(async () => {
    sessionActiveRef.current = false;
    window.speechSynthesis.cancel();
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
    }
    if (wakeupRef.current) {
      wakeupRef.current.release();
      wakeupRef.current = null;
    }
    optionsRef.current.onDisconnect?.();
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    isMutedRef.current = muted;
  }, []);

  const requestSilenceResponse = useCallback(async (type: string) => {
    // Basic silence prompt logic if needed
  }, []);

  return {
    mode,
    startSession,
    endSession,
    setMuted,
    requestSilenceResponse
  };
};
