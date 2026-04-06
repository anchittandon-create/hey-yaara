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

// Type declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
    SpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

// Initialize Web Speech API based on browser
const SpeechRecognition = (window as Window & typeof globalThis).SpeechRecognition || (window as Window & typeof globalThis).webkitSpeechRecognition;
const SpeechSynthesisAPI = window.speechSynthesis;

const pickPreferredVoice = () => {
  if (!SpeechSynthesisAPI) {
    return null;
  }

  const voices = SpeechSynthesisAPI.getVoices();

  return (
    voices.find((voice) => /hi-|en-in|pa-/i.test(voice.lang)) ||
    voices.find((voice) => /female|zira|google हिन्दी|google indian english/i.test(voice.name)) ||
    voices[0] ||
    null
  );
};

export const useFreeConversation = (options: UseConversationOptions): ConversationSession => {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const isListeningRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const isMutedRef = useRef(false);
  const conversationHistoryRef = useRef<Array<{ role: string; content: string; processing?: boolean }>>([]);
  const processUserMessageRef = useRef<((userTranscript: string) => Promise<void>) | null>(null);
  const silenceTimeoutRef = useRef<number | null>(null);
  const vadScoreRef = useRef(0);
  const sessionStateRef = useRef<"idle" | "active" | "speaking">("idle");
  const contextualInfoRef = useRef("");

  const openAiApiKey = (import.meta.env as Record<string, unknown>)["VITE_OPENAI_API_KEY"] as string ||
    (window as Window & typeof globalThis)["VITE_OPENAI_API_KEY"] || "";
  const apiKey = (import.meta.env as Record<string, unknown>)["VITE_LLM_API_KEY"] as string ||
    (window as Window & typeof globalThis)["VITE_LLM_API_KEY"] ||
    openAiApiKey;
  const llmProvider = ((import.meta.env as Record<string, unknown>)["VITE_LLM_PROVIDER"] as string) ||
    (window as Window & typeof globalThis)["VITE_LLM_PROVIDER"] ||
    (openAiApiKey ? "openai" : "groq");
  const openAiModel = ((import.meta.env as Record<string, unknown>)["VITE_OPENAI_MODEL"] as string) || "gpt-4o-mini";
  const groqModel = ((import.meta.env as Record<string, unknown>)["VITE_GROQ_MODEL"] as string) || "mixtral-8x7b-32768";

  // Initialize speech recognition
  useEffect(() => {
    if (!SpeechRecognition) {
      console.warn("Speech Recognition API not supported");
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = "en-IN"; // Default to Indian English
    recognitionRef.current.maxAlternatives = 1;

    recognitionRef.current.onstart = () => {
      isListeningRef.current = true;
      sessionStateRef.current = "active";
      options.onModeChange?.({ mode: "listening" });
    };

    recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
      let isFinal = false;
      let transcript = "";
      let maxConfidence = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPart = event.results[i][0].transcript;
        const confidence = event.results[i][0].confidence;
        transcript = transcriptPart;
        isFinal = event.results[i].isFinal;
        maxConfidence = Math.max(maxConfidence, confidence);
      }

      vadScoreRef.current = maxConfidence;
      options.onVadScore?.(maxConfidence);

      if (transcript.trim()) {
        options.onMessage?.({
          type: isFinal ? "user_transcript_final" : "user_transcript",
          user_transcript: transcript,
          is_final: isFinal,
        });

        if (isFinal) {
          // Add to conversation history for processing
          conversationHistoryRef.current.push({
            role: "user",
            content: transcript.trim(),
            processing: true,
          });

          // Reset silence timeout
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
          }

          // Pause recognition while we process this turn
          recognitionRef.current?.stop();

          // Process the finalized user transcript immediately
          processUserMessageRef.current?.(transcript.trim()).catch((error) => {
            console.error("Failed to process user message:", error);
          });
        }
      }
    };

    recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      if (event.error !== "no-speech") {
        options.onError?.(new Error(`Speech recognition error: ${event.error}`));
      }
    };

    recognitionRef.current.onend = () => {
      isListeningRef.current = false;
      console.debug("Speech recognition ended", {
        isSpeaking: isSpeakingRef.current,
        isProcessing: isProcessingRef.current,
      });

      if (
        sessionStateRef.current !== "idle" &&
        !isSpeakingRef.current &&
        !isProcessingRef.current &&
        !isMutedRef.current
      ) {
        setTimeout(() => {
          if (recognitionRef.current && !isListeningRef.current) {
            try {
              recognitionRef.current.start();
              console.debug("Restarting speech recognition after end");
            } catch (error) {
              console.warn("Could not restart speech recognition:", error);
              options.onError?.(new Error("Could not restart speech recognition"));
            }
          }
        }, 300);
      }
    };
  }, [options]);

  // Initialize speech synthesis
  useEffect(() => {
    if (!SpeechSynthesisAPI) {
      console.warn("Speech Synthesis API not supported");
      return;
    }
    synthesisRef.current = SpeechSynthesisAPI;
  }, []);

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
    [options],
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
        throw new Error("LLM API key is missing. Set VITE_OPENAI_API_KEY or VITE_LLM_API_KEY.");
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

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        assistantMessage = result?.choices?.[0]?.message?.content?.trim() ?? null;
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

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Groq API error: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        assistantMessage = result?.choices?.[0]?.message?.content?.trim() ?? null;
      }

        if (!assistantMessage) {
          throw new Error("No response generated by the LLM.");
        }

        return assistantMessage;
      } catch (error) {
        console.error("LLM API call failed:", error);
        throw error;
      }
    },
    [buildMessages],
  );

  const callLLM = useCallback(
    async (userMessage: string): Promise<string> => {
      if (!userMessage.trim()) {
        throw new Error("Cannot generate a reply without user input.");
      }

      const assistantMessage = await generateAssistantMessage({
        extraSystemMessages: [
          "Respond to the latest user message naturally.",
          "Do not repeat or paraphrase the user's words unless absolutely necessary.",
          "Add a fresh reaction, gentle continuation, or helpful next step.",
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
    [generateAssistantMessage],
  );

  const speakText = useCallback(
    (text: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!SpeechSynthesisAPI || isMutedRef.current) {
          resolve();
          return;
        }

        // Cancel any ongoing speech
        SpeechSynthesisAPI.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-IN";
        utterance.rate = 0.9; // Slower for elderly
        utterance.pitch = 1;
        utterance.volume = 1;
        utterance.voice = pickPreferredVoice();

        isSpeakingRef.current = true;
        sessionStateRef.current = "speaking";
        options.onModeChange?.({ mode: "speaking" });

        // Split text into words for progressive display
        const words = text.split(' ');
        let currentWordIndex = 0;

        // Show progressive transcription as speech happens
        const showProgressiveText = () => {
          if (currentWordIndex < words.length) {
            const partialText = words.slice(0, currentWordIndex + 1).join(' ');
            options.onMessage?.({
              type: "agent_response_progress",
              agent_response: partialText,
              is_final: false,
            });
            currentWordIndex++;
          }
        };

        // Start progressive display
        const progressInterval = setInterval(showProgressiveText, 200); // Show words every 200ms

        utterance.onstart = () => {
          // Show first word immediately
          showProgressiveText();
        };

        utterance.onend = () => {
          clearInterval(progressInterval);
          isSpeakingRef.current = false;
          sessionStateRef.current = "active";
          options.onModeChange?.({ mode: "listening" });

          // Send final message to ensure complete text is shown
          options.onMessage?.({
            type: "agent_response_final",
            agent_response: text,
            is_final: true,
          });

          resolve();
        };

        utterance.onerror = (error) => {
          clearInterval(progressInterval);
          isSpeakingRef.current = false;
          reject(new Error(`Speech synthesis error: ${error.error}`));
        };

        SpeechSynthesisAPI.speak(utterance);
      });
    },
    [options],
  );

  const requestSilenceResponse = useCallback(async (reason: string = "general"): Promise<string> => {
    try {
      const stageInstruction =
        reason === "opening"
          ? "The conversation is just starting. Greet the user warmly, invite them to speak, and keep it fresh and natural."
          : reason === "short-initial"
            ? "The conversation has started, but the user has not spoken yet. Offer a very gentle, natural first nudge."
          : reason === "mid-conversation"
            ? "The user paused mid-conversation. Gently encourage them to continue without sounding scripted."
            : reason === "long-initial"
              ? "The user has stayed silent for a while at the beginning. Offer a soft, patient prompt that feels new and caring."
              : reason === "medium-initial"
                ? "The user still has not spoken yet. Invite them gently in a fresh way."
                : "The user is quiet. Generate a short, gentle continuation in Yaara's voice without using canned phrases.";

      const assistantMessage = await generateAssistantMessage({
        extraSystemMessages: [
          stageInstruction,
          "Do not mention silence directly in a repetitive way.",
          "Do not use stock phrases or repeated reminders.",
          "Keep the reply natural, short, and slightly varied from previous prompts.",
        ],
        maxTokens: 128,
        temperature: 1,
      });

      conversationHistoryRef.current.push({
        role: "assistant",
        content: assistantMessage,
      });

      return assistantMessage;
    } catch (error) {
      console.error("LLM silence prompt failed:", error);
      throw error;
    }
  }, [generateAssistantMessage]);

  const processUserMessage = useCallback(
    async (userTranscript: string) => {
      isProcessingRef.current = true;
      console.debug("PROCESSING -> SPEAKING", { transcript: userTranscript });
      options.onModeChange?.({ mode: "processing" });

      try {
        // Pause listening while processing
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }

        // Get response from LLM
        const agentResponse = await callLLM(userTranscript);

        // Speak the response (progressive display will happen here)
        await speakText(agentResponse);

        // Resume listening after a short delay
        setTimeout(() => {
          if (recognitionRef.current && sessionStateRef.current !== "idle") {
            try {
              recognitionRef.current.start();
              console.debug("PROCESSING complete, restarting listening");
            } catch (error) {
              console.warn("Could not resume listening:", error);
            }
          }
        }, 200); // Reduced delay for more immediate turn-taking

      } catch (error) {
        console.error("Error processing message:", error);
        options.onError?.(error instanceof Error ? error : new Error(String(error)));

        // Try to resume listening even on error
        setTimeout(() => {
          if (recognitionRef.current && sessionStateRef.current !== "idle") {
            try {
              recognitionRef.current.start();
            } catch (error) {
              console.warn("Could not resume listening after error:", error);
            }
          }
        }, 1000);
      } finally {
        isProcessingRef.current = false;
      }
    },
    [callLLM, speakText, options],
  );

  useEffect(() => {
    processUserMessageRef.current = processUserMessage;
  }, [processUserMessage]);

  const startSession = useCallback(async () => {
    try {
      conversationHistoryRef.current = [];
      sessionStateRef.current = "active";

      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      options.onConnect?.();

      try {
        const openingMessage = await requestSilenceResponse("opening");
        await speakText(openingMessage);
      } catch (error) {
        console.error("Opening line failed, continuing with listening mode:", error);
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (error) {
          console.warn("Could not start listening:", error);
          options.onError?.(new Error("Could not start speech recognition"));
        }
      }
    } catch (error) {
      console.error("Failed to start session:", error);
      options.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }, [options, requestSilenceResponse, speakText]);

  const endSession = useCallback(async () => {
    sessionStateRef.current = "idle";

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    if (SpeechSynthesisAPI) {
      SpeechSynthesisAPI.cancel();
    }

    conversationHistoryRef.current = [];
    options.onDisconnect?.();
  }, [options]);

  const setMuted = useCallback((muted: boolean) => {
    isMutedRef.current = muted;
  }, []);

  const sendContextualUpdate = useCallback((message: string) => {
    contextualInfoRef.current = message;
  }, []);

  const sendUserActivity = useCallback(() => {
    // Reset silence detection timeout
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }

    // If AI is currently speaking and user interrupts, stop the speech
    if (isSpeakingRef.current && SpeechSynthesisAPI) {
      SpeechSynthesisAPI.cancel();
      isSpeakingRef.current = false;
      sessionStateRef.current = "active";
      options.onModeChange?.({ mode: "listening" });

      // Resume listening after brief pause
      setTimeout(() => {
        if (recognitionRef.current && sessionStateRef.current !== "idle") {
          try {
            recognitionRef.current.start();
          } catch (error) {
            console.warn("Could not resume listening after interruption:", error);
          }
        }
      }, 300); // Brief pause before resuming listening
    }
  }, [options]);

  return {
    startSession,
    endSession,
    setMuted,
    sendContextualUpdate,
    sendUserActivity,
    requestSilenceResponse,
  };
};
