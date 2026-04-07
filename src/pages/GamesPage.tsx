/**
 * GamesPage.tsx  –  Yaara Premium Games Hub
 *
 * A high-end gallery of 25+ games curated for elderly users.
 * Features:
 *  - Categorized Carousels (Brain & Fun)
 *  - Premium Game Cards
 *  - Unified Hub Aesthetics
 */

import { ArrowLeft, Sparkles, Brain, Joystick, Star, Gamepad2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { GameItem, brainGames, funGames, openGame } from "@/lib/games";
import { useDeviceType } from "@/hooks/use-device-type";
import { cn } from "@/lib/utils";

const gameTileSize = (deviceType: string) => {
  if (deviceType === "desktop") return "basis-[31%]";
  if (deviceType === "tablet") return "basis-[42%]";
  return "basis-[85%]";
};

const GamesSection = ({
  title,
  subtitle,
  games,
  icon: Icon,
  accentColor,
  tileClassName,
}: {
  title: string;
  subtitle: string;
  games: GameItem[];
  icon: any;
  accentColor: string;
  tileClassName: string;
}) => (
  <section className="relative overflow-hidden rounded-[48px] bg-white p-6 shadow-2xl shadow-slate-200/50 md:p-10 border border-slate-100">
    <div className="absolute top-0 right-0 h-40 w-40 -translate-y-10 translate-x-10 rounded-full blur-[80px] opacity-10" style={{ backgroundColor: accentColor }} />
    
    <div className="mb-8 flex items-center justify-between gap-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
           <Icon className="h-4 w-4" /> Categorized Selection
        </div>
        <h2 className="text-3xl font-black text-slate-900 md:text-4xl">{title}</h2>
        <p className="text-lg font-medium text-slate-500">{subtitle}</p>
      </div>
      <div className="hidden h-14 w-14 items-center justify-center rounded-3xl bg-slate-50 shadow-inner md:flex">
        <Sparkles className="h-7 w-7 text-amber-500" />
      </div>
    </div>

    <Carousel
      opts={{ align: "start", containScroll: "trimSnaps" }}
      className="w-full relative z-10"
    >
      <CarouselContent className="-ml-6">
        {games.map((game) => (
          <CarouselItem key={game.id} className={`pl-6 ${tileClassName}`}>
            <button
              onClick={() => openGame(game)}
              className={cn(
                game.tileClassName,
                "group relative flex min-h-[260px] w-full flex-col justify-between overflow-hidden rounded-[40px] p-8 text-left shadow-xl transition-all duration-500",
                "hover:-translate-y-2 hover:shadow-2xl active:scale-[0.98]"
              )}
            >
              <div className="absolute top-0 right-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-white/10 group-hover:scale-150 transition-transform duration-700" />
              
              <span className="text-7xl leading-none drop-shadow-md group-hover:rotate-12 transition-transform duration-500">{game.icon}</span>
              
              <div className="space-y-4">
                <div>
                   <p className="text-sm font-bold text-white/70 uppercase tracking-widest">Tap to start</p>
                   <p className="text-3xl font-black leading-tight text-white drop-shadow-sm">{game.name}</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-md px-4 py-2 text-sm font-bold text-white shadow-sm group-hover:bg-white/30">
                   Play Now <Star className="h-3 w-3 fill-current" />
                </div>
              </div>
            </button>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="left-4 h-12 w-12 border-none bg-white/90 text-slate-900 shadow-2xl backdrop-blur-md hover:bg-white" />
      <CarouselNext className="right-4 h-12 w-12 border-none bg-white/90 text-slate-900 shadow-2xl backdrop-blur-md hover:bg-white" />
    </Carousel>
  </section>
);

const GamesPage = () => {
  const navigate = useNavigate();
  const deviceType = useDeviceType();
  const tileClassName = gameTileSize(deviceType);

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-emerald-100 selection:text-emerald-900 pb-40 overflow-x-hidden">
      
      {/* ── Background Glow ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-5%] right-[-10%] w-[45%] h-[40%] bg-emerald-400/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[20%] left-[-10%] w-[40%] h-[45%] bg-purple-400/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative mx-auto w-full max-w-screen-xl px-4 pt-8 md:px-8 lg:px-12">
        
        {/* ── Header ── */}
        <header className="mb-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center rounded-[48px] bg-white p-8 md:p-12 shadow-2xl shadow-slate-200/50 border border-slate-100">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-600 uppercase tracking-widest">
                <Joystick className="h-4 w-4" /> Fun & Mind Fitness
            </div>
            <h1 className="text-4xl font-black text-slate-900 md:text-6xl tracking-tight leading-tight">
               Khelna Shuru Karein. <br/><span className="text-emerald-500">Aapka Manoranjan.</span>
            </h1>
            <p className="mt-3 text-lg leading-8 text-slate-500 font-medium max-w-xl">
               Har mood ke liye games — aaram daayak, thoda sa dimag chalane wala, aur mazedar.
            </p>
          </div>
          <button
            onClick={() => navigate("/")}
            className="group inline-flex items-center justify-center rounded-3xl bg-slate-900 px-8 py-5 text-base font-bold text-white shadow-xl transition-all duration-300 hover:bg-slate-800 hover:-translate-x-1 active:scale-95"
          >
            <ArrowLeft className="mr-3 h-5 w-5 transition-transform group-hover:-translate-x-1" /> Wapas Home
          </button>
        </header>

        {/* ── Main Sections ── */}
        <div className="space-y-12 pb-8">
          <GamesSection
            title="🎉 Fun Time"
            subtitle="Mazedar aur classic games, sabke liye."
            games={funGames}
            icon={Gamepad2}
            accentColor="#10b981"
            tileClassName={tileClassName}
          />
          <GamesSection
            title="🧠 Mind Sharpening"
            subtitle="Halka sa dimag chalane ke liye puzzle selection."
            games={brainGames}
            icon={Brain}
            accentColor="#6366f1"
            tileClassName={tileClassName}
          />
        </div>

        {/* ── Footer / Quick Switch ── */}
        <footer className="mt-12 text-center p-12 rounded-[50px] bg-gradient-to-br from-emerald-50 via-white to-indigo-50 border border-slate-100 shadow-xl shadow-slate-200/20">
           <div className="inline-flex items-center gap-2 text-emerald-600 font-bold mb-6">
              <Star className="h-5 w-5 fill-current" /> Daily Activity Recommendation
           </div>
           <p className="text-3xl font-black text-slate-900 max-w-2xl mx-auto leading-tight italic">
              “Khelne se man halka hota hai aur umar kam mehsoos hoti hai.”
           </p>
           <p className="mt-4 text-slate-500 font-bold uppercase tracking-widest text-sm">Har roz ek game zaroor khelein</p>
        </footer>
      </div>
    </div>
  );
};

export default GamesPage;
