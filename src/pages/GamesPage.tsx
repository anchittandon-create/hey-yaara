import { ArrowLeft, Sparkles } from "lucide-react";
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

const gameTileSize = (deviceType: string) => {
  if (deviceType === "desktop") {
    return "basis-[31%]";
  }

  if (deviceType === "tablet") {
    return "basis-[42%]";
  }

  return "basis-[85%]";
};

const GamesSection = ({
  title,
  subtitle,
  games,
  tileClassName,
}: {
  title: string;
  subtitle: string;
  games: GameItem[];
  tileClassName: string;
}) => (
  <section className="rounded-[36px] bg-gradient-to-r from-white/90 to-green-50/90 p-6 shadow-xl backdrop-blur-sm md:p-8">
    <div className="mb-6 flex items-center justify-between gap-4">
      <div>
        <h2 className="text-2xl font-extrabold text-gray-800 md:text-3xl">{title}</h2>
        <p className="text-lg font-medium text-green-700">{subtitle}</p>
      </div>
      <span className="hidden rounded-full bg-green-100 px-4 py-2 text-green-600 md:inline-flex">
        <Sparkles className="h-6 w-6" />
      </span>
    </div>

    <Carousel
      opts={{
        align: "start",
        containScroll: "trimSnaps",
      }}
      className="w-full"
    >
      <CarouselContent className="-ml-4">
        {games.map((game) => (
          <CarouselItem key={game.id} className={`pl-4 ${tileClassName}`}>
            <button
              onClick={() => openGame(game)}
              className={`${game.tileClassName} flex min-h-[220px] w-full flex-col justify-between rounded-[36px] p-6 text-left shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl active:scale-95 md:min-h-[240px]`}
            >
              <span className="text-6xl leading-none drop-shadow-sm">{game.icon}</span>
              <div className="space-y-3">
                <p className="text-2xl font-extrabold leading-tight text-white drop-shadow-sm">{game.name}</p>
                <p className="text-lg font-semibold text-white/90 drop-shadow-sm">Ek tap mein shuru</p>
              </div>
            </button>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="left-4 top-[calc(50%-0.5rem)] hidden h-12 w-12 border-2 border-green-200 bg-white text-green-700 shadow-lg lg:flex hover:bg-green-50" />
      <CarouselNext className="right-4 top-[calc(50%-0.5rem)] hidden h-12 w-12 border-2 border-green-200 bg-white text-green-700 shadow-lg lg:flex hover:bg-green-50" />
    </Carousel>
  </section>
);

const GamesPage = () => {
  const navigate = useNavigate();
  const deviceType = useDeviceType();
  const tileClassName = gameTileSize(deviceType);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(187,247,208,0.85),_transparent_30%),_linear-gradient(180deg,#f8fffb_0%,#e8fff1_100%)] pb-40">
      <div className="mx-auto w-full max-w-screen-2xl px-4 pt-6 md:px-8 md:pt-8 lg:px-12">
        <div className="mb-8 rounded-[42px] bg-white/95 p-6 shadow-[0_40px_120px_rgba(144,205,145,0.18)] backdrop-blur-sm md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 md:text-4xl">🎮 Games to brighten your day</h1>
              <p className="mt-3 text-lg leading-8 text-slate-600 md:text-xl">
                Har mood ke liye games. Aaram se choose karein, phir bas ek tap mein shuru karein.
              </p>
            </div>
            <button
              onClick={() => navigate("/")}
              className="inline-flex items-center justify-center rounded-full bg-emerald-100 px-5 py-3 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-200"
              aria-label="Back"
            >
              <ArrowLeft className="mr-2 h-5 w-5" /> Wapas Home
            </button>
          </div>
        </div>

        <div className="space-y-8 pb-8">
          <GamesSection
            title="🎉 Fun Games"
            subtitle="Mazedar aur pehchaan wale games"
            games={funGames}
            tileClassName={tileClassName}
          />
          <GamesSection
            title="🧠 Brain Games"
            subtitle="Halka sa dimag chalane ke liye"
            games={brainGames}
            tileClassName={tileClassName}
          />
        </div>
      </div>
    </div>
  );
};

export default GamesPage;
