import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircleHeart, Music, Gamepad2, Sparkles, HeartHandshake, Clock, Play } from "lucide-react";
import VoiceOrb from "@/components/VoiceOrb";
import { matchVoiceGameCommand, openGame } from "@/lib/games";
import { useToast } from "@/hooks/use-toast";
import { useDeviceType } from "@/hooks/use-device-type";

const quickActions = [
  { label: "Let's Talk", icon: MessageCircleHeart, path: "/talk", emoji: "💬", color: "bg-gradient-to-br from-blue-400 to-blue-600" },
  { label: "Play Music", icon: Music, path: "/music", emoji: "🎵", color: "bg-gradient-to-br from-orange-400 to-orange-600" },
  { label: "Play Games", icon: Gamepad2, path: "/games", emoji: "🎮", color: "bg-gradient-to-br from-green-400 to-green-600" },
];

const smartSuggestions = [
  { icon: Music, text: "Aapko bhajan sunna hai?", emoji: "🙏", action: () => {} },
  { icon: Gamepad2, text: "Kal aapne ludo khela tha", emoji: "🎲", action: () => {} },
  { icon: HeartHandshake, text: "Chaliye baat karte hain", emoji: "💝", action: () => {} },
];

const recentActivity = [
  { type: "music", title: "Hanuman Chalisa", time: "2 hours ago", emoji: "🙏" },
  { type: "game", title: "Ludo", time: "Yesterday", emoji: "🎲" },
  { type: "talk", title: "Talk with Yaara", time: "3 days ago", emoji: "💬" },
];

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const deviceType = useDeviceType();
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 pb-36">
      <div className="mx-auto flex min-h-screen w-full max-w-screen-2xl flex-col px-4 pt-6 md:px-8 md:pt-8 lg:px-12">
        {/* Greeting Section */}
        <div className="mb-8 rounded-[36px] bg-gradient-to-r from-white/90 to-orange-50/90 p-6 shadow-xl backdrop-blur-sm md:p-8">
          <div className="text-center">
            <div className="mb-4 flex items-center justify-center gap-3">
              <span className="text-6xl animate-bounce">👋</span>
              <div>
                <h1 className="text-3xl font-extrabold text-gray-800 md:text-4xl">Namaste</h1>
                <p className="text-xl font-semibold text-orange-700 md:text-2xl">Aaj kaise feel kar rahe ho?</p>
              </div>
            </div>
            <div className="mx-auto max-w-md rounded-full bg-orange-100 px-6 py-3">
              <p className="text-lg font-medium text-orange-800">Main yahin hoon, aapke liye... 💕</p>
            </div>
          </div>
        </div>

        {/* Main Action Section */}
        <div className="mb-8 rounded-[36px] bg-gradient-to-r from-blue-50/90 to-indigo-50/90 p-6 shadow-xl backdrop-blur-sm md:p-8">
          <div className="text-center">
            <div className="mb-6">
              <VoiceOrb size={orbSize} isListening={isListening} onClick={handleVoiceOrbClick} />
            </div>
            <h2 className="mb-3 text-2xl font-extrabold text-gray-800 md:text-3xl">Talk to Yaara</h2>
            <p className="mb-4 text-xl font-semibold text-blue-700">Bas bolo… main sun raha hoon</p>
            <div className="flex items-center justify-center gap-2 text-lg font-medium text-blue-600">
              <Sparkles className="h-5 w-5" />
              {isListening ? "Aapki awaaz ka intezar hai" : "Ek tap se baat shuru ho jayegi"}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h3 className="mb-4 text-center text-2xl font-extrabold text-gray-800">Kya karna chahte hain?</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {quickActions.map(({ label, icon: Icon, path, emoji, color }) => (
              <button
                key={label}
                onClick={() => navigate(path)}
                className={`${color} min-h-[120px] rounded-[32px] p-6 text-left text-white shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl active:scale-95 md:min-h-[140px]`}
              >
                <div className="flex items-center gap-4">
                  <span className="text-4xl">{emoji}</span>
                  <div>
                    <h4 className="text-xl font-extrabold">{label}</h4>
                    <p className="text-lg font-medium opacity-90">Tap to start</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Smart Suggestions */}
        <div className="mb-8 rounded-[32px] bg-gradient-to-r from-green-50/90 to-emerald-50/90 p-6 shadow-xl backdrop-blur-sm">
          <div className="mb-4 flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-green-600" />
            <h3 className="text-xl font-extrabold text-gray-800">Aapke liye suggestions</h3>
          </div>
          <div className="space-y-3">
            {smartSuggestions.map(({ icon: Icon, text, emoji }) => (
              <button
                key={text}
                onClick={() => navigate("/talk")}
                className="flex w-full items-center gap-4 rounded-[24px] bg-white/80 p-4 shadow-md transition-all hover:scale-[1.02] hover:shadow-lg active:scale-95"
              >
                <span className="text-3xl">{emoji}</span>
                <span className="text-lg font-semibold text-gray-700">{text}</span>
                <Icon className="ml-auto h-6 w-6 text-green-600" />
              </button>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-[32px] bg-gradient-to-r from-purple-50/90 to-pink-50/90 p-6 shadow-xl backdrop-blur-sm">
          <div className="mb-4 flex items-center gap-3">
            <Clock className="h-6 w-6 text-purple-600" />
            <h3 className="text-xl font-extrabold text-gray-800">Recent Activity</h3>
          </div>
          <div className="space-y-3">
            {recentActivity.map((activity, index) => (
              <div
                key={index}
                className="flex items-center gap-4 rounded-[20px] bg-white/70 p-4 shadow-sm"
              >
                <span className="text-2xl">{activity.emoji}</span>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">{activity.title}</p>
                  <p className="text-sm text-gray-600">{activity.time}</p>
                </div>
                <button className="rounded-full bg-purple-100 p-2 text-purple-600 hover:bg-purple-200">
                  <Play className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
