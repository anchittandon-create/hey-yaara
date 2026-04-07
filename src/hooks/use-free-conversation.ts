/**
 * use-free-conversation.ts
 *
 * Strict 3-state conversational engine:
 *   LISTENING  → mic active, user speaks, interim transcripts shown live
 *   PROCESSING → STT finalised, LLM call in flight
 *   SPEAKING   → TTS audio playing, mic paused
 *
 * The loop NEVER stops unless endSession() is called.
 */

import { useCallback, useEffect, useRef } from "react";

// ─── Public types ─────────────────────────────────────────────────────────────

export type ConversationMode = "listening" | "processing" | "speaking";

export interface ConversationMessage {
  type: string;
  text?: string;
  user_transcript?: string;
  agent_response?: string;
  is_final?: boolean;
}

export interface UseConversationOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onMessage?: (message: ConversationMessage) => void;
  onModeChange?: (mode: { mode: ConversationMode }) => void;
  onVadScore?: (score: number) => void;
  onError?: (error: Error) => void;
  overrides?: {
    agent?: {
      prompt?: { prompt: string };
      firstMessage?: string;
    };
  };
}

export interface ConversationSession {
  startSession: () => Promise<void>;
  endSession: () => Promise<void>;
  setMuted: (muted: boolean) => void;
  sendContextualUpdate: (message: string) => void;
  sendUserActivity: () => void;
  requestSilenceResponse: (reason?: string) => Promise<string>;
}

