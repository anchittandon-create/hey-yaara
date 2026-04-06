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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,230,179,0.85),_transparent_32%),_linear-gradient(180deg,#fff8f0_0%,#fff4e6_100%)] pb-40">
      <div className="mx-auto w-full max-w-screen-2xl px-4 pt-6 md:px-8 md:pt-8 lg:px-12">
        <div className="mb-8 rounded-[42px] bg-white/95 p-6 shadow-[0_40px_120px_rgba(252,166,79,0.18)] backdrop-blur-sm md:p-8">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 md:text-4xl">🎵 Music that feels like home</h1>
              <p className="mt-3 text-lg leading-8 text-slate-600 md:text-xl">
                Gaane dhoondhna ab aur bhi asaan. Search karein ya voice se seedha play karein.
              </p>
            </div>
            <div className="rounded-[32px] border border-orange-100 bg-orange-50/90 px-5 py-4 text-sm font-semibold text-orange-700 shadow-sm">
              Recommended by Yaara</div>
          </div>

          <div className="relative">
            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-orange-500">
              <Search className="h-8 w-8" />
            </div>
            <input
              type="text"
              placeholder="Kya sunna chahte hain? Gaana ya genre bolo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-[40px] border border-orange-200 bg-white py-5 pl-20 pr-6 text-xl font-medium text-slate-900 placeholder:text-orange-400 shadow-[0_20px_60px_rgba(252,166,79,0.12)] focus:border-orange-300 focus:outline-none focus:ring-4 focus:ring-orange-100"
            />
          </div>
        </div>

        <div className="space-y-8 pb-8">
          {filteredSections.map((section) => (
            <section key={section.title} className="rounded-[42px] bg-gradient-to-br from-white/95 to-orange-50/90 p-6 shadow-[0_40px_100px_rgba(247,168,77,0.14)] backdrop-blur-sm md:p-8">
              <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900 md:text-3xl">{section.title}</h2>
                  <p className="text-base font-medium text-orange-700 md:text-lg">{section.subtitle}</p>
                </div>
                {section.title === "Recommended for You" && (
                  <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-800 shadow-sm">
                    <Heart className="h-5 w-5" /> Curated picks
                  </div>
                )}
              </div>

              <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide">
                {section.songs.map((song) => (
                  <button
                    key={`${section.title}-${song.title}`}
                    onClick={() =>
                      openExternalUrlInNewTab(
                        `https://www.youtube.com/results?search_query=${encodeURIComponent(song.query)}`,
                      )
                    }
                    className="min-w-[280px] flex-shrink-0 rounded-[36px] bg-white p-6 shadow-[0_24px_60px_rgba(249,168,79,0.18)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(249,168,79,0.25)] active:scale-95 md:min-w-[320px]"
                  >
                    <div className="mb-6 flex h-32 items-center justify-center rounded-[24px] bg-gradient-to-br from-orange-100 to-amber-150 text-6xl shadow-inner text-orange-700">
                      {song.badge}
                    </div>
                    <div className="space-y-3">
                      <p className="text-xl font-bold text-slate-900 leading-tight">{song.title}</p>
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-orange-600">{song.genre}</p>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="rounded-full bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700">
                          Play now
                        </span>
                        <div className="rounded-full bg-orange-500 p-3 text-white shadow-lg">
                          <Play className="h-5 w-5" />
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
