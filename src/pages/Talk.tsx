import { useState, useCallback } from "react";
import VoiceOrb from "@/components/VoiceOrb";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "yaara";
  text: string;
}

const Talk = () => {
  const navigate = useNavigate();
  const [isListening, setIsListening] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "yaara", text: "Namaste! Aaj kaise feel kar rahe ho? 😊" },
  ]);

  const toggleListening = useCallback(() => {
    setIsListening((prev) => !prev);
    if (!isListening) {
      // Simulate a response after "listening"
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { id: Date.now().toString(), role: "user", text: "Main thik hoon, thoda bore ho raha hoon." },
        ]);
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            { id: (Date.now() + 1).toString(), role: "yaara", text: "Arre, chalo kuch mazedaar baat karte hain! Aapka favourite gaana kaun sa hai?" },
          ]);
        }, 1500);
      }, 2000);
    }
  }, [isListening]);

  return (
    <div className="min-h-screen flex flex-col pb-28">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-4">
        <button onClick={() => navigate("/")} className="p-3 rounded-full bg-card" aria-label="Back">
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </button>
        <h2 className="text-elderly-lg font-bold text-foreground">Yaara se Baat</h2>
        <button
          onClick={() => setShowTranscript((p) => !p)}
          className="p-3 rounded-full bg-card"
          aria-label={showTranscript ? "Hide transcript" : "Show transcript"}
        >
          {showTranscript ? <EyeOff className="w-6 h-6 text-muted-foreground" /> : <Eye className="w-6 h-6 text-muted-foreground" />}
        </button>
      </div>

      {/* Transcript */}
      {showTranscript && (
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "rounded-2xl px-5 py-4 max-w-[85%] text-elderly-base leading-relaxed",
                msg.role === "yaara"
                  ? "bg-card text-foreground self-start mr-auto"
                  : "bg-primary text-primary-foreground self-end ml-auto"
              )}
            >
              <span className="block text-sm font-semibold mb-1 opacity-70">
                {msg.role === "yaara" ? "🤗 Yaara" : "🗣️ Aap"}
              </span>
              {msg.text}
            </div>
          ))}
        </div>
      )}

      {/* Orb area */}
      <div className="flex flex-col items-center gap-4 py-6">
        <VoiceOrb isListening={isListening} isActive={isListening} onClick={toggleListening} />
        <p className="text-elderly-base font-semibold text-muted-foreground">
          {isListening ? "Sun raha hoon... boliye 🎙️" : "Baat karne ke liye tap karein"}
        </p>
      </div>
    </div>
  );
};

export default Talk;