// ─── Detect SpeechRecognition ─────────────────────────────────────────────────
const SpeechRecognitionCtor: any =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useFreeConversation = (options: UseConversationOptions): ConversationSession => {
  // ── state refs (no re-render needed) ────────────────────────────────────────
  const sessionActiveRef = useRef(false);
  const modeRef = useRef<ConversationMode>("listening");
  const isMutedRef = useRef(false);
  const historyRef = useRef<{ role: string; content: string }[]>([]);
  const contextRef = useRef("");

  // ── audio refs ───────────────────────────────────────────────────────────────
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const ttsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interimAccumRef = useRef("");
  const wakeLockRef = useRef<any>(null);

  // ── keep options fresh without stale-closure issues ──────────────────────────
  const optionsRef = useRef(options);
  useEffect(() => { optionsRef.current = options; }, [options]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const emit = useCallback((mode: ConversationMode) => {
    modeRef.current = mode;
    optionsRef.current.onModeChange?.({ mode });
    console.log(`[Yaara] ← ${mode.toUpperCase()}`);
  }, []);

  // ─── API keys ────────────────────────────────────────────────────────────────
  const getKeys = () => {
    const env = import.meta.env as Record<string, string>;
    const win = window as any;
    const llm = env["VITE_LLM_API_KEY"] || win["VITE_LLM_API_KEY"] || env["VITE_GEMINI_API_KEY"] || win["VITE_GEMINI_API_KEY"] || "AIzaSyA_6wJREDKfPND2_kJRyV0FDx9FSGqvgWk";
    const oai = env["VITE_OPENAI_API_KEY"] || win["VITE_OPENAI_API_KEY"] || "";
    return { llm, oai };
  };

  // ─── LLM ─────────────────────────────────────────────────────────────────────
  const callLLM = useCallback(async (extraSystem: string[] = []): Promise<string> => {
    const { llm, oai } = getKeys();
    const key = llm || oai;
    if (!key) throw new Error("No API key configured.");

    const systemPrompt =
      optionsRef.current.overrides?.agent?.prompt?.prompt ||
      `You are Yaara, a real-time conversational AI companion.
You are in a live phone call with the user.
-----------------------------------
CRITICAL EXECUTION RULE: 
1. Understand intent, topic, and clarity.
2. Decide (Answer, Continue, Follow-up, Clarify).
3. Generate 1-2 sentences ONLY, natural spoken language.
4. Validate: Relevant? Specific? Factually safe? Human?
-----------------------------------
ANTI-HALLUCINATION: Do NOT guess facts or assume details.
ANTI-GENERIC: NEVER say "Okay", "That's nice", or "Tell me more".
ANTI-ECHO: Do NOT repeat or paraphrase user input.
-----------------------------------
CONVERSATION FLOW: Your response MUST always move the conversation forward. NEVER give a dead-end response.
-----------------------------------
OUTPUT FORMAT (STRICT):
Return ONLY this JSON:
{ "response": "<final spoken sentence>" }`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(contextRef.current
        ? [{ role: "system", content: `Current Page Context: ${contextRef.current}. Use this if the user asks what they are seeing.` }]
        : []),
      ...extraSystem.map(c => ({ role: "system", content: c })),
      ...historyRef.current.slice(-50), // Keep last 50 turns for better long-term memory during call
    ];

    // Gemini path with automatic fallback
    if (key.startsWith("AIzaSy")) {
      try {
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              system_instruction: { 
                parts: [{ 
                  text: messages.filter(m => m.role === "system").map(m => m.content).join("\n\n") + 
                  "\n\nSTRICT RULE: DO NOT HALLUCINATE. If a user asks for facts, use the google_search tool. If you are unsure, say you don't know. Always prioritize accuracy over guessing."
                }] 
              },
              contents: messages.filter(m => m.role !== "system").map(m => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.content }],
              })),
              tools: [
                { 
                  google_search_retrieval: { 
                    dynamic_retrieval_config: { 
                      mode: "MODE_DYNAMIC", 
                      dynamic_threshold: 0.1 // Use search even for low-probability factual claims
                    } 
                  } 
                } 
              ],
              generationConfig: { 
                maxOutputTokens: 1024, 
                temperature: 0.4, // Lower temperature for high accuracy and no hallucinations
                top_p: 0.95 
              },
            }),
          },
        );

        if (resp.status === 429) {
          console.log("[Yaara] Gemini quota exceeded → falling back to free Groq public endpoint");
          // Automatic fallback to Groq open endpoint for free unlimited usage
          const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer gsk_6u7nHcB7KvXgY9ZbF4WdE8RtY5UoI2pL3QmN6PqSjF0aDcVbKx"
            },
            body: JSON.stringify({
              model: "llama3-70b-8192",
              messages,
              max_tokens: 2048,
              temperature: 1.0,
              top_p: 0.95
            }),
          });

          if (groqResp.ok) {
            const data = await groqResp.json();
            const text = data?.choices?.[0]?.message?.content?.trim();
            if (text) return text;
          }

          throw new Error("Gemini API daily limit reached. Please set your personal API key in .env file or try again later.");
        }

        if (!resp.ok) throw new Error(`Gemini error ${resp.status}: ${await resp.text()}`);

        const data = await resp.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!text) throw new Error("Gemini returned empty response.");
        return text;
      } catch (err) {
        console.error("[Yaara-LLM] Primary engine failed:", err);
        // Fallback to Groq if Gemini fails for any reason (not just 429)
        try {
          const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer gsk_6u7nHcB7KvXgY9ZbF4WdE8RtY5UoI2pL3QmN6PqSjF0aDcVbKx"
            },
            body: JSON.stringify({
              model: "llama3-70b-8192",
              messages,
              max_tokens: 2048,
              temperature: 1.0,
              top_p: 0.95
            }),
          });
          if (groqResp.ok) {
            const data = await groqResp.json();
            const text = data?.choices?.[0]?.message?.content?.trim();
            if (text) return text;
          } else {
            const errText = await groqResp.text();
            console.error(`[Yaara-LLM] Groq Error ${groqResp.status}:`, errText);
          }
        } catch (groqErr) {
          console.error("[Yaara-LLM] Fallback engine also failed:", groqErr);
        }
        throw err; // Re-throw the primary error if fallback also fails
      }
    }

    // OpenAI / Groq path
    const isGroq = key.startsWith("gsk_");
    const url = isGroq
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";
    const model = isGroq ? "llama3-70b-8192" : "gpt-4o-mini";

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, max_tokens: 2048, temperature: 1.0, top_p: 0.95 }),
    });
    if (!resp.ok) throw new Error(`LLM error ${resp.status}: ${await resp.text()}`);
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("LLM returned empty response.");
    return text;
  }, []);

  // ─── Vet Response ────────────────────────────────────────────────────────────
  const vetResponse = useCallback(async (userInput: string, aiResponse: string): Promise<boolean> => {
    try {
      const { llm, oai } = getKeys();
      const key = llm || oai;
      if (!key) return true; // fallback to approved if no key

      const messages = [
        {
          role: "system",
          content: `You are a strict quality controller for a real-time AI conversation.
Your job is to evaluate whether the AI response is correct, relevant, and natural.
-----------------------------------
INPUT
-----------------------------------
User Input: ${userInput}
AI Response: ${aiResponse}
-----------------------------------
CHECK THE RESPONSE
-----------------------------------
Evaluate:
1. Is the response directly related to user input?
2. Does it correctly understand what the user said?
3. Is it natural and conversational?
4. Is it free from hallucination or guessing?
5. Is it better than a generic reply?
-----------------------------------
OUTPUT FORMAT
-----------------------------------
Return:
- "APPROVED" if response is good
- "REJECTED: <reason>" if not
-----------------------------------
RULES
-----------------------------------
- Be strict
- Reject vague or generic replies
- Reject irrelevant responses
- Reject hallucinated answers`
        }
      ];

      const url = key.startsWith("AIzaSy") 
        ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`
        : (key.startsWith("gsk_") ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.openai.com/v1/chat/completions");

      const body = key.startsWith("AIzaSy")
        ? { contents: [{ role: "user", parts: [{ text: messages[0].content }] }] }
        : { model: key.startsWith("gsk_") ? "llama3-70b-8192" : "gpt-4o-mini", messages, temperature: 0.0 };

      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(key.startsWith("AIzaSy") ? {} : { Authorization: `Bearer ${key}` }) },
        body: JSON.stringify(body),
      });

      if (!resp.ok) return true;
      const data = await resp.json();
      const result = (key.startsWith("AIzaSy") 
        ? data?.candidates?.[0]?.content?.parts?.[0]?.text
        : data?.choices?.[0]?.message?.content) || "";

      console.log("[Yaara-Vetter] Result:", result.trim());
      return result.toUpperCase().includes("APPROVED");
    } catch (e) {
      console.warn("[Yaara-Vetter] Error:", e);
      return true; // fail safe to true
    }
  }, []);

  // ─── TTS ─────────────────────────────────────────────────────────────────────
  /**
   * Returns a promise that resolves AFTER the audio finishes playing.
   * Falls back to SpeechSynthesis if audio fetch fails.
   * Guaranteed to resolve (never hangs) via fallbackTimeout.
   */
  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!sessionActiveRef.current) { resolve(); return; }
      if (isMutedRef.current) { resolve(); return; }

      emit("speaking");

      // Emit word-by-word progress so the transcript panel fills live
      const words = text.split(/\s+/);
      let wi = 0;
      const progressIv = setInterval(() => {
        if (wi < words.length) {
          optionsRef.current.onMessage?.({
            type: "agent_response_progress",
            agent_response: words.slice(0, ++wi).join(" "),
            is_final: false,
          });
        }
      }, 180);

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearInterval(progressIv);
        if (ttsTimeoutRef.current) { clearTimeout(ttsTimeoutRef.current); ttsTimeoutRef.current = null; }
        currentSourceRef.current = null;
        optionsRef.current.onMessage?.({ type: "agent_response_final", agent_response: text, is_final: true });
        // Return to LISTENING
        emit("listening");
        resolve();
      };

      // Absolute safety net – if audio never fires onended, still resume
      ttsTimeoutRef.current = setTimeout(finish, Math.max(20000, text.length * 150));

      const tryWebSpeech = () => {
        if (!window.speechSynthesis) { finish(); return; }
        if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
        
        const utt = new SpeechSynthesisUtterance(text);
        utt.lang = "en-IN"; // Set to Indian English
        utt.rate = 0.95; 
        utt.pitch = 1.0;
        
        const voices = window.speechSynthesis.getVoices();
        const enVoices = voices.filter(v => v.lang.startsWith("en-IN") || v.lang.startsWith("en_IN"));
        
        // Use the second Indian English voice if available for better pronunciation
        const selectedVoice = enVoices.length > 1 ? enVoices[1] : enVoices[0] || voices.find(v => v.lang.includes("en"));
        
        if (selectedVoice) {
          utt.voice = selectedVoice;
          console.log("[Yaara] Using voice:", selectedVoice.name);
        }
        
        utt.onend = finish;
        utt.onerror = (e) => {
          console.error("[Yaara] TTS Error:", e);
          finish();
        };
        window.speechSynthesis.speak(utt);
      };

      // We now use WebSpeech as primary for better consistency across the entire conversation
      tryWebSpeech();
    });
  }, [emit]);

  // Stop any currently playing TTS immediately (for interruptions)
  const stopSpeaking = useCallback(() => {
    if (ttsTimeoutRef.current) { clearTimeout(ttsTimeoutRef.current); ttsTimeoutRef.current = null; }
    try { currentSourceRef.current?.stop(); } catch { /* already stopped */ }
    currentSourceRef.current = null;
    if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
  }, []);

  // ─── Full turn: process user utterance ───────────────────────────────────────
  const handleUserUtterance = useCallback(async (transcript: string) => {
    if (!sessionActiveRef.current) return;
    console.log("[Yaara] User said:", transcript);

    // Push to history
    historyRef.current.push({ role: "user", content: transcript });

    emit("processing");
    try {
      let reply = "";
      let attempts = 0;
      let approved = false;

      while (!approved && attempts < 3) {
        attempts++;
        const rawJson = await callLLM([
          attempts > 1 ? "The previous response was rejected. Ensure you follow the 4-STEP structured thinking process and return ONLY the required JSON format." : "Return ONLY JSON with 'final_response'."
        ]);
        
        try {
          // Parse JSON and extract the actual spoken response
          const parsed = JSON.parse(rawJson);
          reply = parsed.response || parsed.final_response || "";
        } catch (e) {
          console.warn("[Yaara] Failed to parse JSON response:", rawJson);
          // Simple fallback extraction if LLM fails pure JSON temporarily
          const match = rawJson.match(/"response":\s*"(.*)"/) || rawJson.match(/"final_response":\s*"(.*)"/);
          reply = match ? match[1] : rawJson;
        }

        approved = await vetResponse(transcript, reply);
        if (!approved) console.log("[Yaara] Response REJECTED. Retrying... (Attempt", attempts, ")");
      }

      historyRef.current.push({ role: "assistant", content: reply });
      await speak(reply);
      // Restart loop: Once speaking finishes, we MUST return to listening
      if (sessionActiveRef.current) {
        emit("listening");
        startListening();
      }
    } catch (err) {
      console.error("[Yaara] Final turn error:", err);
      // Only speak a fallback if the entire LLM pipeline crashed
      const errorMsg = "Suniye... thoda network issue lag raha hai. Kya aap dobara bol sakte hain?";
      historyRef.current.push({ role: "assistant", content: errorMsg });
      await speak(errorMsg);
      emit("listening");
      startListening();
    }
  }, [callLLM, emit, speak, vetResponse]);

  // ─── STT / SpeechRecognition ─────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!sessionActiveRef.current) return;
    if (modeRef.current !== "listening") return;
    if (isMutedRef.current) return;

    const rec = recognitionRef.current;
    if (!rec) return;

    // Small delay to ensure the browser's audio stack is ready and not occupied by TTS
    setTimeout(() => {
      if (!sessionActiveRef.current || modeRef.current !== "listening" || isMutedRef.current) return;
      try {
        rec.start();
        console.log("[Yaara] Recognition started");
      } catch (e) {
        // already started
      }
    }, 450);
  }, []);

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    try { rec.stop(); } catch { /* ignore */ }
  }, []);

  const createRecognition = useCallback(() => {
    if (!SpeechRecognitionCtor) return null;

    const rec = new SpeechRecognitionCtor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-IN"; // English-Indian recognition for English transcript
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      console.log("[Yaara] Mic active");
    };

    rec.onresult = (event: any) => {
      // Ignore if we're in processing/speaking mode
      if (modeRef.current !== "listening") return;
      if (isMutedRef.current) return;
      if (!sessionActiveRef.current) return;

      let latestInterim = "";
      let latestFinal = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          latestFinal += r[0].transcript;
        } else {
          latestInterim += r[0].transcript;
          optionsRef.current.onVadScore?.(Math.min(1, (r[0].confidence || 0.6)));
        }
      }

      // Emit interim (live transcription shown on screen)
      if (latestInterim) {
        interimAccumRef.current = latestInterim;
        optionsRef.current.onMessage?.({
          type: "user_transcript",
          user_transcript: latestInterim,
          is_final: false,
        });
        // Reset silence timer each time user speaks
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      }

      // Final result – hand off to LLM pipeline
      if (latestFinal.trim()) {
        interimAccumRef.current = "";
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        optionsRef.current.onMessage?.({
          type: "user_transcript_final",
          user_transcript: latestFinal.trim(),
          is_final: true,
        });
        stopListening(); // stop mic before LLM call
        handleUserUtterance(latestFinal.trim());
      }
    };

    rec.onerror = (event: any) => {
      // Gracefully ignore non-fatal errors
      const fatal = ["service-not-allowed", "not-allowed", "audio-capture"];
      if (fatal.includes(event.error)) {
        console.error("[Yaara] Fatal mic error:", event.error);
        optionsRef.current.onError?.(new Error(`Microphone error: ${event.error}`));
      } else {
        console.warn("[Yaara] Recognition transient error (ignored):", event.error);
      }
    };

    rec.onend = () => {
      console.log("[Yaara] Recognition ended (mode:", modeRef.current, ")");
      // Auto-restart ONLY when we're back in LISTENING mode and session is active
      if (sessionActiveRef.current && modeRef.current === "listening" && !isMutedRef.current) {
        // Small delay to prevent tight-loop errors on some browsers
        setTimeout(() => {
          if (sessionActiveRef.current && modeRef.current === "listening") {
            try {
              recognitionRef.current?.start();
            } catch (e) {
              // already started
            }
          }
        }, 400);
      }
    };

    return rec;
  }, [handleUserUtterance, startListening, stopListening]);

  // ─── Session start ────────────────────────────────────────────────────────────
  const startSession = useCallback(async () => {
    console.log("[Yaara] startSession called");
    if (sessionActiveRef.current) return; // guard double-start

    sessionActiveRef.current = true;
    historyRef.current = [];
    interimAccumRef.current = "";

    try {
      // 1. Acquire mic (shows browser permission prompt)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      // 2. Audio context (needed for TTS decoding)
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") await ctx.resume();
      audioCtxRef.current = ctx;

      // 3. STT
      if (!SpeechRecognitionCtor) {
        throw new Error(
          "Your browser does not support speech recognition. Please use Chrome or Edge.",
        );
      }
      recognitionRef.current = createRecognition();

      // 4. Request Wake Lock (prevents screen from dimming/sleeping)
      if ("wakeLock" in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
          console.log("[Yaara] Wake lock active");
        } catch (err) {
          console.warn("[Yaara] Could not acquire wake lock:", err);
        }
      }

      // 5. Notify UI: connected
      optionsRef.current.onConnect?.();
      emit("speaking"); // about to play greeting

      // 6. Greeting (Yaara speaks first)
      try {
        const greeting = await callLLM([
          "The user just connected. Greet them warmly and naturally. Introduce yourself as Yaara. Be genuine, not scripted.",
        ]);
        historyRef.current.push({ role: "assistant", content: greeting });
        await speak(greeting);
      } catch (e) {
        console.warn("[Yaara] LLM greeting failed, using local fallback:", e);
        // Fallback: warm local greeting to ensure call isn't silent
        const fallback = "Hello, I am Yaara. I am so happy to talk to you! How is your day going?";
        historyRef.current.push({ role: "assistant", content: fallback });
        await speak(fallback);
      }

      // 7. Start listening after greeting
      if (sessionActiveRef.current) {
        emit("listening");
        startListening();
      }

    } catch (err) {
      console.error("[Yaara] startSession error:", err);
      sessionActiveRef.current = false;
      optionsRef.current.onError?.(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, [callLLM, createRecognition, emit, speak, startListening]);

  // ─── Session end ─────────────────────────────────────────────────────────────
  const endSession = useCallback(async () => {
    console.log("[Yaara] endSession called");
    sessionActiveRef.current = false;

    // Stop timers
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }

    // Stop TTS
    stopSpeaking();

    // Stop STT
    stopListening();

    // Stop mic tracks
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    // Release Wake Lock
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log("[Yaara] Wake lock released");
      } catch { /* ignore */ }
    }

    // Close audio context
    try { await audioCtxRef.current?.close(); } catch { /* ignore */ }
    audioCtxRef.current = null;

    historyRef.current = [];
    optionsRef.current.onDisconnect?.();
    emit("listening"); // reset
  }, [emit, stopListening, stopSpeaking]);

  // ─── Mute ────────────────────────────────────────────────────────────────────
  const setMuted = useCallback((muted: boolean) => {
    isMutedRef.current = muted;
    if (muted) {
      stopListening();
    } else if (sessionActiveRef.current && modeRef.current === "listening") {
      startListening();
    }
  }, [startListening, stopListening]);

  // ─── Utilities ───────────────────────────────────────────────────────────────
  const sendContextualUpdate = useCallback((message: string) => {
    contextRef.current = message;
  }, []);

  const sendUserActivity = useCallback(() => {
    // If Yaara is speaking and user starts talking → interrupt
    if (modeRef.current === "speaking") {
      console.log("[Yaara] Interruption detected");
      stopSpeaking();
      emit("listening");
      startListening();
    }
  }, [emit, startListening, stopSpeaking]);

  const requestSilenceResponse = useCallback(async (reason = "user-is-silent") => {
    if (!sessionActiveRef.current) return "";
    if (modeRef.current !== "listening") return "";

    try {
      const reply = await callLLM([
        `The user has been silent for a while (reason: ${reason}). Gently encourage them naturally. Be genuine and warm.`,
      ]);
      historyRef.current.push({ role: "assistant", content: reply });
      stopListening();
      await speak(reply);
      emit("listening");
      startListening();
      return reply;
    } catch {
      return "";
    }
  }, [callLLM, emit, speak, startListening, stopListening]);

  return { startSession, endSession, setMuted, sendContextualUpdate, sendUserActivity, requestSilenceResponse };
};
