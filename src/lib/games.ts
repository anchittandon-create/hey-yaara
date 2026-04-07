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
    name: "Ludo Hero",
    shortName: "Ludo",
    icon: "🎲",
    category: "fun",
    url: "https://www.crazygames.com/game/ludo-hero",
    tileClassName: "bg-orange-500 text-white",
    aliases: ["ludo", "lodu", "ludo khelna hai"],
  },
  {
    id: "tic-tac-toe",
    name: "Tic Tac Toe",
    shortName: "TicTacToe",
    icon: "❌",
    category: "fun",
    url: "https://playtictactoe.org/",
    tileClassName: "bg-blue-500 text-white",
    aliases: ["tic tac toe", "cross and zero", "zero kata"],
  },
  {
    id: "pacman",
    name: "Pacman",
    shortName: "Pacman",
    icon: "🟡",
    category: "fun",
    url: "https://www.google.com/logos/2010/pacman10-i.html",
    tileClassName: "bg-yellow-500 text-slate-900",
    aliases: ["pacman", "pac man", "peckman"],
  },
  {
    id: "pinball",
    name: "Space Pinball",
    shortName: "Pinball",
    icon: "☄️",
    category: "fun",
    url: "https://toytheater.com/space-pinball/",
    tileClassName: "bg-purple-600 text-white",
    aliases: ["pinball", "ball game"],
  },
  {
    id: "uno",
    name: "Uno (4 Colors)",
    shortName: "Uno",
    icon: "🎴",
    category: "fun",
    url: "https://www.cardzmania.com/games/FourColors/start/0",
    tileClassName: "bg-red-500 text-white",
    aliases: ["uno", "card game", "four colors"],
  },
  {
    id: "teen-patti",
    name: "Teen Patti",
    shortName: "Teen Patti",
    icon: "🔱",
    category: "fun",
    url: "https://www.cardzmania.com/games/TeenPatti/start/0",
    tileClassName: "bg-green-700 text-white",
    aliases: ["teen patti", "3 patti", "tin patti", "taash"],
  },
  {
    id: "sudoku",
    name: "Classic Sudoku",
    shortName: "Sudoku",
    icon: "🔢",
    category: "brain",
    url: "https://sudoku.com/easy/",
    tileClassName: "bg-indigo-600 text-white",
    aliases: ["sudoku", "number game", "ankh game", "sudoku khelna hai"],
  },
  {
    id: "solitaire",
    name: "Solitaire",
    shortName: "Solitaire",
    icon: "🃏",
    category: "brain",
    url: "https://www.247solitaire.com/",
    tileClassName: "bg-fuchsia-600 text-white",
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
    url: "https://www.crazygames.com/game/carrom-with-buddies",
    tileClassName: "bg-amber-600 text-white",
    aliases: ["carrom", "karam", "caram"],
  },
  {
    id: "snakes-and-ladders",
    name: "Snakes & Ladders",
    shortName: "Snakes",
    icon: "🐍",
    category: "fun",
    url: "https://www.crazygames.com/game/snakes-and-ladders",
    tileClassName: "bg-emerald-600 text-white",
    aliases: ["snakes and ladders", "saap seedhi", "saanp seedhi"],
  },
  {
    id: "2048",
    name: "2048",
    shortName: "2048",
    icon: "🧱",
    category: "brain",
    url: "https://play2048.co/",
    tileClassName: "bg-rose-500 text-white",
    aliases: ["2048", "twenty forty eight", "math game"],
  },
  {
    id: "word-search",
    name: "Word Search",
    shortName: "Word Search",
    icon: "🔍",
    category: "brain",
    url: "https://thewordsearch.com/puzzle/popular/",
    tileClassName: "bg-blue-600 text-white",
    aliases: ["word search", "word game", "shabd dhoondo"],
  },
  {
    id: "chess",
    name: "Chess",
    shortName: "Chess",
    icon: "♟️",
    category: "brain",
    url: "https://www.sparkchess.com/play-chess-online.html",
    tileClassName: "bg-gray-700 text-white",
    aliases: ["chess", "shatranj", "chess khelna hai"],
  },
  {
    id: "bubble-shooter",
    name: "Bubble Shooter",
    shortName: "Bubbles",
    icon: "🎈",
    category: "fun",
    url: "https://www.bubbleshooter.net/game.php",
    tileClassName: "bg-pink-500 text-white",
    aliases: ["bubble shooter", "gubbara game", "bubbles"],
  },
  {
    id: "jigsaw",
    name: "Jigsaw Puzzle",
    shortName: "Jigsaw",
    icon: "🧩",
    category: "fun",
    url: "https://www.jigsawexplorer.com/",
    tileClassName: "bg-teal-600 text-white",
    aliases: ["jigsaw", "puzzle", "chitra paheli"],
  },
  {
    id: "memory-game",
    name: "Memory Match",
    shortName: "Memory",
    icon: "🧠",
    category: "brain",
    url: "https://www.helpfulgames.com/types-of-games/memory-games.html",
    tileClassName: "bg-violet-600 text-white",
    aliases: ["memory", "memory game", "dimag wala game"],
  },
  {
    id: "mahjong",
    name: "Mahjong",
    shortName: "Mahjong",
    icon: "🀄",
    category: "brain",
    url: "https://www.crazygames.com/game/mahjong-classic",
    tileClassName: "bg-cyan-700 text-white",
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
