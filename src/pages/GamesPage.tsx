import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { GameItem, brainGames, funGames, openGame } from "@/lib/games";

interface GamesCarouselSectionProps {
  title: string;
  games: GameItem[];
}

const GamesCarouselSection = ({ title, games }: GamesCarouselSectionProps) => (
  <section className="space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="text-elderly-lg font-extrabold text-foreground">{title}</h3>
      <p className="text-base font-semibold text-muted-foreground">Swipe or use arrows</p>
    </div>

    <Carousel
      opts={{
        align: "start",
        containScroll: "trimSnaps",
        dragFree: false,
      }}
      className="w-full"
    >
      <CarouselContent className="-ml-3">
        {games.map((game) => (
          <CarouselItem
            key={game.id}
            className="pl-3 basis-[88%] sm:basis-[55%] lg:basis-[38%]"
          >
            <button
              onClick={() => openGame(game)}
              className={`${game.tileClassName} flex h-[160px] w-full snap-start flex-col justify-between rounded-[30px] p-5 text-left shadow-lg transition-transform active:scale-[0.98] sm:h-[176px] sm:p-6`}
              aria-label={`Open ${game.name}`}
            >
              <span className="text-5xl leading-none" aria-hidden="true">
                {game.icon}
              </span>
              <div className="space-y-1">
                <p className="text-2xl font-extrabold leading-tight">{game.name}</p>
                <p className="text-lg font-semibold opacity-90">Tap once to play</p>
              </div>
            </button>
          </CarouselItem>
        ))}
      </CarouselContent>

      <CarouselPrevious className="left-3 top-[calc(50%-0.5rem)] hidden h-12 w-12 border-0 bg-card text-foreground shadow-md hover:bg-card/90 disabled:opacity-30 lg:flex" />
      <CarouselNext className="right-3 top-[calc(50%-0.5rem)] hidden h-12 w-12 border-0 bg-card text-foreground shadow-md hover:bg-card/90 disabled:opacity-30 lg:flex" />
    </Carousel>
  </section>
);

const GamesPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen overflow-x-hidden bg-background pb-28">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pt-6 pb-8 md:max-w-2xl md:px-8 lg:max-w-4xl lg:justify-center lg:px-10">
        <div className="mb-8 flex items-start gap-3">
          <button
            onClick={() => navigate("/")}
            className="rounded-full bg-card p-3 shadow-sm"
            aria-label="Back"
          >
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </button>

          <div className="space-y-1 pt-1">
            <h2 className="text-elderly-xl font-extrabold text-foreground">Games</h2>
            <p className="text-elderly-base text-muted-foreground">
              Ek tap kijiye aur seedha khelna shuru kijiye.
            </p>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-8">
          <GamesCarouselSection title="Fun Games" games={funGames} />
          <GamesCarouselSection title="Brain Games" games={brainGames} />
        </div>
      </div>
    </div>
  );
};

export default GamesPage;
