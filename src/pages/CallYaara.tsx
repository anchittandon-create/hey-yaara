import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFreeConversation } from "@/hooks/use-free-conversation";
import { useNavigate } from "react-router-dom";
import { Mic, MicOff, PhoneOff, Eye, EyeOff, ArrowLeft, AudioLines } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import VoiceOrb from "@/components/VoiceOrb";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  YAARA_AGENT_PROMPT,
  YAARA_FIRST_MESSAGE,
} from "@/lib/yaara-agent";
import { useDeviceType } from "@/hooks/use-device-type";

type CallState = "idle" | "connecting" | "active";
type TranscriptRole = "user" | "yaara" | "system";
type TranscriptStatus = "live" | "final";
type ListeningState = "idle" | "listening" | "user-speaking" | "user-thinking" | "yaara-speaking";

interface TranscriptEntry {
  id: string;
  role: TranscriptRole;
  text: string;
  status: TranscriptStatus;
}

const INITIAL_SILENCE_MS = 6000;
const MID_CONVERSATION_SILENCE_MS = 5000;
const TURN_END_SILENCE_MS = 1800;
const INTERRUPTION_VAD_THRESHOLD = 0.72;
const INTERRUPTION_HOLD_MS = 240;

// Silence handling stages
const SILENCE_STAGE_1_MS = 3000; // Short silence
const SILENCE_STAGE_2_MS = 6000; // Medium silence
const SILENCE_STAGE_3_MS = 10000; // Long silence

const getMessageText = (message: any) => {
  const candidates = [
    message?.text,
    message?.message,
    message?.user_transcript,
    message?.agent_response,
    message?.transcript,
    message?.user_transcription_event?.user_transcript,
    message?.user_transcription_event?.text,
    message?.agent_response_event?.agent_response,
    message?.agent_response_event?.text,
  ];

  return candidates.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() ?? "";
};

const parseConversationMessage = (
  message: any,
): { role: "user" | "yaara"; text: string; status: TranscriptStatus } | null => {
  const type = String(message?.type ?? "").toLowerCase();
  const text = getMessageText(message);

  if (!text) {
    return null;
  }

  const isUser = type.includes("user");
  const isYaara = type.includes("agent") || type.includes("assistant");

  if (!isUser && !isYaara) {
    return null;
  }

  const isTentative =
    type.includes("tentative") ||
    type.includes("progress") ||
    message?.is_final === false ||
    message?.final === false ||
    message?.user_transcription_event?.is_final === false ||
    message?.agent_response_event?.is_final === false;

  return {
    role: isUser ? "user" : "yaara",
    text,
    status: isTentative ? "live" : "final",
  };
};

