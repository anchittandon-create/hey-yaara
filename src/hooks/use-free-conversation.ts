import * as React from "react";
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

export const useFreeConversation = (options: UseConversationOptions): ConversationSession => {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const isListeningRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isMutedRef = useRef(false);
  const conversationHistoryRef = useRef<Array<{ role: string; content: string; processing?: boolean }>>([]);
  const silenceTimeoutRef = useRef<number | null>(null);
  const vadScoreRef = useRef(0);
  const sessionStateRef = useRef<"idle" | "active" | "speaking">("idle");
  const contextualInfoRef = useRef("");

  // Get env vars from window or use defaults
  const getEnvVar = useCallback((key: string, defaultValue: string = "") => {
    return (window as Window & typeof globalThis)[`VITE_${key}`] || defaultValue;
  }, []);

  const apiKey = getEnvVar("LLM_API_KEY", "");
  const llmProvider = getEnvVar("LLM_PROVIDER", "groq");

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
            processing: false,
          });

          // Reset silence timeout
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
          }

          // Pause recognition to process response, then resume
          recognitionRef.current?.stop();
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

  const callLLM = useCallback(
    async (userMessage: string): Promise<string> => {
      const systemPrompt =
        options.overrides?.agent?.prompt?.prompt ||
        "You are a helpful assistant for elderly people in India. Be warm, patient, and use simple language.";

      conversationHistoryRef.current.push({
        role: "user",
        content: userMessage,
      });

      const messages = conversationHistoryRef.current.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      try {
        let response;

        // Route to appropriate LLM provider
        if (llmProvider === "groq" && apiKey) {
          const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "mixtral-8x7b-32768",
              messages: [
                { role: "system", content: systemPrompt },
                ...messages,
              ],
              max_tokens: 256,
              temperature: 0.7,
            }),
          });

          if (!groqResponse.ok) {
            throw new Error(`Groq API error: ${groqResponse.statusText}`);
          }

          response = await groqResponse.json();
          const assistantMessage = response.choices[0].message.content;

          conversationHistoryRef.current.push({
            role: "assistant",
            content: assistantMessage,
          });

          return assistantMessage;
        }

        // Fallback to mock response for testing
        console.warn("LLM API key not configured, using mock response");
        const mockResponse = `That's interesting. I understand you said: "${userMessage}". Tell me more.`;

        conversationHistoryRef.current.push({
          role: "assistant",
          content: mockResponse,
        });

        return mockResponse;
      } catch (error) {
        console.error("LLM API call failed:", error);
        throw error;
      }
    },
    [options, apiKey, llmProvider],
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

        isSpeakingRef.current = true;
        sessionStateRef.current = "speaking";
        options.onModeChange?.({ mode: "speaking" });

        utterance.onend = () => {
          isSpeakingRef.current = false;
          sessionStateRef.current = "active";
          options.onModeChange?.({ mode: "listening" });
          resolve();
        };

        utterance.onerror = (error) => {
          isSpeakingRef.current = false;
          reject(new Error(`Speech synthesis error: ${error.error}`));
        };

        SpeechSynthesisAPI.speak(utterance);
      });
    },
    [options],
  );

  const processUserMessage = useCallback(
    async (userTranscript: string) => {
      try {
        // Pause listening while processing
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }

        // Get response from LLM
        const agentResponse = await callLLM(userTranscript);

        // Emit agent response message
        options.onMessage?.({
          type: "agent_response_final",
          agent_response: agentResponse,
          is_final: true,
        });

        // Speak the response
        await speakText(agentResponse);

        // Resume listening after a short delay
        setTimeout(() => {
          if (recognitionRef.current && sessionStateRef.current !== "idle") {
            try {
              recognitionRef.current.start();
            } catch (error) {
              console.warn("Could not resume listening:", error);
            }
          }
        }, 500); // Small delay to ensure speech synthesis is complete

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
      }
    },
    [callLLM, speakText, options],
  );

  // Monitor for final transcripts and process them
  useEffect(() => {
    const processPendingMessages = async () => {
      if (conversationHistoryRef.current.length > 0 && !isSpeakingRef.current) {
        const lastEntry = conversationHistoryRef.current[conversationHistoryRef.current.length - 1];
        if (lastEntry.role === "user" && !lastEntry.processing) {
          lastEntry.processing = true;
          await processUserMessage(lastEntry.content);
        }
      }
    };

    // Process any pending messages
    processPendingMessages();
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

      // Send first message
      const firstMessage =
        options.overrides?.agent?.firstMessage || "Namaste! Main yahin hoon. Aap aaram se boliye.";

      // Add first message to history
      conversationHistoryRef.current.push({
        role: "assistant",
        content: firstMessage,
      });

      // Emit first message
      options.onMessage?.({
        type: "agent_response_final",
        agent_response: firstMessage,
        is_final: true,
      });

      // Start listening immediately after first message
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (error) {
          console.warn("Could not start listening:", error);
          options.onError?.(new Error("Could not start speech recognition"));
        }
      }

      // Speak first message (don't await, let it speak while listening starts)
      speakText(firstMessage);

      options.onConnect?.();
    } catch (error) {
      console.error("Failed to start session:", error);
      options.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }, [options, speakText]);

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
  }, []);

  return {
    startSession,
    endSession,
    setMuted,
    sendContextualUpdate,
    sendUserActivity,
  };
};
