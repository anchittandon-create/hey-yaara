import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const games = [
  { name: "Ludo", emoji: "🎲", color: "bg-primary", url: "https://www.crazygames.com/game/ludo-hero" },
  { name: "Memory", emoji: "🧠", color: "bg-yaara-green", url: "https://www.crazygames.com/game/memory-match" },
  { name: "Quiz", emoji: "❓", color: "bg-yaara-gold", url: "https://www.crazygames.com/game/trivia-crack" },
  { name: "Sudoku", emoji: "🔢", color: "bg-secondary", url: "https://www.crazygames.com/game/daily-sudoku" },
];

const GamesPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-4">
        <button onClick={() => navigate("/")} className="p-3 rounded-full bg-card" aria-label="Back">
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </button>
        <h2 className="text-elderly-lg font-bold text-foreground">Games 🎮</h2>
      </div>

      {/* Game Cards */}
      <div className="px-4 grid grid-cols-2 gap-4">
        {games.map((game) => (
          <button
            key={game.name}
            onClick={() => window.open(game.url, "_blank")}
            className={`${game.color} rounded-3xl p-6 flex flex-col items-center justify-center gap-3 aspect-square shadow-lg transition-transform active:scale-95`}
          >
            <span className="text-5xl">{game.emoji}</span>
            <span className="text-elderly-lg font-bold text-primary-foreground">{game.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default GamesPage;