const CallYaara = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const deviceType = useDeviceType();
  const [callState, setCallState] = useState<CallState>("idle");
  const [showTranscript, setShowTranscript] = useState(true);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [listeningState, setListeningState] = useState<ListeningState>("idle");
  const [helperText, setHelperText] = useState("Aap aaram se boliye. Main dhyan se sun raha hoon.");
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [vadScore, setVadScore] = useState(0);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const highVadSinceRef = useRef<number | null>(null);
  const lastSpeechAtRef = useRef<number | null>(null);
  const hasUserSpokenRef = useRef(false);
  const silencePromptStageRef = useRef(0);
  const isYaaraSpeakingRef = useRef(false);
  const sessionRef = useRef<any>(null);
  const pendingActionsRef = useRef<Array<() => void>>([]);

  // Recording state
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const upsertTranscript = useCallback(
    (role: TranscriptRole, text: string, status: TranscriptStatus = "final") => {
      setTranscripts((prev) => {
        const next = [...prev];
        const lastEntry = next[next.length - 1];

        if (status === "live" && lastEntry && lastEntry.role === role && lastEntry.status === "live") {
          lastEntry.text = text;
          return next;
        }

        if (status === "final" && lastEntry && lastEntry.role === role && lastEntry.status === "live") {
          lastEntry.text = text;
          lastEntry.status = "final";
          return next;
        }

        next.push({
          id: `${Date.now()}-${Math.random()}`,
          role,
          text,
          status,
        });
        return next;
      });
    },
    [],
  );

  const resetSilenceTracking = useCallback((helperOverride?: string) => {
    hasUserSpokenRef.current = false;
    silencePromptStageRef.current = 0;
    highVadSinceRef.current = null;
    lastSpeechAtRef.current = null;
    setVadScore(0);
    setListeningState("listening");
    setHelperText(helperOverride ?? "Aap aaram se boliye. Main dhyan se sun raha hoon.");
  }, []);

  // Session-dependent SDK call helpers
  const hasActiveSession = useCallback(() => {
    return sessionRef.current && isSessionActive;
  }, [isSessionActive]);

  const safeSendContextualUpdate = useCallback((message: string) => {
    try {
      if (!hasActiveSession()) {
        console.debug("Session not active, queuing contextual update");
        return;
      }
      if (typeof sessionRef.current?.sendContextualUpdate === "function") {
        sessionRef.current.sendContextualUpdate(message);
      }
    } catch (err) {
      console.error("Failed to send contextual update:", err);
    }
  }, [hasActiveSession]);

  const safeSendUserActivity = useCallback(() => {
    try {
      if (!hasActiveSession()) {
        return;
      }
      if (typeof sessionRef.current?.sendUserActivity === "function") {
        sessionRef.current.sendUserActivity();
      }
    } catch (err) {
      console.error("Failed to send user activity:", err);
    }
  }, [hasActiveSession]);

  const safeSetMuted = useCallback((value: boolean) => {
    try {
      if (!hasActiveSession()) {
        console.debug("Session not active, ignoring setMuted call");
        return;
      }
      if (typeof sessionRef.current?.setMuted === "function") {
        sessionRef.current.setMuted(value);
      }
    } catch (err) {
      console.error("Failed to set muted state:", err);
    }
  }, [hasActiveSession]);

  const safeEndSession = useCallback(async () => {
    try {
      if (sessionRef.current && typeof sessionRef.current?.endSession === "function") {
        await sessionRef.current.endSession();
      }
    } catch (err) {
      console.error("Failed to end session:", err);
    }
  }, []);

  // Recording functions
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      recordedChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000); // Collect data every second
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null);
        return;
      }

      const recorder = mediaRecorderRef.current;

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });

        // Stop all tracks
        recorder.stream.getTracks().forEach(track => track.stop());

        resolve(blob);
      };

      recorder.stop();
    });
  }, []);

  const saveCallData = useCallback(async (callId: string, startTime: Date, transcripts: TranscriptEntry[], audioBlob: Blob | null) => {
    try {
      const endTime = new Date();
      const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

      const callData = {
        id: callId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration,
        status: 'completed' as const,
        transcript: transcripts.map(t => ({
          id: t.id,
          role: t.role,
          text: t.text,
          timestamp: t.timestamp.toISOString(),
          status: t.status,
        })),
        audioBlob: audioBlob ? await blobToBase64(audioBlob) : null,
      };

      // Load existing calls
      const existingCalls = JSON.parse(localStorage.getItem('yaara_calls') || '[]');

      // Add new call
      existingCalls.push(callData);

      // Save back to localStorage
      localStorage.setItem('yaara_calls', JSON.stringify(existingCalls));

    } catch (error) {
      console.error('Error saving call data:', error);
    }
  }, []);

  // Helper function to convert blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Process any queued actions after session becomes active
  const processQueuedActions = useCallback(() => {
    while (pendingActionsRef.current.length > 0) {
      const action = pendingActionsRef.current.shift();
      if (action) {
        try {
          action();
        } catch (err) {
          console.error("Failed to process queued action:", err);
        }
      }
    }
  }, []);

  const conversation = useFreeConversation({
    overrides: {
      agent: {
        prompt: {
          prompt: YAARA_AGENT_PROMPT,
        },
        firstMessage: YAARA_FIRST_MESSAGE,
      },
    },
    onConnect: () => {
      // Store the session reference
      sessionRef.current = conversation;

      setIsSessionActive(true);
      setIsInitializing(false);
      setCallState("active");
      resetSilenceTracking("Namaste. Main yahin hoon. Aap aaram se boliye.");

      // Send contextual update via safe wrapper
      safeSendContextualUpdate(
        "The current user may be elderly, may speak slowly, and may pause often. Be calm, patient, and use short supportive sentences.",
      );

      // Process any queued actions
      processQueuedActions();
    },
    onDisconnect: () => {
      // Clear session reference
      sessionRef.current = null;
      
      setIsSessionActive(false);
      setIsInitializing(false);
      setCallState("idle");
      setListeningState("idle");
      setHelperText("Jab chahein dobara baat kar sakte hain.");
    },
    onModeChange: (mode: any) => {
      if (!isSessionActive) return;

      const nextMode = String(mode?.mode ?? mode ?? "").toLowerCase();
      const isSpeaking = nextMode.includes("speak");

      isYaaraSpeakingRef.current = isSpeaking;

      if (isSpeaking) {
        setListeningState("yaara-speaking");
        setHelperText("Yaara bol raha hai...");
      } else {
        setListeningState("listening");
        setHelperText("Main sun raha hoon...");
      }
    },
    onVadScore: (score: number) => {
      if (!isSessionActive) return;

      const now = Date.now();
      setVadScore(score);

      if (score >= INTERRUPTION_VAD_THRESHOLD) {
        if (!highVadSinceRef.current) {
          highVadSinceRef.current = now;
        }

        const speechHeldLongEnough = now - highVadSinceRef.current >= INTERRUPTION_HOLD_MS;

        if (speechHeldLongEnough) {
          hasUserSpokenRef.current = true;
          lastSpeechAtRef.current = now;
          silencePromptStageRef.current = 0;

          if (isYaaraSpeakingRef.current) {
            safeSendUserActivity();
          }

          setListeningState("user-speaking");
          setHelperText("Main sun raha hoon...");
        }
      } else {
        highVadSinceRef.current = null;

        if (!isYaaraSpeakingRef.current && lastSpeechAtRef.current) {
          const silenceSinceSpeech = now - lastSpeechAtRef.current;

          if (silenceSinceSpeech < TURN_END_SILENCE_MS) {
            setListeningState("user-thinking");
            setHelperText("Aaram se boliye... main sun raha hoon.");
          } else {
            setListeningState("listening");
            setHelperText("Main sun raha hoon...");
          }
        }
      }
    },
    onMessage: (message: any) => {
      if (!isSessionActive) return;

      const parsed = parseConversationMessage(message);

      if (!parsed) {
        return;
      }

      if (parsed.role === "user") {
        hasUserSpokenRef.current = true;
        lastSpeechAtRef.current = Date.now();
        silencePromptStageRef.current = 0;
      }

      upsertTranscript(parsed.role, parsed.text, parsed.status);
    },
    onError: (error) => {
      console.error("Conversation error:", error);
      setIsSessionActive(false);
      setIsInitializing(false);
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Thoda samajh nahi aaya, dobara bolenge?",
      });
      setCallState("idle");
      setListeningState("idle");
    },
  });

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  useEffect(() => {
    if (callState !== "active") {
      if (silenceTimerRef.current) {
        window.clearInterval(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      return;
    }

    silenceTimerRef.current = window.setInterval(() => {
      if (isYaaraSpeakingRef.current || isMicMuted) {
        return;
      }

      const now = Date.now();
      const lastSpeechAt = lastSpeechAtRef.current;

      if (!hasUserSpokenRef.current) {
        // Initial silence handling (user hasn't spoken at all)
        const silenceDuration = now - (lastSpeechAt || now);

        if (silenceDuration >= SILENCE_STAGE_3_MS && silencePromptStageRef.current < 3) {
          const guidance = "Theek hai, main yahin hoon. Jab mann kare baat kar lena.";
          setHelperText(guidance);
          upsertTranscript("system", guidance);
          silencePromptStageRef.current = 3;
        } else if (silenceDuration >= SILENCE_STAGE_2_MS && silencePromptStageRef.current < 2) {
          const guidance = "Aap kuch kehna chahte hain?";
          setHelperText(guidance);
          upsertTranscript("system", guidance);
          silencePromptStageRef.current = 2;
        } else if (silenceDuration >= SILENCE_STAGE_1_MS && silencePromptStageRef.current < 1) {
          const guidance = "Main sun raha hoon…";
          setHelperText(guidance);
          upsertTranscript("system", guidance);
          silencePromptStageRef.current = 1;
        }
        return;
      }

      // Mid-conversation silence handling (user has spoken before)
      if (lastSpeechAt && now - lastSpeechAt >= MID_CONVERSATION_SILENCE_MS && silencePromptStageRef.current === 0) {
        const guidance = "Aap ruk gaye... boliye, main sun raha hoon.";
        setHelperText(guidance);
        upsertTranscript("system", guidance);
        silencePromptStageRef.current = 1;
      }
    }, 1000); // Check every second for more responsive silence handling

    return () => {
      if (silenceTimerRef.current) {
        window.clearInterval(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };
  }, [callState, isMicMuted, upsertTranscript]);

  useEffect(() => {
    if (!isSessionActive) {
      return;
    }

    safeSetMuted(isMicMuted);
  }, [isMicMuted, safeSetMuted]);

  const transcriptPanel = useMemo(() => {
    if (!showTranscript) {
      return null;
    }

    return (
      <div className="w-full rounded-[30px] bg-card/90 p-4 shadow-sm md:h-full md:min-h-[420px] md:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-extrabold text-foreground">Conversation</h3>
            <p className="text-base font-semibold text-muted-foreground">Jo baat ho rahi hai, yahan dikhegi</p>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-2 text-primary">
            <AudioLines className="h-5 w-5" />
          </span>
        </div>

        <div className="max-h-[34vh] space-y-3 overflow-y-auto pr-1 md:max-h-[58vh] lg:max-h-[65vh]">
          {transcripts.length === 0 ? (
            <div className="rounded-2xl bg-background px-4 py-5 text-elderly-base text-muted-foreground">
              Baat shuru hote hi yahan sab dikhega.
            </div>
          ) : (
            transcripts.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  "rounded-2xl px-4 py-4 text-elderly-base leading-relaxed",
                  entry.role === "yaara" && "mr-auto max-w-[90%] bg-background text-foreground",
                  entry.role === "user" && "ml-auto max-w-[90%] bg-primary text-primary-foreground",
                  entry.role === "system" && "border border-dashed border-border bg-background text-muted-foreground",
                  entry.status === "live" && "opacity-80",
                )}
              >
                <span className="mb-1 block text-sm font-bold opacity-70">
                  {entry.role === "yaara" ? "Yaara" : entry.role === "user" ? "Aap" : "Dhyan se sun raha hoon"}
                </span>
                {entry.text}
              </div>
            ))
          )}
          <div ref={transcriptEndRef} />
        </div>
      </div>
    );
  }, [showTranscript, transcripts]);

  const startCall = useCallback(async () => {
    // Check if conversation object is available
    if (!conversation) {
      console.error("Conversation object not available");
      toast({
        variant: "destructive",
        title: "Technical Issue",
        description: "Thoda problem ho gaya. Dobara try kijiye.",
      });
      setIsInitializing(false);
      setCallState("idle");
      return;
    }

    setIsInitializing(true);
    setCallState("connecting");
    setTranscripts([]);
    setIsMicMuted(false);
    resetSilenceTracking("Yaara se jodne ki koshish ho rahi hai...");

    try {
      // Generate call ID and set start time
      const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setCurrentCallId(callId);
      setCallStartTime(new Date());

      // Start recording
      await startRecording();
      // Request microphone access
      try {
        await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (micErr) {
        console.error("Microphone access failed:", micErr);
        toast({
          variant: "destructive",
          title: "Microphone Access",
          description: "Yaara ko aapki microphone access chahiye. Phir se try kijiye.",
        });
        setIsInitializing(false);
        setCallState("idle");
        return;
      }

      // Start session with free conversation
      await conversation.startSession();
    } catch (err) {
      console.error("Session start failed:", err);
      setIsSessionActive(false);
      setIsInitializing(false);
      setCallState("idle");

      // Show user-friendly error message
      const errorMsg =
        err instanceof Error && err.message
          ? err.message
          : "Connection issue, trying again...";

      toast({
        variant: "destructive",
        title: "Connection Failed",
        description:
          errorMsg.length > 50
            ? "Thodi problem aa rahi hai, dobara try karte hain"
            : errorMsg,
      });
    }
  }, [conversation, resetSilenceTracking, toast]);

  const endCall = useCallback(async () => {
    setIsSessionActive(false);
    setIsInitializing(false);
    await safeEndSession();
    setCallState("idle");
    setListeningState("idle");
    setHelperText("Theek hai. Main yahin hoon, jab chaho phir baat karenge.");
    upsertTranscript("yaara", "Theek hai. Main yahin hoon, jab chaho phir baat karenge.");

    // Stop recording and save call data
    if (currentCallId && callStartTime) {
      const audioBlob = await stopRecording();
      await saveCallData(currentCallId, callStartTime, transcripts, audioBlob);
    }

    // Reset call state
    setCurrentCallId(null);
    setCallStartTime(null);
  }, [safeEndSession, upsertTranscript, currentCallId, callStartTime, transcripts, stopRecording, saveCallData]);

  const statusLabel = useMemo(() => {
    if (isInitializing) {
      return "Yaara aapke liye tayyar ho raha hai...";
    }

    if (callState === "connecting") {
      return "Connection ho rahi hai...";
    }

    if (callState === "idle") {
      return "Ek tap se baat shuru hogi.";
    }

    if (isMicMuted) {
      return "Mic mute hai.";
    }

    if (listeningState === "yaara-speaking") {
      return "Yaara bol raha hai.";
    }

    if (listeningState === "user-speaking") {
      return "Main sun raha hoon.";
    }

    if (listeningState === "user-thinking") {
      return "Aaram se boliye.";
    }

    return helperText;
  }, [callState, helperText, isMicMuted, listeningState, isInitializing]);

  // Safe handler for mute button that queues action if session not ready
  const handleMuteToggle = useCallback(() => {
    if (!isSessionActive && !isInitializing) {
      // Session not initialized and not initializing - show error
      toast({
        variant: "destructive",
        title: "Not Ready",
        description: "Pehle Yaara se connect ho jaiye.",
      });
      return;
    }

    if (isInitializing) {
      // Queue action for when session becomes active
      pendingActionsRef.current.push(() => {
        setIsMicMuted((current) => !current);
      });
      console.debug("Mute action queued, will execute when session is ready");
      return;
    }

    // Session is active, toggle immediately
    setIsMicMuted((current) => !current);
  }, [isSessionActive, isInitializing, toast]);

  const showSplitConversationLayout = callState !== "idle" && deviceType !== "mobile";
  const showDesktopTranscript = deviceType === "desktop";
  const orbSize = deviceType === "desktop" ? "xl" : "lg";

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="mx-auto flex min-h-screen w-full max-w-screen-2xl flex-col px-4 md:px-8 lg:px-12">
        <div className="flex items-center gap-3 pt-6 pb-4 md:pt-8 md:pb-5">
          <button
            onClick={() => {
              if (callState === "active") {
                endCall();
              }
              navigate("/");
            }}
            className="rounded-full bg-card p-3 shadow-sm"
            aria-label="Back"
          >
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </button>

          <div>
            <h2 className="text-elderly-lg font-extrabold text-foreground md:text-[1.9rem]">Talking to Yaara</h2>
            <p className="text-base font-semibold text-muted-foreground lg:text-[1.2rem]">Aaraam se baat kijiye, Yaara saath hai</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col pb-6">
          {callState === "idle" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 lg:grid lg:grid-cols-[1.3fr_0.7fr] lg:items-stretch lg:gap-8">
              <div className="flex w-full flex-1 flex-col items-center justify-center gap-6 rounded-[34px] bg-gradient-to-b from-card to-background px-6 py-10 text-center shadow-sm md:min-h-[68vh]">
                <VoiceOrb size={orbSize} />
                <p className="max-w-2xl text-center text-elderly-lg font-semibold text-muted-foreground md:text-[1.55rem]">
                  Yaara aapki baat dhyan se sunega. Aap Hindi, English, Punjabi ya mix mein bol sakte hain.
                </p>
                <div className="flex items-end gap-2">
                  {[0, 1, 2, 3, 4].map((index) => (
                    <span
                      key={index}
                      className="animate-voice-wave w-2 rounded-full bg-primary/60"
                      style={{ height: `${18 + index * 6}px`, animationDelay: `${index * 0.15}s` }}
                    />
                  ))}
                </div>
                <button
                  onClick={startCall}
                  className="rounded-full bg-yaara-green px-10 py-5 text-elderly-lg font-bold text-secondary-foreground shadow-lg transition-transform active:scale-95 hover:scale-[1.01]"
                >
                  Talk to Yaara
                </button>
              </div>
            </div>
          )}

        {callState !== "idle" && (
          <div className={showSplitConversationLayout ? "grid flex-1 gap-5 md:grid-cols-[0.95fr_1.05fr] lg:grid-cols-[0.9fr_1.1fr] lg:gap-8" : "flex flex-1 flex-col gap-5"}>
            <div className="flex h-full flex-col gap-5">
              <div className="flex flex-1 flex-col items-center justify-center gap-5 rounded-[34px] bg-gradient-to-b from-card to-background px-6 py-8 text-center shadow-sm md:min-h-[calc(100vh-270px)] lg:min-h-[calc(100vh-250px)]">
                <VoiceOrb
                  size={orbSize}
                  isActive
                  isListening={callState === "active" && listeningState !== "yaara-speaking"}
                />
                <div className="flex items-end gap-2">
                  {[0, 1, 2, 3, 4].map((index) => (
                    <span
                      key={index}
                      className={cn(
                        "w-2 rounded-full bg-primary/70",
                        callState === "connecting" || listeningState !== "yaara-speaking" ? "animate-voice-wave" : "opacity-40",
                      )}
                      style={{ height: `${18 + index * 6}px`, animationDelay: `${index * 0.12}s` }}
                    />
                  ))}
                </div>
                <div className="space-y-2">
                  <p className="text-elderly-lg font-extrabold text-foreground md:text-[1.8rem]">{statusLabel}</p>
                  <p className="text-base font-semibold text-muted-foreground lg:text-[1.2rem]">
                      {isInitializing
                        ? "Thoda ezdaar raha... abhi tayyar hota hoon."
                        : callState === "connecting"
                          ? "Connection ho rahi hai..."
                          : vadScore >= INTERRUPTION_VAD_THRESHOLD
                            ? "Aapki awaaz mil gayi hai."
                            : "Background noise ko ignore karne ki koshish ho rahi hai."}
                    </p>
                  </div>
                </div>

                {!showSplitConversationLayout && transcriptPanel}

                <div className="mt-auto grid grid-cols-3 gap-3 pt-2 md:gap-4">
                  <button
                    onClick={handleMuteToggle}
                    disabled={!isSessionActive}
                    className={cn(
                      "flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-[28px] px-3 text-base font-bold shadow-sm transition-transform active:scale-95 hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed md:min-h-[104px]",
                      isMicMuted ? "bg-muted text-foreground" : "bg-card text-foreground",
                    )}
                  >
                    {isMicMuted ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
                    {isMicMuted ? "Unmute" : "Mute"}
                  </button>

                  <button
                    onClick={endCall}
                    className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-[28px] bg-destructive px-3 text-base font-bold text-destructive-foreground shadow-sm transition-transform active:scale-95 hover:scale-[1.01] md:min-h-[104px]"
                  >
                    <PhoneOff className="h-7 w-7" />
                    End
                  </button>

                  <button
                    onClick={() => setShowTranscript((current) => !current)}
                    className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-[28px] bg-card px-3 text-base font-bold text-foreground shadow-sm transition-transform active:scale-95 hover:scale-[1.01] md:min-h-[104px]"
                  >
                    {showTranscript ? <EyeOff className="h-7 w-7" /> : <Eye className="h-7 w-7" />}
                    {showTranscript ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {showSplitConversationLayout && (
                <div className={showDesktopTranscript ? "h-full min-h-[calc(100vh-220px)]" : "h-full"}>{transcriptPanel}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallYaara;
