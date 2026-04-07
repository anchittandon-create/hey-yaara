import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MessageCircleHeart, Music, Gamepad2, Sparkles, HeartHandshake, Clock, Play } from "lucide-react";
import VoiceOrb from "@/components/VoiceOrb";
import { matchVoiceGameCommand, openGame } from "@/lib/games";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useDeviceType } from "@/hooks/use-device-type";

const quickActions = [
  { label: "Let's Talk", icon: MessageCircleHeart, path: "/talk", emoji: "💬", color: "bg-gradient-to-br from-blue-400 to-blue-600" },
  { label: "Play Music", icon: Music, path: "/music", emoji: "🎵", color: "bg-gradient-to-br from-orange-400 to-orange-600" },
  { label: "Play Games", icon: Gamepad2, path: "/games", emoji: "🎮", color: "bg-gradient-to-br from-green-400 to-green-600" },
];

const smartSuggestions = [
  { icon: Music, text: "Aapko bhajan sunna hai?", emoji: "🙏", action: () => { } },
  { icon: Gamepad2, text: "Kal aapne ludo khela tha", emoji: "🎲", action: () => { } },
  { icon: HeartHandshake, text: "Chaliye baat karte hain", emoji: "💝", action: () => { } },
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(254,234,208,0.9),_transparent_35%),_linear-gradient(180deg,#fff7ed_0%,#fff1dd_100%)] pb-36">
      <div className="mx-auto flex min-h-screen w-full max-w-screen-2xl flex-col px-4 pt-6 md:px-8 md:pt-10 lg:px-12">
        <div className="mb-8 grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-start">
          <section className="rounded-[42px] bg-white/95 p-6 shadow-[0_40px_120px_rgba(251,209,178,0.35)] backdrop-blur-sm md:p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">Aapka friendly assistant</p>
                <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">Namaste, aapki Yaara.</h1>
                <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">
                  Yeh aapka soft space hai — boliye, suniye, ya phir gaana suniye. Sab kuch simple, warm aur aapke liye tailored.
                </p>
              </div>
              <div className="rounded-[32px] border border-orange-100 bg-orange-50/90 p-5 shadow-sm md:max-w-[320px]">
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-orange-600">Aaj ka mood</p>
                <p className="mt-3 text-2xl font-extrabold text-orange-800">Aaram aur dosti</p>
                <p className="mt-2 text-sm text-orange-700">Yaara aapke saath hai. Bas ek tap se baat shuru karein.</p>
              </div>
            </div>
          </section>

          <aside className="rounded-[36px] bg-gradient-to-br from-orange-50 to-amber-100 p-6 shadow-xl shadow-orange-100/40 md:p-8">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">Aaj ka path</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Daily gentle routine</h2>
              </div>
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-white/90 text-2xl shadow-sm">✨</span>
            </div>
            <div className="space-y-4">
              <div className="rounded-[28px] bg-white/90 p-4 shadow-sm">
                <p className="text-sm text-slate-500">1. Soft start</p>
                <p className="mt-2 font-semibold text-slate-800">Gaana suniye, aankh band karke.</p>
              </div>
              <div className="rounded-[28px] bg-white/90 p-4 shadow-sm">
                <p className="text-sm text-slate-500">2. Connect</p>
                <p className="mt-2 font-semibold text-slate-800">Yaara se choti si baat karein.</p>
              </div>
              <div className="rounded-[28px] bg-white/90 p-4 shadow-sm">
                <p className="text-sm text-slate-500">3. Play</p>
                <p className="mt-2 font-semibold text-slate-800">Ek halka game khel lein.</p>
              </div>
            </div>
          </aside>
        </div>

        <section className="mb-8">
          <div className="grid gap-4 sm:grid-cols-3">
            {quickActions.map(({ label, icon: Icon, path, emoji, color }) => (
              <button
                key={label}
                onClick={() => navigate(path)}
                className={`${color} flex min-h-[120px] flex-col justify-between rounded-[32px] p-5 text-left text-white shadow-[0_20px_50px_rgba(249,168,79,0.2)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_65px_rgba(249,168,79,0.27)] active:scale-95`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{emoji}</span>
                  <div>
                    <h4 className="text-lg font-bold">{label}</h4>
                  </div>
                </div>
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold text-white/90">
                  <Icon className="h-4 w-4" />
                  Open
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="mb-8 rounded-[42px] bg-white/95 p-6 shadow-[0_40px_120px_rgba(209,154,116,0.18)] backdrop-blur-sm md:p-8">
          <div className="grid gap-6 lg:grid-cols-[0.95fr_0.65fr] lg:items-center">
            <div className="space-y-4">
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Aaayiye baat karein</div>
              <h2 className="text-3xl font-extrabold text-slate-900 md:text-4xl">Jaise hi aap bolenge, Yaara sun lega.</h2>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                Aapke bolne ka har pal support karta hua experience. Humne is screen ko aapke liye bilkul seedha aur friendly banaya hai.
              </p>
              <div className="inline-flex items-center gap-3 rounded-full bg-slate-100 px-5 py-3 text-base font-semibold text-slate-700 shadow-sm">
                <Sparkles className="h-5 w-5 text-orange-500" />
                {isListening ? "Aapki awaaz sun raha hai" : "Tap karke bolna shuru karein"}
              </div>
            </div>
            <div className="flex items-center justify-center">
              <VoiceOrb size={orbSize} isListening={isListening} onClick={handleVoiceOrbClick} />
            </div>
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-3xl font-extrabold text-slate-900">Aapke quick actions</h3>
              <p className="text-sm text-slate-500">Sabse tezi se jaayen, bina soche samjhe.</p>
            </div>
            <span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800">Warm path curated</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {quickActions.map(({ label, icon: Icon, path, emoji, color }) => (
              <button
                key={label}
                onClick={() => navigate(path)}
                className={`${color} flex min-h-[140px] flex-col justify-between rounded-[32px] p-6 text-left text-white shadow-[0_24px_60px_rgba(249,168,79,0.25)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_80px_rgba(249,168,79,0.3)] active:scale-95`}
              >
                <div className="flex items-center gap-4">
                  <span className="text-4xl">{emoji}</span>
                  <div>
                    <h4 className="text-xl font-bold">{label}</h4>
                    <p className="text-sm opacity-90">Warmly designed for you</p>
                  </div>
                </div>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white/90">
                  <Icon className="h-5 w-5" />
                  Open
                </div>
              </button>
            ))}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[36px] bg-slate-950/95 p-6 shadow-[0_30px_100px_rgba(15,23,42,0.22)] text-white md:p-8">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h3 className="text-2xl font-extrabold">Yaara says</h3>
              <span className="rounded-full bg-slate-800/90 px-4 py-2 text-sm font-semibold text-slate-100">Today</span>
            </div>
            <p className="text-lg leading-8 text-slate-200">
              Aaj agar aap chahen toh shuruaat ek surili geet se kar sakte hain, phir thoda sa khel aur ek dil se baat. Main hamesha yahin hoon, bilkul shaant aur samajhdaar.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[28px] bg-slate-900/95 p-4">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Focus</p>
                <p className="mt-3 text-lg font-bold text-white">Relaxed voice time</p>
              </div>
              <div className="rounded-[28px] bg-slate-900/95 p-4">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Best next</p>
                <p className="mt-3 text-lg font-bold text-white">Ek sweet game khelna</p>
              </div>
            </div>
          </section>

          <section className="rounded-[36px] bg-white/95 p-6 shadow-[0_30px_80px_rgba(249,168,79,0.2)] md:p-8">
            <div className="mb-5 flex items-center gap-3">
              <Clock className="h-6 w-6 text-orange-600" />
              <h3 className="text-2xl font-extrabold text-slate-900">Recent Activity</h3>
            </div>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="rounded-[28px] border border-orange-100 bg-orange-50/80 p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{activity.emoji}</span>
                    <div>
                      <p className="font-semibold text-slate-900">{activity.title}</p>
                      <p className="text-sm text-slate-600">{activity.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Index;
