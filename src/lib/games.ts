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
    id: "sudoku",
    name: "Sudoku",
    shortName: "Sudoku",
    icon: "🔢",
    category: "brain",
    url: "https://sudoku.com/play/easy",
    tileClassName: "bg-indigo-500 text-white",
    aliases: ["sudoku", "number game", "ankh game"],
  },
  {
    id: "word-search",
    name: "Word Search",
    shortName: "Word Search",
    icon: "🔤",
    category: "brain",
    url: "https://thewordsearch.com/",
    tileClassName: "bg-pink-500 text-white",
    aliases: ["word search", "shabd khoj", "find words"],
  },
  {
    id: "jigsaw-puzzle",
    name: "Jigsaw Puzzle",
    shortName: "Jigsaw",
    icon: "🧩",
    category: "fun",
    url: "https://www.jigsawplanet.com/",
    tileClassName: "bg-orange-500 text-white",
    aliases: ["jigsaw", "puzzle", "picture puzzle"],
  },
  {
    id: "crossword",
    name: "Crossword",
    shortName: "Crossword",
    icon: "📝",
    category: "brain",
    url: "https://www.boatloadpuzzles.com/playcrossword",
    tileClassName: "bg-yellow-600 text-white",
    aliases: ["crossword", "cross word"],
  },
  {
    id: "2048",
    name: "2048",
    shortName: "2048",
    icon: "🔢",
    category: "brain",
    url: "https://play2048.co/",
    tileClassName: "bg-amber-700 text-white",
    aliases: ["2048", "number puzzle"],
  },
  {
    id: "checkers",
    name: "Checkers",
    shortName: "Checkers",
    icon: "⚫",
    category: "fun",
    url: "https://www.crazygames.com/game/checkers-classic",
    tileClassName: "bg-neutral-600 text-white",
    aliases: ["checkers", "damro", "dama"],
  },
  {
    id: "backgammon",
    name: "Backgammon",
    shortName: "Backgammon",
    icon: "🎲",
    category: "fun",
    url: "https://www.crazygames.com/game/backgammon-classic",
    tileClassName: "bg-red-600 text-white",
    aliases: ["backgammon"],
  },
  {
    id: "dominoes",
    name: "Dominoes",
    shortName: "Dominoes",
    icon: "🁡",
    category: "fun",
    url: "https://www.crazygames.com/game/dominoes-classic",
    tileClassName: "bg-zinc-700 text-white",
    aliases: ["domino", "dominoes"],
  },
  {
    id: "bejeweled",
    name: "Bejeweled",
    shortName: "Bejeweled",
    icon: "💎",
    category: "fun",
    url: "https://www.crazygames.com/game/bejeweled-classic",
    tileClassName: "bg-purple-500 text-white",
    aliases: ["bejeweled", "jewels", "diamond game"],
  },
  {
    id: "minesweeper",
    name: "Minesweeper",
    shortName: "Minesweeper",
    icon: "💣",
    category: "brain",
    url: "https://minesweeperonline.com/",
    tileClassName: "bg-gray-600 text-white",
    aliases: ["minesweeper", "mine game"],
  },
  {
    id: "hangman",
    name: "Hangman",
    shortName: "Hangman",
    icon: "☠️",
    category: "brain",
    url: "https://www.crazygames.com/game/hangman-classic",
    tileClassName: "bg-slate-700 text-white",
    aliases: ["hangman", "guessing game"],
  },
  {
    id: "connect-four",
    name: "Connect Four",
    shortName: "Connect 4",
    icon: "🔴",
    category: "fun",
    url: "https://www.crazygames.com/game/connect-4",
    tileClassName: "bg-red-500 text-white",
    aliases: ["connect four", "connect 4", "four in a row"],
  },
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
    id: "chess",
    name: "Chess",
    shortName: "Chess",
    icon: "♟️",
    category: "fun",
    url: "https://www.crazygames.com/game/master-chess",
    tileClassName: "bg-stone-500 text-white",
    aliases: ["chess", "shatranj"],
  },
  {
    id: "pool",
    name: "8 Ball Pool",
    shortName: "Pool",
    icon: "🎱",
    category: "fun",
    url: "https://www.crazygames.com/game/8-ball-pool-billiards-multiplayer",
    tileClassName: "bg-teal-600 text-white",
    aliases: ["pool", "8 ball pool", "billiards"],
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
  {
    id: "solitaire",
    name: "Solitaire",
    shortName: "Solitaire",
    icon: "🃏",
    category: "brain",
    url: "https://www.crazygames.com/game/solitaire-classic",
    tileClassName: "bg-fuchsia-500 text-white",
    aliases: ["solitaire", "cards solitaire", "patience"],
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
