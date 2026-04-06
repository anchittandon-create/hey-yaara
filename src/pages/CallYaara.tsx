import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { useNavigate } from "react-router-dom";
import { Mic, MicOff, PhoneOff, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import VoiceOrb from "@/components/VoiceOrb";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  YAARA_AGENT_PROMPT,
  YAARA_FIRST_MESSAGE,
  YAARA_SETUP_NOTES,
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

const AGENT_ID = (import.meta.env.VITE_ELEVENLABS_AGENT_ID as string | undefined) ?? "";
const INITIAL_SILENCE_MS = 6000;
const LONG_SILENCE_MS = 12000;
const MID_CONVERSATION_SILENCE_MS = 5000;
const TURN_END_SILENCE_MS = 1800;
const INTERRUPTION_VAD_THRESHOLD = 0.72;
const INTERRUPTION_HOLD_MS = 240;

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
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const highVadSinceRef = useRef<number | null>(null);
  const lastSpeechAtRef = useRef<number | null>(null);
  const hasUserSpokenRef = useRef(false);
  const silencePromptStageRef = useRef(0);
  const isYaaraSpeakingRef = useRef(false);

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

  const conversation = useConversation({
    overrides: {
      agent: {
        prompt: {
          prompt: YAARA_AGENT_PROMPT,
        },
        firstMessage: YAARA_FIRST_MESSAGE,
      },
    },
    onConnect: () => {
      setCallState("active");
      resetSilenceTracking("Namaste. Main yahin hoon. Aap aaram se boliye.");

      if (typeof conversation.sendContextualUpdate === "function") {
        conversation.sendContextualUpdate(
          "The current user may be elderly, may speak slowly, and may pause often. Be calm, patient, and use short supportive sentences.",
        );
      }
    },
    onDisconnect: () => {
      setCallState("idle");
      setListeningState("idle");
      setHelperText("Jab chahein dobara baat kar sakte hain.");
    },
    onModeChange: (mode: any) => {
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

          if (isYaaraSpeakingRef.current && typeof conversation.sendUserActivity === "function") {
            conversation.sendUserActivity();
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
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Thoda samajh nahi aaya, dobara bolenge?",
      });
      setCallState("idle");
      setListeningState("idle");
    },
  } as any);

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
        if (silencePromptStageRef.current === 0) {
          const guidance = "Main sun raha hoon... aap kuch kehna chahte hain?";
          setHelperText(guidance);
          upsertTranscript("system", guidance);
          silencePromptStageRef.current = 1;
          return;
        }

        if (silencePromptStageRef.current === 1) {
          const guidance = "Theek hai, main yahin hoon. Jab mann kare baat kar lena.";
          setHelperText(guidance);
          upsertTranscript("system", guidance);
          silencePromptStageRef.current = 2;
        }
        return;
      }

      if (lastSpeechAt && now - lastSpeechAt >= MID_CONVERSATION_SILENCE_MS && silencePromptStageRef.current === 0) {
        const guidance = "Aap ruk gaye... boliye, main sun raha hoon.";
        setHelperText(guidance);
        upsertTranscript("system", guidance);
        silencePromptStageRef.current = 1;
      }
    }, INITIAL_SILENCE_MS);

    return () => {
      if (silenceTimerRef.current) {
        window.clearInterval(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };
  }, [callState, isMicMuted, upsertTranscript]);

  useEffect(() => {
    if (typeof conversation.setMuted === "function") {
      conversation.setMuted(isMicMuted);
    }
  }, [conversation, isMicMuted]);

  const transcriptPanel = useMemo(() => {
    if (!showTranscript) {
      return null;
    }

    return (
      <div className="w-full rounded-[28px] bg-card/90 p-4 shadow-sm md:h-full md:min-h-[420px] md:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xl font-extrabold text-foreground">Conversation</h3>
          <span className="text-base font-semibold text-muted-foreground">Live text</span>
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
    if (!AGENT_ID) {
      toast({
        variant: "destructive",
        title: "Setup Required",
        description: "VITE_ELEVENLABS_AGENT_ID set kijiye. Phir Yaara se baat shuru ho jayegi.",
      });
      return;
    }

    setCallState("connecting");
    setTranscripts([]);
    setIsMicMuted(false);
    resetSilenceTracking("Yaara se jodne ki koshish ho rahi hai...");

    try {
      await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const { data, error } = await supabase.functions.invoke("elevenlabs-signed-url", {
        body: { agent_id: AGENT_ID },
      });

      if (error || !data?.signed_url) {
        throw new Error(error?.message || "Could not get signed URL");
      }

      await conversation.startSession({
        signedUrl: data.signed_url,
      });
    } catch (err) {
      console.error("Failed to start call:", err);
      toast({
        variant: "destructive",
        title: "Call Failed",
        description: err instanceof Error ? err.message : "Call shuru nahi ho payi.",
      });
      setCallState("idle");
      setListeningState("idle");
    }
  }, [conversation, resetSilenceTracking, toast]);

  const endCall = useCallback(async () => {
    await conversation.endSession();
    setCallState("idle");
    setListeningState("idle");
    setHelperText("Theek hai. Main yahin hoon, jab chaho phir baat karenge.");
    upsertTranscript("yaara", "Theek hai. Main yahin hoon, jab chaho phir baat karenge.");
  }, [conversation, upsertTranscript]);

  const statusLabel = useMemo(() => {
    if (callState === "connecting") {
      return "Yaara jud raha hai...";
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
  }, [callState, helperText, isMicMuted, listeningState]);

  const showSplitConversationLayout = callState !== "idle" && deviceType !== "mobile";
  const showDesktopTranscript = deviceType === "desktop";

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col md:max-w-3xl lg:max-w-6xl">
      <div className="flex items-center gap-3 px-4 pt-6 pb-4 md:px-8 lg:px-10">
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
          <h2 className="text-elderly-lg font-extrabold text-foreground">Talking to Yaara</h2>
          <p className="text-base font-semibold text-muted-foreground">Aaraam se baat kijiye</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-6 md:px-8 lg:px-10">
        {callState === "idle" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 lg:grid lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:gap-8">
            <div className="flex w-full flex-col items-center justify-center gap-6 rounded-[32px] bg-gradient-to-b from-card to-background px-6 py-8 text-center">
              <VoiceOrb size="lg" />
              <p className="max-w-lg text-center text-elderly-lg font-semibold text-muted-foreground">
                Yaara aapki baat dhyan se sunega. Aap Hindi, English, Punjabi ya mix mein bol sakte hain.
              </p>
              <button
                onClick={startCall}
                className="rounded-full bg-yaara-green px-10 py-5 text-elderly-lg font-bold text-secondary-foreground shadow-lg transition-transform active:scale-95"
              >
                Talk to Yaara
              </button>
            </div>

            {!AGENT_ID && (
              <div className="w-full rounded-[28px] bg-card p-5 text-left shadow-sm">
                <h3 className="mb-3 text-xl font-extrabold text-foreground">Setup</h3>
                <div className="space-y-2 text-elderly-base text-muted-foreground">
                  {YAARA_SETUP_NOTES.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {callState !== "idle" && (
          <div className={showSplitConversationLayout ? "grid flex-1 gap-5 md:grid-cols-2 lg:grid-cols-[0.95fr_1.05fr]" : "flex flex-1 flex-col gap-5"}>
            <div className="flex flex-col gap-5">
              <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-[32px] bg-gradient-to-b from-card to-background px-6 py-8 text-center md:min-h-[420px]">
                <VoiceOrb
                  size="lg"
                  isActive
                  isListening={callState === "active" && listeningState !== "yaara-speaking"}
                />
                <div className="space-y-2">
                  <p className="text-elderly-lg font-extrabold text-foreground">{statusLabel}</p>
                  <p className="text-base font-semibold text-muted-foreground">
                    {callState === "connecting"
                      ? "Connection ho rahi hai..."
                      : vadScore >= INTERRUPTION_VAD_THRESHOLD
                        ? "Aapki awaaz mil gayi hai."
                        : "Background noise ko ignore karne ki koshish ho rahi hai."}
                  </p>
                </div>
              </div>

              {!showSplitConversationLayout && transcriptPanel}

              <div className="mt-auto grid grid-cols-3 gap-3 pt-2">
                <button
                  onClick={() => setIsMicMuted((current) => !current)}
                  className={cn(
                    "flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-[28px] px-3 text-base font-bold shadow-sm transition-transform active:scale-95",
                    isMicMuted ? "bg-muted text-foreground" : "bg-card text-foreground",
                  )}
                >
                  {isMicMuted ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
                  {isMicMuted ? "Unmute" : "Mute"}
                </button>

                <button
                  onClick={endCall}
                  className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-[28px] bg-destructive px-3 text-base font-bold text-destructive-foreground shadow-sm transition-transform active:scale-95"
                >
                  <PhoneOff className="h-7 w-7" />
                  End
                </button>

                <button
                  onClick={() => setShowTranscript((current) => !current)}
                  className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-[28px] bg-card px-3 text-base font-bold text-foreground shadow-sm transition-transform active:scale-95"
                >
                  {showTranscript ? <EyeOff className="h-7 w-7" /> : <Eye className="h-7 w-7" />}
                  {showTranscript ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {showSplitConversationLayout && (
              <div className={showDesktopTranscript ? "h-full" : ""}>{transcriptPanel}</div>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default CallYaara;
