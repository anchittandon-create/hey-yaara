import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import VoiceOrb from "@/components/VoiceOrb";
import { Mic, Music, Gamepad2 } from "lucide-react";
import { matchVoiceGameCommand, openGame } from "@/lib/games";
import { useToast } from "@/hooks/use-toast";

const actionButtons = [
  { label: "Talk to Yaara", icon: Mic, path: "/talk", color: "bg-primary text-primary-foreground" },
  { label: "Music", icon: Music, path: "/music", color: "bg-yaara-green text-secondary-foreground" },
  { label: "Games", icon: Gamepad2, path: "/games", color: "bg-yaara-gold text-accent-foreground" },
];

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const handleVoiceResult = useCallback(
    (spokenText: string) => {
      const matchedCommand = matchVoiceGameCommand(spokenText);

      if (matchedCommand.intent === "open-game" && matchedCommand.game) {
        openGame(matchedCommand.game);
        return;
      }

      if (matchedCommand.intent === "open-games-page") {
        navigate("/games");
        return;
      }

      navigate("/talk");
    },
    [navigate],
  );

  const handleVoiceOrbClick = useCallback(() => {
    const SpeechRecognition =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : undefined;

    if (!SpeechRecognition) {
      navigate("/talk");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop?.();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "hi-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onerror = () => {
      setIsListening(false);
      toast({
        title: "Dobara boliye",
        description: "Main aapki baat theek se sun nahi paaya.",
      });
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? "";
      handleVoiceResult(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [handleVoiceResult, isListening, navigate, toast]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort?.();
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center px-6 pt-12 pb-28">
      {/* Title */}
      <h1 className="text-elderly-2xl font-extrabold text-primary mb-2">Hey Yaara</h1>

      {/* Greeting */}
      <p className="text-elderly-base text-center text-muted-foreground mb-10 max-w-xs leading-relaxed">
        {isListening ? (
          <>
            Sun rahi hoon...
            <br />
            Boliye: Ludo kholo
          </>
        ) : (
          <>
            Namaste! Main Yaara hoon.
            <br />
            Aap mujhse baat kar sakte hain. 🙏
          </>
        )}
      </p>

      {/* Voice Orb */}
      <div className="mb-12">
        <VoiceOrb isListening={isListening} onClick={handleVoiceOrbClick} />
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-xs flex flex-col gap-4">
        {actionButtons.map(({ label, icon: Icon, path, color }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`flex items-center gap-4 w-full px-6 py-5 rounded-2xl text-elderly-lg font-bold shadow-md transition-transform active:scale-95 ${color}`}
          >
            <Icon className="w-8 h-8 flex-shrink-0" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Index;
