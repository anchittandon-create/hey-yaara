import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFreeConversation } from "@/hooks/use-free-conversation";
import { useNavigate } from "react-router-dom";
import { Mic, MicOff, PhoneOff, Eye, EyeOff, ArrowLeft, AudioLines, Phone, FileText } from "lucide-react";
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
  timestamp: Date;
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
  const [isEndingCall, setIsEndingCall] = useState(false);
  const [pendingEndCall, setPendingEndCall] = useState(false);
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
          timestamp: new Date(),
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

      // Add the first message to transcripts
      upsertTranscript("yaara", YAARA_FIRST_MESSAGE, "final");

      // Send contextual update via safe wrapper
      safeSendContextualUpdate(
        "The current user may be elderly, may speak slowly, and may pause often. Be calm, patient, and use short supportive sentences.",
      );

      // Process any queued actions
      processQueuedActions();
    },
    onDisconnect: async () => {
      // Don't automatically end the call - let user decide
      // Just update the connection status
      setIsSessionActive(false);
      setIsInitializing(false);
      setListeningState("idle");

      // If we have call data and this is not a user-initiated end, save it
      if (currentCallId && callStartTime && !isEndingCall) {
        const audioBlob = await stopRecording();
        await saveCallData(currentCallId, callStartTime, transcripts, audioBlob);
        setCurrentCallId(null);
        setCallStartTime(null);
      }

      // Show reconnection message instead of ending call
      setHelperText("Connection khatam ho gaya. 'Reconnect' button dabaiye ya call end kijiye.");
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

        // Check for end call keywords
        const endCallKeywords = [
          'bye', 'goodbye', 'bye bye', 'alvidha', 'alvida', 'end call', 'call end',
          'baat khatam', 'khatam', 'end', 'finish', 'stop', 'ruk jao', 'rukiye'
        ];

        const userText = parsed.text.toLowerCase();
        const hasEndKeyword = endCallKeywords.some(keyword =>
          userText.includes(keyword)
        );

        if (hasEndKeyword && !pendingEndCall) {
          setPendingEndCall(true);
          upsertTranscript("yaara", "Aap call khatam karna chahte hain? 'Haan' ya 'Nahi' boliye.", "final");
          return;
        }

        if (pendingEndCall) {
          const confirmationKeywords = ['haan', 'han', 'yes', 'y', 'ji', 'haa'];
          const denialKeywords = ['nahi', 'na', 'no', 'n', 'nahin'];

          const responseText = parsed.text.toLowerCase();

          if (confirmationKeywords.some(keyword => responseText.includes(keyword))) {
            // User confirmed end call
            setTimeout(() => endCall(), 1000);
            return;
          } else if (denialKeywords.some(keyword => responseText.includes(keyword))) {
            // User denied end call
            setPendingEndCall(false);
            upsertTranscript("yaara", "Theek hai, baat continue karte hain.", "final");
            return;
          }
        }
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
      <div className="w-full rounded-[36px] bg-gradient-to-r from-white/95 to-blue-50/95 p-6 shadow-2xl backdrop-blur-sm md:h-full md:min-h-[420px] md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-extrabold text-gray-800">💬 Conversation</h3>
            <p className="text-lg font-medium text-blue-700">Jo baat ho rahi hai, yahan dikhegi</p>
          </div>
          <span className="rounded-full bg-blue-100 px-4 py-2 text-blue-600">
            <AudioLines className="h-6 w-6" />
          </span>
        </div>

        <div className="max-h-[40vh] space-y-4 overflow-y-auto pr-2 md:max-h-[65vh] lg:max-h-[70vh]">
          {transcripts.length === 0 ? (
            <div className="rounded-3xl bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-8 text-center text-xl font-medium text-blue-700">
              Baat shuru hote hi yahan sab dikhega.
            </div>
          ) : (
            transcripts.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  "rounded-3xl px-6 py-5 text-xl leading-relaxed shadow-lg",
                  entry.role === "yaara" && "mr-auto max-w-[90%] bg-gradient-to-r from-blue-50 to-blue-100 text-gray-800 border-l-4 border-blue-400",
                  entry.role === "user" && "ml-auto max-w-[90%] bg-gradient-to-r from-green-50 to-green-100 text-gray-800 border-l-4 border-green-400",
                  entry.role === "system" && "border-2 border-dashed border-orange-300 bg-gradient-to-r from-orange-50 to-yellow-50 text-orange-800",
                  entry.status === "live" && "opacity-80 animate-pulse",
                )}
              >
                <span className="mb-2 block text-lg font-bold opacity-80">
                  {entry.role === "yaara" ? "🤖 Yaara" : entry.role === "user" ? "👤 Aap" : "💭 Dhyan se sun raha hoon"}
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

  const reconnectCall = useCallback(async () => {
    if (!conversation) {
      console.error("Conversation object not available");
      return;
    }

    setIsInitializing(true);
    setCallState("connecting");
    setIsMicMuted(false);
    resetSilenceTracking("Yaara se dobara connect ho raha hai...");

    try {
      // Start session with free conversation
      await conversation.startSession();
    } catch (err) {
      console.error("Reconnection failed:", err);
      setIsInitializing(false);
      setCallState("active"); // Keep call active but disconnected
      toast({
        variant: "destructive",
        title: "Reconnection Failed",
        description: "Dobaara try kijiye ya call end kar dijiye.",
      });
    }
  }, [conversation, resetSilenceTracking, toast]);

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(224,242,255,0.9),_transparent_34%),_linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] pb-36">
      <div className="mx-auto flex min-h-screen w-full max-w-screen-2xl flex-col px-4 md:px-8 lg:px-12">
        <div className="flex items-center gap-3 pt-6 pb-4 md:pt-8 md:pb-5">
          <button
            onClick={() => {
              if (callState === "active") {
                endCall();
              }
              navigate("/");
            }}
            className="rounded-full bg-white/90 p-3 shadow-lg backdrop-blur-sm hover:bg-white transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-6 w-6 text-slate-700" />
          </button>

          <div>
            <h2 className="text-3xl font-extrabold text-slate-900 md:text-4xl">📞 Talking to Yaara</h2>
            <p className="text-lg font-semibold text-slate-600">Aap araam se boliye. Main dhyan se sun raha hoon.</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col pb-6">
          {callState === "idle" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-8 lg:grid lg:grid-cols-[1.3fr_0.7fr] lg:items-stretch lg:gap-8">
              <div className="flex w-full flex-1 flex-col items-center justify-center gap-8 rounded-[40px] bg-white/95 px-8 py-12 text-center shadow-[0_40px_80px_rgba(59,130,246,0.14)] backdrop-blur-sm md:min-h-[70vh]">
                <VoiceOrb size={orbSize} />
                <div className="space-y-4">
                  <p className="max-w-2xl text-xl font-semibold text-slate-700 md:text-2xl">
                    Aap Hindi, English, Punjabi ya jis bhi bhaasha mein ho, Yaara aapki baat sunne ko taiyaar hai.
                  </p>
                  <div className="inline-flex items-center gap-3 rounded-full bg-slate-100 px-5 py-3 text-lg font-semibold text-slate-700 shadow-sm">
                    <span className="text-2xl">💙</span>
                    <span>Main aapke saath hoon.</span>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-3">
                  {[0, 1, 2, 3, 4].map((index) => (
                    <span
                      key={index}
                      className="animate-voice-wave inline-block rounded-full bg-blue-400 shadow-lg"
                      style={{ height: `${22 + index * 6}px`, width: '10px', animationDelay: `${index * 0.12}s` }}
                    />
                  ))}
                </div>
                <button
                  onClick={startCall}
                  className="rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 px-14 py-5 text-2xl font-bold text-white shadow-2xl transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_30px_90px_rgba(56,189,248,0.28)] active:scale-95"
                >
                  📞 Start Conversation
                </button>
              </div>

              <div className="rounded-[36px] bg-gradient-to-br from-slate-50 to-sky-50 p-8 shadow-[0_30px_80px_rgba(56,189,248,0.12)]">
                <h3 className="mb-4 text-2xl font-bold text-slate-900">Aapka call guide</h3>
                <ul className="space-y-4 text-left text-slate-700">
                  <li className="rounded-[28px] bg-white/90 p-4 shadow-sm">
                    <p className="font-semibold">1. Boliye</p>
                    <p className="text-sm text-slate-600">Aap shanti se baat kar sakte hain. Yaara dhyan se sunega.</p>
                  </li>
                  <li className="rounded-[28px] bg-white/90 p-4 shadow-sm">
                    <p className="font-semibold">2. Sunna</p>
                    <p className="text-sm text-slate-600">Har jawab ko clear aur warm tone mein milega.</p>
                  </li>
                  <li className="rounded-[28px] bg-white/90 p-4 shadow-sm">
                    <p className="font-semibold">3. Finish</p>
                    <p className="text-sm text-slate-600">End karne ke liye simply 'bye' kahiye.</p>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {callState !== "idle" && (
            <div className={showSplitConversationLayout ? "grid flex-1 gap-6 md:grid-cols-[0.95fr_1.05fr] lg:grid-cols-[0.9fr_1.1fr] lg:gap-8" : "flex flex-1 flex-col gap-6"}>
              <div className="flex h-full flex-col gap-6">
                <div className="flex flex-1 flex-col items-center justify-center gap-6 rounded-[40px] bg-white/95 px-8 py-10 shadow-[0_40px_90px_rgba(59,130,246,0.12)] backdrop-blur-sm">
                  <div className="relative">
                    <VoiceOrb
                      size={orbSize}
                      isActive
                      isListening={callState === "active" && listeningState !== "yaara-speaking"}
                    />
                    {listeningState === "yaara-speaking" && (
                      <div className="absolute inset-0 rounded-full bg-blue-400/25 blur-xl animate-pulse"></div>
                    )}
                  </div>

                  <div className="flex items-end gap-3">
                    {[0, 1, 2, 3, 4, 5, 6].map((index) => (
                      <span
                        key={index}
                        className="rounded-full bg-sky-400 shadow-lg transition-all duration-300"
                        style={{ width: '5px', height: `${18 + index * 6}px`, animationDelay: `${index * 0.1}s` }}
                      />
                    ))}
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-full bg-slate-100 px-8 py-4 shadow-sm">
                      <h3 className="text-2xl font-extrabold text-slate-900 md:text-3xl">{statusLabel}</h3>
                    </div>
                    <div className="inline-flex items-center gap-3 rounded-full bg-slate-100 px-5 py-3 text-lg font-semibold text-slate-700 shadow-sm">
                      {listeningState === "yaara-speaking" && <span className="text-2xl">🎤</span>}
                      {listeningState === "user-speaking" && <span className="text-2xl">👂</span>}
                      {listeningState === "listening" && <span className="text-2xl">⏳</span>}
                      <span>
                        {isInitializing
                          ? "Thoda tayyar ho raha hoon..."
                          : callState === "connecting"
                            ? "Connection ho rahi hai..."
                            : vadScore >= INTERRUPTION_VAD_THRESHOLD
                              ? "Aapki awaaz mil gayi hai."
                              : "Aap bol sakte hain, main sun raha hoon."}
                      </span>
                    </div>
                  </div>
                </div>

                {!showSplitConversationLayout && transcriptPanel}

                <div className="grid grid-cols-3 gap-4">
                  <button
                    onClick={handleMuteToggle}
                    disabled={!isSessionActive}
                    className={cn(
                      "flex min-h-[110px] flex-col items-center justify-center gap-3 rounded-[32px] px-4 text-lg font-bold shadow-xl transition-all duration-300 hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                      isMicMuted
                        ? "bg-rose-500 text-white"
                        : "bg-slate-100 text-slate-800",
                    )}
                  >
                    {isMicMuted ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
                    {isMicMuted ? "Mic Off" : "Mic On"}
                  </button>
                  <button
                    onClick={endCall}
                    className="flex min-h-[110px] flex-col items-center justify-center gap-3 rounded-[32px] bg-red-500 px-4 text-lg font-bold text-white shadow-xl transition-all duration-300 hover:-translate-y-1 active:scale-95"
                  >
                    <PhoneOff className="h-8 w-8" />
                    End Call
                  </button>
                  <button
                    onClick={() => setShowTranscript((current) => !current)}
                    className={cn(
                      "flex min-h-[110px] flex-col items-center justify-center gap-3 rounded-[32px] px-4 text-lg font-bold shadow-xl transition-all duration-300 hover:-translate-y-1 active:scale-95",
                      showTranscript
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-800",
                    )}
                  >
                    {showTranscript ? <EyeOff className="h-8 w-8" /> : <Eye className="h-8 w-8" />}
                    {showTranscript ? "Hide" : "Show"} Transcript
                  </button>
                </div>
              </div>

              {showSplitConversationLayout && (
                <div className="h-full">
                  {transcriptPanel}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallYaara;
