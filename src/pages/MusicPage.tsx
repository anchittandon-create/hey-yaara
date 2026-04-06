import { useMemo, useState } from "react";
import { ArrowLeft, Heart, Search, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { openExternalUrlInNewTab } from "@/lib/external-links";

interface SongOption {
  title: string;
  badge: string;
  query: string;
  genre: string;
}

interface MusicSection {
  title: string;
  subtitle: string;
  songs: SongOption[];
}

const musicSections: MusicSection[] = [
  {
    title: "Recommended for You",
    subtitle: "Aapke liye specially selected",
    songs: [
      { title: "Hanuman Chalisa", badge: "🙏", query: "Hanuman Chalisa full song", genre: "Bhajan" },
      { title: "Lag Jaa Gale", badge: "🎵", query: "Lag Jaa Gale full song", genre: "Classic" },
      { title: "Mundian To Bach Ke", badge: "💃", query: "Mundian To Bach Ke full song", genre: "Punjabi" },
      { title: "Kabhi Kabhie", badge: "🌙", query: "Kabhi Kabhie full song", genre: "Old Bollywood" },
      { title: "Achyutam Keshavam", badge: "🪔", query: "Achyutam Keshavam full song", genre: "Bhajan" },
      { title: "Om Jai Jagdish", badge: "✨", query: "Om Jai Jagdish full song", genre: "Aarti" },
    ],
  },
  {
    title: "Old Bollywood",
    subtitle: "Purane yaadgaar gaane",
    songs: [
      { title: "Mere Sapno Ki Rani", badge: "🎬", query: "Mere Sapno Ki Rani full song", genre: "Retro" },
      { title: "Dum Maro Dum", badge: "🎵", query: "Dum Maro Dum full song", genre: "Classic" },
      { title: "Tujhe Dekha To", badge: "🌹", query: "Tujhe Dekha To full song", genre: "Romantic" },
      { title: "Ajeeb Dastan Hai Yeh", badge: "📻", query: "Ajeeb Dastan Hai Yeh full song", genre: "Retro" },
      { title: "Tere Bina Zindagi Se", badge: "💔", query: "Tere Bina Zindagi Se full song", genre: "Sad" },
      { title: "Salaam-e-Ishq", badge: "💕", query: "Salaam-e-Ishq full song", genre: "Romantic" },
    ],
  },
  {
    title: "Bhajans",
    subtitle: "Shant aur sukoon bhari dhun",
    songs: [
      { title: "Raghupati Raghav", badge: "📿", query: "Raghupati Raghav full song", genre: "Bhajan" },
      { title: "Shri Ram Dhun", badge: "🌼", query: "Shri Ram Dhun full song", genre: "Devotional" },
      { title: "Gayatri Mantra", badge: "🕉️", query: "Gayatri Mantra full song", genre: "Mantra" },
      { title: "Shiv Dhun", badge: "🌺", query: "Shiv Dhun full song", genre: "Devotional" },
      { title: "Durga Chalisa", badge: "⚡", query: "Durga Chalisa full song", genre: "Chalisa" },
      { title: "Sai Baba Aarti", badge: "🪔", query: "Sai Baba Aarti full song", genre: "Aarti" },
    ],
  },
  {
    title: "Punjabi Songs",
    subtitle: "Thoda mood halka karte hain",
    songs: [
      { title: "Jugni Ji", badge: "🪩", query: "Jugni Ji full song", genre: "Punjabi" },
      { title: "Paani Da Rang", badge: "💧", query: "Paani Da Rang full song", genre: "Soft" },
      { title: "Dil Da Mamla", badge: "💛", query: "Dil Da Mamla full song", genre: "Punjabi" },
      { title: "Laung Da Lashkara", badge: "🌼", query: "Laung Da Lashkara full song", genre: "Dance" },
      { title: "Sohniye", badge: "💖", query: "Sohniye full song", genre: "Romantic" },
      { title: "Tera Mera Pyar", badge: "💑", query: "Tera Mera Pyar full song", genre: "Love" },
    ],
  },
];

const MusicPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const filteredSections = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return musicSections;
    }

    return musicSections
      .map((section) => ({
        ...section,
        songs: section.songs.filter(
          (song) =>
            song.title.toLowerCase().includes(normalizedSearch) ||
            song.genre.toLowerCase().includes(normalizedSearch),
        ),
      }))
      .filter((section) => section.songs.length > 0);
  }, [search]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 pb-40">
      <div className="mx-auto w-full max-w-screen-2xl px-4 pt-6 md:px-8 md:pt-8 lg:px-12">
        {/* Header with Search */}
        <div className="mb-8 rounded-[36px] bg-gradient-to-r from-white/95 to-orange-50/95 p-6 shadow-xl backdrop-blur-sm md:p-8">
          <div className="mb-6 flex items-center gap-4">
            <button onClick={() => navigate("/")} className="rounded-full bg-orange-100 p-3 hover:bg-orange-200 transition-colors">
              <ArrowLeft className="h-6 w-6 text-orange-700" />
            </button>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-800 md:text-3xl">🎵 Music</h1>
              <p className="text-lg font-medium text-orange-700">Gaane aur genres dono se dhoondhiye</p>
            </div>
          </div>

          {/* Large Search Bar */}
          <div className="relative">
            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-orange-500">
              <Search className="h-8 w-8" />
            </div>
            <input
              type="text"
              placeholder="Kya sunna chahte hain? Gaana ya genre bolo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-[32px] border-2 border-orange-200 bg-white/80 py-6 pl-20 pr-6 text-xl font-medium text-gray-800 placeholder:text-orange-400 focus:outline-none focus:ring-4 focus:ring-orange-300 focus:border-orange-400 shadow-lg"
            />
          </div>
        </div>

        {/* Music Sections */}
        <div className="space-y-8 pb-8">
          {filteredSections.map((section) => (
            <section key={section.title} className="rounded-[36px] bg-gradient-to-r from-white/90 to-orange-50/90 p-6 shadow-xl backdrop-blur-sm md:p-8">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold text-gray-800 md:text-3xl">{section.title}</h2>
                  <p className="text-lg font-medium text-orange-700">{section.subtitle}</p>
                </div>
                {section.title === "Recommended for You" && (
                  <div className="rounded-full bg-orange-100 px-4 py-2">
                    <Heart className="h-6 w-6 text-orange-600 fill-current" />
                  </div>
                )}
              </div>

              {/* Horizontal Scroll */}
              <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide">
                {section.songs.map((song) => (
                  <button
                    key={`${section.title}-${song.title}`}
                    onClick={() =>
                      openExternalUrlInNewTab(
                        `https://www.youtube.com/results?search_query=${encodeURIComponent(song.query)}`,
                      )
                    }
                    className="min-w-[280px] flex-shrink-0 rounded-[32px] bg-gradient-to-br from-white to-orange-50 p-6 text-left shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl active:scale-95 md:min-w-[320px]"
                  >
                    <div className="mb-6 flex h-32 items-center justify-center rounded-[24px] bg-gradient-to-br from-orange-100 to-amber-100 text-6xl shadow-inner">
                      {song.badge}
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xl font-extrabold text-gray-800 leading-tight">{song.title}</p>
                        <p className="text-lg font-medium text-orange-600 mt-2">Tap to play on YouTube</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-orange-100 px-4 py-2 text-sm font-bold text-orange-700">
                          {song.genre}
                        </span>
                        <div className="rounded-full bg-orange-500 p-3 text-white shadow-lg">
                          <Play className="h-6 w-6 fill-current" />
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MusicPage;
