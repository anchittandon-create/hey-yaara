import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircleHeart, Music, Gamepad2, Sparkles, HeartHandshake } from "lucide-react";
import VoiceOrb from "@/components/VoiceOrb";
import { matchVoiceGameCommand, openGame } from "@/lib/games";
import { useToast } from "@/hooks/use-toast";
import { useDeviceType } from "@/hooks/use-device-type";

const quickActions = [
  { label: "Play Songs", icon: Music, path: "/music", className: "bg-card text-foreground" },
  { label: "Play a Game", icon: Gamepad2, path: "/games", className: "bg-yaara-gold/85 text-accent-foreground" },
  { label: "Let's Talk", icon: MessageCircleHeart, path: "/talk", className: "bg-primary text-primary-foreground" },
];

const suggestions = [
  { icon: Music, text: "Aapko bhajan sunna hai?" },
  { icon: Gamepad2, text: "Kal aapne game khela tha" },
  { icon: HeartHandshake, text: "Chaliye baat karte hain" },
];

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const deviceType = useDeviceType();
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const orbSize = deviceType === "desktop" ? "xl" : "lg";
  const quickActionsLayout =
    deviceType === "mobile"
      ? "grid grid-cols-1 gap-4"
      : "grid grid-cols-3 gap-4 lg:gap-5";

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
    <div className="min-h-screen bg-background pb-32">
      <div className="mx-auto flex min-h-screen w-full max-w-screen-2xl flex-col px-5 pt-8 md:px-8 md:pt-10 lg:px-12">
        <div className="rounded-[36px] bg-white/70 p-5 shadow-[0_18px_50px_rgba(180,120,60,0.12)] backdrop-blur md:p-7 lg:p-9">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-elderly-lg font-extrabold text-primary">Namaste 👋</p>
              <h1 className="mt-2 text-[2rem] font-extrabold leading-tight text-foreground md:text-[2.5rem]">
                Aaj kaise feel kar rahe ho?
              </h1>
            </div>
            <div className="hidden rounded-3xl bg-background px-4 py-3 text-right text-base font-semibold text-muted-foreground md:block">
              Hey Yaara
              <div className="text-sm font-bold text-primary">Aapka dost</div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:gap-7">
            <section className="rounded-[34px] bg-gradient-to-b from-card to-background px-5 py-7 text-center shadow-sm md:px-8 md:py-10">
              <div className="mb-5 flex justify-center">
                <VoiceOrb size={orbSize} isListening={isListening} onClick={handleVoiceOrbClick} />
              </div>
              <p className="text-[1.9rem] font-extrabold text-foreground md:text-[2.2rem]">Talk to Yaara</p>
              <p className="mt-3 text-elderly-base font-semibold text-muted-foreground md:text-[1.35rem]">
                {isListening ? "Sun rahi hoon..." : "Bas bolo, main sun raha hoon"}
              </p>

              <div className="mt-6 flex items-center justify-center gap-2 text-base font-bold text-primary">
                <Sparkles className="h-5 w-5" />
                {isListening ? "Aapki awaaz ka intezar hai" : "Ek tap se baat shuru ho jayegi"}
              </div>
            </section>

            <div className="flex flex-col gap-5">
              <section className="rounded-[32px] bg-background p-4 shadow-sm md:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-elderly-lg font-extrabold text-foreground">Quick Actions</h2>
                  <p className="text-base font-bold text-muted-foreground">Aasaan shuruat</p>
                </div>

                <div className={quickActionsLayout}>
                  {quickActions.map(({ label, icon: Icon, path, className }) => (
                    <button
                      key={label}
                      onClick={() => navigate(path)}
                      className={`flex min-h-[96px] items-center gap-4 rounded-[28px] px-5 py-4 text-left text-elderly-base font-extrabold shadow-sm transition-transform active:scale-[0.98] hover:scale-[1.01] md:min-h-[122px] md:flex-col md:justify-center md:text-center ${className}`}
                    >
                      <Icon className="h-8 w-8 flex-shrink-0" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-[32px] bg-card p-4 shadow-sm md:p-5">
                <div className="mb-4">
                  <h2 className="text-elderly-lg font-extrabold text-foreground">Suggestions</h2>
                  <p className="text-base font-semibold text-muted-foreground">Aapke liye chhoti madad</p>
                </div>

                <div className="space-y-3">
                  {suggestions.map(({ icon: Icon, text }) => (
                    <button
                      key={text}
                      onClick={() => navigate("/talk")}
                      className="flex w-full items-center gap-3 rounded-2xl bg-background px-4 py-4 text-left text-elderly-base font-bold text-foreground transition-transform active:scale-[0.98] hover:scale-[1.01]"
                    >
                      <span className="rounded-2xl bg-primary/10 p-3 text-primary">
                        <Icon className="h-6 w-6" />
                      </span>
                      <span>{text}</span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
