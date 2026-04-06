import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import VoiceOrb from "@/components/VoiceOrb";
import { Mic, Music, Gamepad2 } from "lucide-react";
import { matchVoiceGameCommand, openGame } from "@/lib/games";
import { useToast } from "@/hooks/use-toast";
import { useDeviceType } from "@/hooks/use-device-type";

const actionButtons = [
  { label: "Talk to Yaara", icon: Mic, path: "/talk", color: "bg-primary text-primary-foreground" },
  { label: "Music", icon: Music, path: "/music", color: "bg-yaara-green text-secondary-foreground" },
  { label: "Games", icon: Gamepad2, path: "/games", color: "bg-yaara-gold text-accent-foreground" },
];

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const deviceType = useDeviceType();
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const useHorizontalButtons = deviceType !== "mobile";
  const orbSize = deviceType === "desktop" ? "xl" : "lg";

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
    <div className="min-h-screen bg-background pb-28">
      <div className="mx-auto flex min-h-screen w-full max-w-screen-2xl flex-col justify-between px-6 pt-10 md:px-10 md:pt-14 lg:px-16 lg:pt-16">
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="flex w-full flex-1 flex-col items-center justify-center rounded-[36px] md:bg-card/35 md:px-10 md:py-12 lg:min-h-[70vh] lg:px-16 lg:py-16">
            <h1 className="mb-3 text-elderly-2xl font-extrabold text-primary md:text-[2.5rem] lg:text-[3.2rem]">
              Hey Yaara
            </h1>

            <p className="mb-10 max-w-xs text-center text-elderly-base leading-relaxed text-muted-foreground md:mb-12 md:max-w-2xl md:text-[1.4rem] lg:max-w-3xl">
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

            <div className="mb-12 md:mb-16">
              <VoiceOrb size={orbSize} isListening={isListening} onClick={handleVoiceOrbClick} />
            </div>

            <div
              className={useHorizontalButtons
                ? "grid w-full max-w-6xl grid-cols-3 gap-4 lg:gap-6"
                : "mt-auto flex w-full max-w-sm flex-col gap-4"}
            >
              {actionButtons.map(({ label, icon: Icon, path, color }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`flex w-full items-center gap-4 rounded-2xl px-6 py-5 text-elderly-lg font-bold shadow-md transition-transform active:scale-95 hover:scale-[1.01] ${useHorizontalButtons ? "min-h-[144px] flex-col justify-center text-center text-[1.6rem] lg:min-h-[168px]" : "justify-start"} ${color}`}
                >
                  <Icon className="h-8 w-8 flex-shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
