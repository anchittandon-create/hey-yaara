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
  <section className="rounded-[34px] bg-card/85 p-4 shadow-sm md:p-6">
    <div className="mb-4 flex items-center justify-between gap-4">
      <div>
        <h3 className="text-elderly-lg font-extrabold text-foreground">{title}</h3>
        <p className="text-base font-semibold text-muted-foreground">{subtitle}</p>
      </div>
      <span className="hidden rounded-full bg-primary/10 px-3 py-2 text-primary md:inline-flex">
        <Sparkles className="h-5 w-5" />
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
              className={`${game.tileClassName} flex min-h-[190px] w-full flex-col justify-between rounded-[30px] p-5 text-left shadow-lg transition-transform active:scale-[0.98] hover:scale-[1.01] md:min-h-[210px]`}
            >
              <span className="text-5xl leading-none">{game.icon}</span>
              <div className="space-y-2">
                <p className="text-[1.75rem] font-extrabold leading-tight">{game.name}</p>
                <p className="text-lg font-semibold opacity-90">Ek tap mein shuru</p>
              </div>
            </button>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="left-3 top-[calc(50%-0.5rem)] hidden h-12 w-12 border-0 bg-background text-foreground shadow-md lg:flex" />
      <CarouselNext className="right-3 top-[calc(50%-0.5rem)] hidden h-12 w-12 border-0 bg-background text-foreground shadow-md lg:flex" />
    </Carousel>
  </section>
);

const GamesPage = () => {
  const navigate = useNavigate();
  const deviceType = useDeviceType();
  const tileClassName = gameTileSize(deviceType);

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="mx-auto w-full max-w-screen-2xl px-4 pt-6 md:px-8 md:pt-8 lg:px-12">
        <div className="mb-6 rounded-[34px] bg-white/75 p-5 shadow-[0_18px_50px_rgba(180,120,60,0.12)] backdrop-blur md:p-7">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="rounded-full bg-card p-3 shadow-sm"
              aria-label="Back"
            >
              <ArrowLeft className="h-6 w-6 text-foreground" />
            </button>

            <div>
              <h2 className="text-elderly-xl font-extrabold text-foreground">Games</h2>
              <p className="text-base font-semibold text-muted-foreground">Jo pasand aaye, turant khelna shuru kijiye</p>
            </div>
          </div>
        </div>

        <div className="space-y-6 pb-8">
          <GamesSection
            title="Fun Games"
            subtitle="Mazedar aur pehchaan wale games"
            games={funGames}
            tileClassName={tileClassName}
          />
          <GamesSection
            title="Brain Games"
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
