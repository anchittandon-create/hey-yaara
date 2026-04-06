import { openExternalUrlInNewTab } from "@/lib/external-links";

export type GameCategory = "fun" | "brain";

export interface GameItem {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  category: GameCategory;
  url: string;
  tileClassName: string;
  aliases: string[];
}

export interface VoiceCommandMatch {
  intent: "open-games-page" | "open-game" | "none";
  game?: GameItem;
}

export const gamesCatalog: GameItem[] = [
  {
    id: "ludo",
    name: "Ludo",
    shortName: "Ludo",
    icon: "🎲",
    category: "fun",
    url: "https://www.crazygames.com/game/ludo-hero",
    tileClassName: "bg-primary text-primary-foreground",
    aliases: ["ludo", "lodu"],
  },
  {
    id: "snakes-and-ladders",
    name: "Snakes & Ladders",
    shortName: "Snakes",
    icon: "🐍",
    category: "fun",
    url: "https://www.crazygames.com/game/snakes-and-ladders",
    tileClassName: "bg-yaara-green text-secondary-foreground",
    aliases: [
      "snakes and ladders",
      "snake and ladder",
      "snake ladders",
      "saap seedhi",
      "saanp seedhi",
      "snakes",
    ],
  },
  {
    id: "air-hockey",
    name: "Air Hockey",
    shortName: "Hockey",
    icon: "🏒",
    category: "fun",
    url: "https://www.crazygames.com/game/air-hockey-cup",
    tileClassName: "bg-sky-500 text-white",
    aliases: ["air hockey", "hockey", "speed hockey", "table hockey"],
  },
  {
    id: "carrom",
    name: "Carrom",
    shortName: "Carrom",
    icon: "⚪",
    category: "fun",
    url: "https://playgama.com/game/carrom-with-buddies",
    tileClassName: "bg-amber-500 text-amber-950",
    aliases: ["carrom", "karam", "caram"],
  },
  {
    id: "tic-tac-toe",
    name: "Tic Tac Toe",
    shortName: "Tic Tac Toe",
    icon: "❌",
    category: "fun",
    url: "https://www.crazygames.com/game/tic-tac-toe",
    tileClassName: "bg-rose-500 text-white",
    aliases: ["tic tac toe", "tic-tac-toe", "noughts and crosses", "x o"],
  },
  {
    id: "bubble-shooter",
    name: "Bubble Shooter",
    shortName: "Bubble",
    icon: "🫧",
    category: "fun",
    url: "https://www.crazygames.com/game/bubble-woods",
    tileClassName: "bg-violet-500 text-white",
    aliases: ["bubble shooter", "bubble", "bubbles"],
  },
  {
    id: "memory-game",
    name: "Memory Game",
    shortName: "Memory",
    icon: "🧠",
    category: "brain",
    url: "https://www.crazygames.com/game/memory-cards-sni",
    tileClassName: "bg-emerald-500 text-white",
    aliases: ["memory", "memory game", "cards", "matching game", "match game"],
  },
  {
    id: "quiz-game",
    name: "Quiz Game",
    shortName: "Quiz",
    icon: "❓",
    category: "brain",
    url: "https://www.crazygames.com/game/quizzland-lite",
    tileClassName: "bg-yaara-gold text-accent-foreground",
    aliases: ["quiz", "quiz game", "trivia", "question game", "sawal"],
  },
];

export const funGames = gamesCatalog.filter((game) => game.category === "fun");
export const brainGames = gamesCatalog.filter((game) => game.category === "brain");

const gamesPageAliases = [
  "game khelna hai",
  "games khelna hai",
  "game khelo",
  "games kholo",
  "game kholo",
  "games chalao",
  "game chalao",
  "koi game",
  "game open",
];

const normalizeVoiceText = (input: string) =>
  input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export const matchVoiceGameCommand = (input: string): VoiceCommandMatch => {
  const normalizedInput = normalizeVoiceText(input);

  if (!normalizedInput) {
    return { intent: "none" };
  }

  const matchedGame = gamesCatalog.find((game) =>
    game.aliases.some((alias) => normalizedInput.includes(normalizeVoiceText(alias))),
  );

  if (matchedGame) {
    return { intent: "open-game", game: matchedGame };
  }

  if (gamesPageAliases.some((alias) => normalizedInput.includes(normalizeVoiceText(alias)))) {
    return { intent: "open-games-page" };
  }

  return { intent: "none" };
};

export const openGame = (game: GameItem) => {
  return openExternalUrlInNewTab(game.url);
};
