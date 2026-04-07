import { useCallback, useEffect, useRef } from "react";

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
  onModeChange?: (mode: { mode: string }) => void;
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
  startSession: (options?: Record<string, unknown>) => Promise<void>;
  endSession: () => Promise<void>;
  setMuted: (muted: boolean) => void;
  sendContextualUpdate: (message: string) => void;
  sendUserActivity: () => void;
  requestSilenceResponse: (reason?: string) => Promise<string>;
}

export const useFreeConversation = (options: UseConversationOptions): ConversationSession => {
  const isListeningRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const isMutedRef = useRef(false);
  const conversationHistoryRef = useRef<Array<{ role: string; content: string; processing?: boolean }>>([]);
  const processUserMessageRef = useRef<((userTranscript: string) => Promise<void>) | null>(null);
  const silenceTimeoutRef = useRef<number | null>(null);
  const sessionStateRef = useRef<"idle" | "active" | "speaking">("idle");
  const contextualInfoRef = useRef("");

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  const openAiApiKey = (import.meta.env as Record<string, unknown>)["VITE_OPENAI_API_KEY"] as string ||
    (window as Window & typeof globalThis)["VITE_OPENAI_API_KEY"] || "";
  const apiKey = (import.meta.env as Record<string, unknown>)["VITE_LLM_API_KEY"] as string ||
    (window as Window & typeof globalThis)["VITE_LLM_API_KEY"] ||
    openAiApiKey || "AIzaSyA_6wJREDKfPND2_kJRyV0FDx9FSGqvgWk";

  let llmProvider = ((import.meta.env as Record<string, unknown>)["VITE_LLM_PROVIDER"] as string) ||
    (window as Window & typeof globalThis)["VITE_LLM_PROVIDER"] ||
    (openAiApiKey ? "openai" : "gemini");

  if (apiKey.startsWith("AIzaSy")) {
    llmProvider = "gemini";
  }

  const openAiModel = ((import.meta.env as Record<string, unknown>)["VITE_OPENAI_MODEL"] as string) || "gpt-4o-mini";
  const groqModel = ((import.meta.env as Record<string, unknown>)["VITE_GROQ_MODEL"] as string) || "mixtral-8x7b-32768";

  const buildMessages = useCallback(
    (extraSystemMessages: string[] = []) => {
      const systemPrompt =
        options.overrides?.agent?.prompt?.prompt ||
        "You are a helpful assistant for elderly people in India. Be warm, patient, and use simple language.";

      return [
        { role: "system", content: systemPrompt },
        ...(contextualInfoRef.current
          ? [{ role: "system", content: `Current conversation context: ${contextualInfoRef.current}` }]
          : []),
        ...extraSystemMessages.map((content) => ({ role: "system", content })),
        ...conversationHistoryRef.current.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      ];
    },
    [options]
  );

  const generateAssistantMessage = useCallback(
    async ({
      extraSystemMessages = [],
      maxTokens = 512,
      temperature = 0.9,
    }: {
      extraSystemMessages?: string[];
      maxTokens?: number;
      temperature?: number;
    }): Promise<string> => {
      const payloadMessages = buildMessages(extraSystemMessages);

      try {
        if (!apiKey) {
          throw new Error("LLM API key is missing.");
        }

        let assistantMessage: string | null = null;

        if (llmProvider === "openai") {
          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: openAiModel,
              messages: payloadMessages,
              max_tokens: maxTokens,
              temperature,
            }),
          });
          const result = await response.json();
          assistantMessage = result?.choices?.[0]?.message?.content?.trim() ?? null;
        } else if (llmProvider === "gemini" || llmProvider === "google") {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                { role: "user", parts: [{ text: payloadMessages.map(m => m.role + ": " + m.content).join("\n\n") }] }
              ],
              generationConfig: {
                maxOutputTokens: maxTokens,
                temperature,
              }
            }),
          });
          if (!response.ok) throw new Error(await response.text());
          const result = await response.json();
          assistantMessage = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
        } else {
          const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: groqModel,
              messages: payloadMessages,
              max_tokens: maxTokens,
              temperature,
            }),
          });
          const result = await response.json();
          assistantMessage = result?.choices?.[0]?.message?.content?.trim() ?? null;
        }

        if (!assistantMessage) throw new Error("No response generated by the LLM.");
        return assistantMessage;
      } catch (error) {
        console.error("LLM API call failed:", error);
        throw error;
      }
    },
    [buildMessages]
  );

  const callLLM = useCallback(
    async (userMessage: string): Promise<string> => {
      const assistantMessage = await generateAssistantMessage({
        extraSystemMessages: [
          "Respond to the latest user message naturally.",
          "Keep the reply short, warm, and human, usually one or two sentences.",
        ],
        maxTokens: 256,
        temperature: 0.95,
      });

      conversationHistoryRef.current.push({
        role: "assistant",
        content: assistantMessage,
      });

      return assistantMessage;
    },
    [generateAssistantMessage]
  );

  const speakText = useCallback(
    (text: string): Promise<void> => {
      return new Promise((resolve) => {
        if (isMutedRef.current) return resolve();

        isSpeakingRef.current = true;
        sessionStateRef.current = "speaking";
        options.onModeChange?.({ mode: "speaking" });

        const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=hi&q=${encodeURIComponent(text)}`;
        const audio = new Audio(url);
        
        const words = text.split(' ');
        let currentWordIndex = 0;
        const progressInterval = setInterval(() => {
          if (currentWordIndex < words.length) {
            options.onMessage?.({
              type: "agent_response_progress",
              agent_response: words.slice(0, currentWordIndex + 1).join(' '),
              is_final: false,
            });
            currentWordIndex++;
          }
        }, 200);

        const cleanup = () => {
          clearInterval(progressInterval);
          isSpeakingRef.current = false;
          sessionStateRef.current = "active";
          options.onModeChange?.({ mode: "listening" });
          options.onMessage?.({ type: "agent_response_final", agent_response: text, is_final: true });
          resolve();
        };

        audio.onended = cleanup;
        audio.onerror = () => {
            // fallback to web speech
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = "hi-IN";
            utterance.onend = cleanup;
            window.speechSynthesis.speak(utterance);
        };
        audio.play().catch(() => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = "hi-IN";
            utterance.onend = cleanup;
            window.speechSynthesis.speak(utterance);
        });
      });
    },
    [options]
  );

  const processUserMessage = useCallback(
    async (userTranscript: string) => {
      isProcessingRef.current = true;
      options.onModeChange?.({ mode: "processing" });

      try {
        const agentResponse = await callLLM(userTranscript);
        await speakText(agentResponse);
      } catch (error) {
        options.onError?.(error instanceof Error ? error : new Error(String(error)));
      } finally {
        isProcessingRef.current = false;
      }
    },
    [callLLM, speakText, options]
  );

  useEffect(() => {
    processUserMessageRef.current = processUserMessage;
  }, [processUserMessage]);

  const sendAudioToWhisper = async (audioBlob: Blob) => {
      const groqKey = openAiApiKey || apiKey; 
      if (!groqKey) {
         console.error("Missing apiKey for STT. Please set VITE_OPENAI_API_KEY.");
         return;
      }
      const formData = new FormData();
      formData.append("file", audioBlob, "audio.webm");
      formData.append("model", "whisper-large-v3");
      formData.append("language", "hi");

      try {
        const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${groqKey}` },
          body: formData
        });
        if (!res.ok) return;
        const data = await res.json();
        const text = data.text?.trim();
        if (text && text.length > 2) {
          options.onMessage?.({ type: "user_transcript_final", user_transcript: text, is_final: true });
          conversationHistoryRef.current.push({ role: "user", content: text });
          processUserMessageRef.current?.(text);
        }
      } catch(e) {
          console.error("Whisper Error", e);
      }
  };

  const startSession = useCallback(async () => {
    try {
      conversationHistoryRef.current = [];
      sessionStateRef.current = "active";
      isListeningRef.current = true;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      options.onConnect?.();

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.minDecibels = -60;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length > 0) {
            const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            await sendAudioToWhisper(blob);
            audioChunksRef.current = [];
        }
      };

      let isSpeaking = false;
      let silenceStart = Date.now();

      const checkAudio = () => {
        if (sessionStateRef.current === "idle") return;
        
        // Skip VAD analysis if we are speaking/processing
        if (isSpeakingRef.current || isProcessingRef.current || isMutedRef.current) {
            if (isSpeaking && mediaRecorder.state === "recording") {
                mediaRecorder.stop();
                isSpeaking = false;
            }
            requestAnimationFrame(checkAudio);
            return;
        }

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const average = sum / dataArray.length;
        options.onVadScore?.(average/100);

        if (average > 10) {
          silenceStart = Date.now();
          if (!isSpeaking) {
            isSpeaking = true;
            try { if (mediaRecorder.state === "inactive") mediaRecorder.start(); } catch(e){}
            options.onMessage?.({ type: "user_transcript_final", user_transcript: "...", is_final: false });
          }
        } else {
          if (isSpeaking && Date.now() - silenceStart > 1200) {
            isSpeaking = false;
            try { if (mediaRecorder.state === "recording") mediaRecorder.stop(); } catch(e){}
          }
        }
        requestAnimationFrame(checkAudio);
      };
      
      try {
        const openingMessage = await generateAssistantMessage({ extraSystemMessages: ["Generate a welcoming intro."]});
        await speakText(openingMessage);
      } catch (e) {}

      checkAudio();

    } catch (error) {
      options.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }, [options, speakText, generateAssistantMessage]);

  const endSession = useCallback(async () => {
    sessionStateRef.current = "idle";
    isListeningRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (audioContextRef.current) audioContextRef.current.close();
    conversationHistoryRef.current = [];
    options.onDisconnect?.();
  }, [options]);

  const setMuted = useCallback((muted: boolean) => { isMutedRef.current = muted; }, []);
  const sendContextualUpdate = useCallback((message: string) => { contextualInfoRef.current = message; }, []);
  const sendUserActivity = useCallback(() => {}, []);
  const requestSilenceResponse = useCallback(async () => { return ""; }, []);

  return { startSession, endSession, setMuted, sendContextualUpdate, sendUserActivity, requestSilenceResponse };
};
