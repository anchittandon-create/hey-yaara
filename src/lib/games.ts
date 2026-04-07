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
    aliases: ["ludo", "lodu", "ludo khelna hai"],
  },
  {
    id: "sudoku",
    name: "Sudoku",
    shortName: "Sudoku",
    icon: "🔢",
    category: "brain",
    url: "https://www.websudoku.com/?level=1",
    tileClassName: "bg-indigo-500 text-white",
    aliases: ["sudoku", "number game", "ankh game", "sudoku khelna hai"],
  },
  {
    id: "solitaire",
    name: "Solitaire",
    shortName: "Solitaire",
    icon: "🃏",
    category: "brain",
    url: "https://www.247solitaire.com/",
    tileClassName: "bg-fuchsia-500 text-white",
    aliases: ["solitaire", "cards game", "taash", "tas khelna hai"],
  },
  {
    id: "crossword",
    name: "Crossword",
    shortName: "Crossword",
    icon: "📝",
    category: "brain",
    url: "https://www.boatloadpuzzles.com/playcrossword",
    tileClassName: "bg-yellow-600 text-white",
    aliases: ["crossword", "shabd", "shabd paheli"],
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
    id: "snakes-and-ladders",
    name: "Snakes & Ladders",
    shortName: "Snakes",
    icon: "🐍",
    category: "fun",
    url: "https://www.crazygames.com/game/snakes-and-ladders",
    tileClassName: "bg-yaara-green text-white",
    aliases: ["snakes and ladders", "saap seedhi", "saanp seedhi"],
  },
  {
    id: "memory-game",
    name: "Memory Game",
    shortName: "Memory",
    icon: "🧠",
    category: "brain",
    url: "https://www.helpfulgames.com/types-of-games/memory-games.html",
    tileClassName: "bg-emerald-500 text-white",
    aliases: ["memory", "memory game", "dimag wala game"],
  },
  {
    id: "mahjong",
    name: "Mahjong",
    shortName: "Mahjong",
    icon: "🀄",
    category: "brain",
    url: "https://www.crazygames.com/game/mahjong-classic",
    tileClassName: "bg-cyan-600 text-white",
    aliases: ["mahjong", "tile game"],
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
