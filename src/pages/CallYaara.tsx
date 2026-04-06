import { useState, useCallback, useRef, useEffect } from "react";
import { useConversation } from "@elevenlabs/react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import VoiceOrb from "@/components/VoiceOrb";
import { Phone, PhoneOff, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface TranscriptEntry {
  id: string;
  role: "user" | "yaara";
  text: string;
}

// Set your ElevenLabs Agent ID here (public, not a secret)
const AGENT_ID = ""; // User needs to set this

const CallYaara = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [callState, setCallState] = useState<"idle" | "connecting" | "active">("idle");
  const [showTranscript, setShowTranscript] = useState(true);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const addTranscript = useCallback((role: "user" | "yaara", text: string) => {
    setTranscripts((prev) => [...prev, { id: Date.now().toString() + Math.random(), role, text }]);
  }, []);

  const conversation = useConversation({
    onConnect: () => {
      setCallState("active");
      addTranscript("yaara", "Namaste! Main Yaara hoon. Aaj aap kaise ho? 😊");
    },
    onDisconnect: () => {
      setCallState("idle");
    },
    onMessage: (message: any) => {
      if (message.type === "user_transcript") {
        const text = message.user_transcription_event?.user_transcript;
        if (text) addTranscript("user", text);
      } else if (message.type === "agent_response") {
        const text = message.agent_response_event?.agent_response;
        if (text) addTranscript("yaara", text);
      }
    },
    onError: (error) => {
      console.error("Conversation error:", error);
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Call se connect nahi ho paya. Dobara try karein.",
      });
      setCallState("idle");
    },
  });

  // Auto-scroll transcripts
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  const startCall = useCallback(async () => {
    if (!AGENT_ID) {
      toast({
        variant: "destructive",
        title: "Setup Required",
        description: "ElevenLabs Agent ID is not configured. Please set it in CallYaara.tsx.",
      });
      return;
    }

    setCallState("connecting");
    setTranscripts([]);

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get signed URL from edge function
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
        description: err instanceof Error ? err.message : "Could not start call",
      });
      setCallState("idle");
    }
  }, [conversation, toast]);

  const endCall = useCallback(async () => {
    await conversation.endSession();
    setCallState("idle");
    addTranscript("yaara", "Alvida! Phir baat karenge. 🙏");
  }, [conversation, addTranscript]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background md:max-w-2xl lg:max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-2 md:px-8 lg:px-10">
        <button
          onClick={() => {
            if (callState === "active") endCall();
            navigate("/");
          }}
          className="text-elderly-base font-bold text-primary"
        >
          ← Back
        </button>
        <h2 className="text-elderly-lg font-bold text-foreground">Call Yaara 📞</h2>
        {callState === "active" && (
          <button
            onClick={() => setShowTranscript((p) => !p)}
            className="p-3 rounded-full bg-card"
            aria-label={showTranscript ? "Hide transcript" : "Show transcript"}
          >
            {showTranscript ? (
              <EyeOff className="w-6 h-6 text-muted-foreground" />
            ) : (
              <Eye className="w-6 h-6 text-muted-foreground" />
            )}
          </button>
        )}
        {callState !== "active" && <div className="w-12" />}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Transcript Area */}
        {callState === "active" && showTranscript && (
          <div className="flex-1 max-h-[40vh] space-y-3 overflow-y-auto px-4 py-2 md:px-8 lg:px-10">
            {transcripts.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  "max-w-[85%] rounded-2xl px-5 py-4 text-elderly-base leading-relaxed md:max-w-[70%] lg:max-w-[60%]",
                  entry.role === "yaara"
                    ? "bg-card text-foreground mr-auto"
                    : "bg-primary text-primary-foreground ml-auto"
                )}
              >
                <span className="block text-sm font-semibold mb-1 opacity-70">
                  {entry.role === "yaara" ? "🤗 Yaara" : "🗣️ Aap"}
                </span>
                {entry.text}
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        )}

        {/* Call UI Center */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-8 md:px-10">
          {callState === "idle" && (
            <>
              <VoiceOrb size="lg" />
              <p className="px-8 text-center text-elderly-lg font-semibold text-muted-foreground md:max-w-lg">
                Yaara se baat karne ke liye call karein
              </p>
              <button
                onClick={startCall}
                className="flex items-center gap-3 px-10 py-5 rounded-full bg-yaara-green text-secondary-foreground text-elderly-lg font-bold shadow-lg transition-transform active:scale-95"
              >
                <Phone className="w-8 h-8" />
                Call Yaara
              </button>
            </>
          )}

          {callState === "connecting" && (
            <>
              <VoiceOrb size="lg" isActive />
              <p className="text-elderly-lg text-center font-semibold text-primary animate-pulse">
                Connecting... 📞
              </p>
            </>
          )}

          {callState === "active" && (
            <>
              <VoiceOrb
                size="lg"
                isListening={!conversation.isSpeaking}
                isActive
              />
              <p className="text-elderly-base font-semibold text-muted-foreground">
                {conversation.isSpeaking ? "Yaara bol raha hai... 🗣️" : "Sun raha hoon... 🎙️"}
              </p>
              <button
                onClick={endCall}
                className="flex items-center gap-3 px-10 py-5 rounded-full bg-destructive text-destructive-foreground text-elderly-lg font-bold shadow-lg transition-transform active:scale-95"
              >
                <PhoneOff className="w-8 h-8" />
                End Call
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallYaara;
