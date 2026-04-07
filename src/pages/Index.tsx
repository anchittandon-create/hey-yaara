/**
 * Index.tsx  –  Yaara Premium Home Hub
 *
 * Unifies the scattered layout into a high-end, elite experience.
 * Features:
 *  - Clear visual hierarchy
 *  - Visual excellence: glassmorphism, depth, premium gradients
 *  - Centralized Voice Hub
 *  - Activity Dashboard for Music, Games, and Talk
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  MessageCircleHeart, Music, Gamepad2, Sparkles, HeartHandshake, 
  Clock, Play, ShieldCheck, Star, Zap 
} from "lucide-react";
import VoiceOrb from "@/components/VoiceOrb";
import { matchVoiceGameCommand, openGame } from "@/lib/games";
import { useToast } from "@/hooks/use-toast";
import { useDeviceType } from "@/hooks/use-device-type";
import { cn } from "@/lib/utils";

const primaryActivities = [
  { 
    label: "Talk with Yaara", 
    desc: "Dil ki baat karein - Aapki saheli",
    icon: MessageCircleHeart, 
    path: "/talk", 
    emoji: "💬", 
    color: "from-blue-600 to-indigo-600",
    shadow: "shadow-blue-200"
  },
  { 
    label: "Play Music", 
    desc: "Suhrili dhun suniye",
    icon: Music, 
    path: "/music", 
    emoji: "🎵", 
    color: "from-orange-500 to-rose-500",
    shadow: "shadow-orange-200"
  },
  { 
    label: "Play Games", 
    desc: "Dimag aur maza",
    icon: Gamepad2, 
    path: "/games", 
    emoji: "🎮", 
    color: "from-emerald-500 to-teal-600",
    shadow: "shadow-emerald-200"
  },
];

const smartSuggestions = [
  { icon: Music, text: "Aapko bhajan sunna hai?", emoji: "🙏" },
  { icon: Gamepad2, text: "Chaliye Sudoku khelte hain", emoji: "🔢" },
  { icon: HeartHandshake, text: "Yaara se dosti ki baatein", emoji: "💝" },
];

const recentActivity = [
  { type: "music", title: "Hanuman Chalisa", time: "2 hours ago", emoji: "🙏" },
  { type: "game", title: "Sudoku", time: "Yesterday", emoji: "🔢" },
  { type: "talk", title: "Morning Talk", time: "Today", emoji: "🌅" },
];

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const deviceType = useDeviceType();
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const orbSize = deviceType === "desktop" ? "xl" : "lg";

  const handleVoiceResult = useCallback((spokenText: string) => {
    const matched = matchVoiceGameCommand(spokenText);
    if (matched.intent === "open-game" && matched.game) {
      openGame(matched.game);
      return;
    }
    if (matched.intent === "open-games-page") {
      navigate("/games");
      return;
    }
    // Default: start conversation
    navigate("/talk");
  }, [navigate]);

  const toggleVoiceMode = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { navigate("/talk"); return; }

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = "en-IN"; // Best for Hinglish mix
    rec.interimResults = false;
    rec.onstart = () => setIsListening(true);
    rec.onerror = () => {
      setIsListening(false);
      toast({ title: "Dobara boliye", description: "Main sun nahi paaya." });
    };
    rec.onend = () => setIsListening(false);
    rec.onresult = (e: any) => handleVoiceResult(e.results[0][0].transcript);
    
    recognitionRef.current = rec;
    rec.start();
  }, [handleVoiceResult, isListening, navigate, toast]);

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-orange-100 selection:text-orange-900 pb-32 overflow-x-hidden">
      
      {/* ── Background Glow ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-orange-400/10 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] right-[-10%] w-[35%] h-[40%] bg-blue-400/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[25%] w-[50%] h-[40%] bg-emerald-400/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-screen-xl px-4 pt-8 md:px-8 lg:px-12">
        
        {/* ── Header / Welcome ── */}
        <header className="mb-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-orange-600">
               <ShieldCheck className="h-4 w-4" />
               Aapki Trusted Companion
            </div>
            <h1 className="text-4xl font-black text-slate-900 md:text-5xl lg:text-6xl tracking-tight">
              Namaste, <span className="text-orange-500">Yaara</span> Yahi Hai.
            </h1>
            <p className="text-lg text-slate-500 font-medium max-w-xl">
              Aaj ka din halka aur sukoon bhara bitayein. Aapke liye sab kuch pehle se tayyar hai.
            </p>
            <div className="flex items-center gap-2 mt-4">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Yaara Engine v2.4 Active</span>
            </div>
          </div>
          
          <div className="hidden md:flex flex-col items-end text-right">
             <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Local Time</p>
                <p className="text-2xl font-black text-slate-900">
                   {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </p>
             </div>
          </div>
        </header>

        {/* ── Main Activity Grid ── */}
        <section className="mb-12 grid gap-6 md:grid-cols-3">
          {primaryActivities.map((act) => (
            <button
              key={act.label}
              onClick={() => navigate(act.path)}
              className={cn(
                "group relative overflow-hidden rounded-[40px] bg-white p-8 text-left transition-all duration-500",
                "hover:-translate-y-2 hover:shadow-2xl active:scale-[0.98]",
                "border border-slate-100 shadow-xl shadow-slate-200/50",
                act.label === "Talk with Yaara" && "ring-2 ring-orange-500/20 shadow-orange-500/10"
              )}
            >
              <div className={cn(
                "absolute top-0 right-0 h-32 w-32 translate-x-10 -translate-y-10 rounded-full bg-gradient-to-br transition-transform duration-700 group-hover:scale-150 opacity-10",
                act.color
              )} />
              
              <div className="relative z-10 space-y-6">
                <span className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-50 text-4xl shadow-inner group-hover:scale-110 transition-transform duration-500">
                  {act.emoji}
                </span>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 leading-tight">{act.label}</h3>
                  <p className="text-slate-500 font-medium mt-1">{act.desc}</p>
                </div>
                <div className={cn(
                  "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white transition-all duration-300",
                  "bg-gradient-to-r", act.color, act.shadow, "shadow-lg group-hover:px-7"
                )}>
                   Open <Play className="h-3 w-3 fill-current" />
                </div>
              </div>
            </button>
          ))}
        </section>

        {/* ── Voice Hub (The Centerpiece) ── */}
        <section className="relative mb-12 overflow-hidden rounded-[50px] bg-slate-950 p-8 md:p-12 shadow-2xl shadow-slate-950/40">
           <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-orange-950/20" />
           
           <div className="relative z-10 grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div className="space-y-6 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 border border-orange-500/20 px-4 py-2 text-sm font-bold text-orange-400 uppercase tracking-[0.2em]">
                   <Zap className="h-4 w-4" /> Live AI Interaction
                </div>
                <h2 className="text-4xl font-extrabold text-white md:text-5xl leading-tight">
                  Boliye, Main Sun Rahi Hoon.
                </h2>
                <p className="text-lg text-slate-400 font-medium max-w-xl">
                  Aapko thakna nahi hai, bas dil ki baat keh deni hai. Main yahan aapki dosti ke liye haazir hoon.
                </p>
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-4">
                   <div className="flex items-center gap-3 rounded-2xl bg-white/5 border border-white/10 px-6 py-4 backdrop-blur-md">
                      <div className={cn("h-3 w-3 rounded-full animate-pulse", isListening ? "bg-orange-500" : "bg-blue-500")} />
                      <span className="text-white font-bold">
                        {isListening ? "Aapki awaaz capture ho rahi hai..." : "Mic active karne ke liye tap karein"}
                      </span>
                   </div>
                </div>
              </div>

              <div className="flex items-center justify-center py-6">
                <div className="relative scale-110">
                   {/* Background aura for the orb */}
                   <div className={cn(
                     "absolute inset-0 rounded-full blur-[60px] opacity-20 transition-all duration-1000",
                     isListening ? "bg-orange-500 scale-150" : "bg-blue-500 scale-100"
                   )} />
                   <VoiceOrb size={orbSize} isListening={isListening} onClick={toggleVoiceMode} />
                </div>
              </div>
           </div>
        </section>

        {/* ── Activity Dashboard ── */}
        <div className="grid gap-6 lg:grid-cols-[0.6fr_0.4fr]">
           
           {/* Smart Suggestions */}
           <section className="rounded-[40px] bg-white border border-slate-100 p-8 shadow-xl shadow-slate-200/40">
              <div className="mb-6 flex items-center justify-between">
                 <h3 className="text-2xl font-black text-slate-900">Your Journey Today</h3>
                 <span className="rounded-full bg-orange-50 px-4 py-1.5 text-sm font-bold text-orange-600">Daily Routine</span>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                 {smartSuggestions.map((s, i) => (
                    <div key={i} className="group rounded-[32px] bg-slate-50 p-5 border border-transparent transition-all hover:border-slate-200 hover:bg-white hover:shadow-lg cursor-default">
                       <span className="text-3xl mb-4 block group-hover:scale-125 transition-transform">{s.emoji}</span>
                       <p className="font-bold text-slate-700 leading-snug">{s.text}</p>
                       <div className="mt-3 text-xs font-bold text-slate-400 flex items-center gap-1 uppercase tracking-widest">
                          <Clock className="h-3 w-3" /> Step {i + 1}
                       </div>
                    </div>
                 ))}
              </div>
           </section>

           {/* Recent Activity Mini-Feed */}
           <section className="rounded-[40px] bg-white border border-slate-100 p-8 shadow-xl shadow-slate-200/40">
              <div className="mb-6 flex items-center justify-between">
                 <h3 className="text-2xl font-black text-slate-900">Revisit</h3>
                 <Clock className="h-6 w-6 text-slate-400" />
              </div>
              <div className="space-y-4">
                 {recentActivity.map((r, i) => (
                    <div key={i} className="flex items-center gap-4 rounded-3xl bg-slate-50/50 p-4 transition-colors hover:bg-slate-50">
                       <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm text-2xl">
                          {r.emoji}
                       </div>
                       <div className="flex-1">
                          <p className="font-bold text-slate-900 leading-none">{r.title}</p>
                          <p className="text-sm font-medium text-slate-400 mt-1">{r.time}</p>
                       </div>
                       <button className="h-10 w-10 flex items-center justify-center rounded-full bg-slate-200/50 text-slate-600 hover:bg-slate-200">
                          →
                       </button>
                    </div>
                 ))}
              </div>
           </section>

        </div>

        {/* ── Final Encouragement Footer ── */}
        <footer className="mt-12 text-center p-8 rounded-[40px] bg-gradient-to-r from-orange-50 via-white to-blue-50 border border-slate-100">
           <div className="inline-flex items-center gap-2 text-orange-600 font-bold mb-4">
              <Star className="h-5 w-5 fill-current" /> Special Selection For You
           </div>
           <p className="text-2xl font-black text-slate-900 italic">
              “Yaara ke saath har pal khubsurat hai.”
           </p>
           <p className="mt-2 text-slate-500 font-medium">Main hamesha aapke ek tap ki duri par hoon.</p>
        </footer>

      </div>
    </div>
  );
};

export default Index;
