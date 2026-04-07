import { useMemo, useState } from "react";
import { Heart, Search, Play } from "lucide-react";
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
      { title: "Hanuman Chalisa",   badge: "🙏", query: "Hanuman Chalisa full song",   genre: "Bhajan" },
      { title: "Lag Jaa Gale",      badge: "🎵", query: "Lag Jaa Gale full song",      genre: "Classic" },
      { title: "Mundian To Bach Ke",badge: "💃", query: "Mundian To Bach Ke full song",genre: "Punjabi" },
      { title: "Kabhi Kabhie",      badge: "🌙", query: "Kabhi Kabhie full song",      genre: "Old Bollywood" },
      { title: "Achyutam Keshavam", badge: "🪔", query: "Achyutam Keshavam full song", genre: "Bhajan" },
      { title: "Om Jai Jagdish",    badge: "✨", query: "Om Jai Jagdish full song",    genre: "Aarti" },
    ],
  },
  {
    title: "Old Bollywood",
    subtitle: "Purane yaadgaar gaane",
    songs: [
      { title: "Mere Sapno Ki Rani",  badge: "🎬", query: "Mere Sapno Ki Rani full song",  genre: "Retro" },
      { title: "Dum Maro Dum",        badge: "🎵", query: "Dum Maro Dum full song",        genre: "Classic" },
      { title: "Tujhe Dekha To",      badge: "🌹", query: "Tujhe Dekha To full song",      genre: "Romantic" },
      { title: "Ajeeb Dastan Hai Yeh",badge: "📻", query: "Ajeeb Dastan Hai Yeh full song",genre: "Retro" },
      { title: "Tere Bina Zindagi Se",badge: "💔", query: "Tere Bina Zindagi Se full song",genre: "Sad" },
      { title: "Salaam-e-Ishq",       badge: "💕", query: "Salaam-e-Ishq full song",       genre: "Romantic" },
    ],
  },
  {
    title: "Bhajans",
    subtitle: "Shant aur sukoon bhari dhun",
    songs: [
      { title: "Raghupati Raghav", badge: "📿", query: "Raghupati Raghav full song", genre: "Bhajan" },
      { title: "Shri Ram Dhun",    badge: "🌼", query: "Shri Ram Dhun full song",    genre: "Devotional" },
      { title: "Gayatri Mantra",   badge: "🕉️", query: "Gayatri Mantra full song",   genre: "Mantra" },
      { title: "Shiv Dhun",        badge: "🌺", query: "Shiv Dhun full song",        genre: "Devotional" },
      { title: "Durga Chalisa",    badge: "⚡", query: "Durga Chalisa full song",    genre: "Chalisa" },
      { title: "Sai Baba Aarti",   badge: "🪔", query: "Sai Baba Aarti full song",   genre: "Aarti" },
    ],
  },
  {
    title: "Punjabi Songs",
    subtitle: "Thoda mood halka karte hain",
    songs: [
      { title: "Jugni Ji",         badge: "🪩", query: "Jugni Ji full song",         genre: "Punjabi" },
      { title: "Paani Da Rang",    badge: "💧", query: "Paani Da Rang full song",    genre: "Soft" },
      { title: "Dil Da Mamla",     badge: "💛", query: "Dil Da Mamla full song",     genre: "Punjabi" },
      { title: "Laung Da Lashkara",badge: "🌼", query: "Laung Da Lashkara full song",genre: "Dance" },
      { title: "Sohniye",          badge: "💖", query: "Sohniye full song",          genre: "Romantic" },
      { title: "Tera Mera Pyar",   badge: "💑", query: "Tera Mera Pyar full song",   genre: "Love" },
    ],
  },
];

/** Open a YouTube search in a new tab */
const searchYouTube = (query: string) => {
  openExternalUrlInNewTab(
    `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
  );
};

const MusicPage = () => {
  const [search, setSearch] = useState("");

  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return musicSections;

    return musicSections
      .map(section => ({
        ...section,
        songs: section.songs.filter(
          song =>
            song.title.toLowerCase().includes(q) ||
            song.genre.toLowerCase().includes(q),
        ),
      }))
      .filter(section => section.songs.length > 0);
  }, [search]);

  /** Handle search form submit — go straight to YouTube */
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (q) searchYouTube(q + " song");
  };

  /** True when user typed something but no local tile matched */
  const noLocalMatch = search.trim() !== "" && filteredSections.length === 0;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,230,179,0.85),_transparent_32%),_linear-gradient(180deg,#fff8f0_0%,#fff4e6_100%)] pb-40">
      <div className="mx-auto w-full max-w-screen-2xl px-4 pt-6 md:px-8 md:pt-8 lg:px-12">

        {/* ── Header card ── */}
        <div className="mb-8 rounded-[42px] bg-white/95 p-6 shadow-[0_40px_120px_rgba(252,166,79,0.18)] backdrop-blur-sm md:p-8">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 md:text-4xl">🎵 Music that feels like home</h1>
              <p className="mt-3 text-lg leading-8 text-slate-600 md:text-xl">
                Kisi bhi gaane ka naam likhein — seedha YouTube pe search ho jaayega.
              </p>
            </div>
            <div className="rounded-[32px] border border-orange-100 bg-orange-50/90 px-5 py-4 text-sm font-semibold text-orange-700 shadow-sm">
              Recommended by Yaara
            </div>
          </div>

          {/* ── Search bar ── */}
          <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-3">
            <div className="relative flex-1">
              <div className="absolute left-6 top-1/2 -translate-y-1/2 text-orange-500">
                <Search className="h-7 w-7" />
              </div>
              <input
                id="music-search"
                type="text"
                placeholder="Koi bhi gaana likhein aur Enter dabayein…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-[40px] border border-orange-200 bg-white py-5 pl-20 pr-6 text-xl font-medium text-slate-900 placeholder:text-orange-400 shadow-[0_20px_60px_rgba(252,166,79,0.12)] focus:border-orange-300 focus:outline-none focus:ring-4 focus:ring-orange-100"
              />
            </div>
            {/* Search button — always shows, acts as YouTube search */}
            <button
              type="submit"
              aria-label="Search on YouTube"
              className="flex items-center gap-2 rounded-[32px] bg-red-500 px-6 py-5 text-base font-bold text-white shadow-lg transition hover:bg-red-600 active:scale-95"
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.28 8.28 0 0 0 4.84 1.54V6.75a4.85 4.85 0 0 1-1.07-.06z"/>
              </svg>
              <span className="hidden sm:inline">YouTube pe khojein</span>
            </button>
          </form>

          {/* ── "No local match" CTA ── */}
          {noLocalMatch && (
            <div className="mt-4 flex items-center gap-3 rounded-[24px] bg-orange-50 px-5 py-4">
              <span className="text-2xl">🔍</span>
              <div className="flex-1">
                <p className="font-semibold text-slate-800">
                  "<span className="text-orange-600">{search}</span>" hamare list mein nahi mila
                </p>
                <p className="text-sm text-slate-500">Seedha YouTube pe search karein?</p>
              </div>
              <button
                onClick={() => searchYouTube(search + " song")}
                className="rounded-full bg-red-500 px-5 py-2 text-sm font-bold text-white shadow transition hover:bg-red-600"
              >
                YouTube pe Khojein
              </button>
            </div>
          )}
        </div>

        {/* ── Song tiles ── */}
        <div className="space-y-8 pb-8">
          {filteredSections.map(section => (
            <section
              key={section.title}
              className="rounded-[42px] bg-gradient-to-br from-white/95 to-orange-50/90 p-6 shadow-[0_40px_100px_rgba(247,168,77,0.14)] backdrop-blur-sm md:p-8"
            >
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
                {section.songs.map(song => (
                  <button
                    key={`${section.title}-${song.title}`}
                    onClick={() => searchYouTube(song.query)}
                    className="min-w-[280px] flex-shrink-0 rounded-[36px] bg-white p-6 shadow-[0_24px_60px_rgba(249,168,79,0.18)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(249,168,79,0.25)] active:scale-95 md:min-w-[320px]"
                  >
                    <div className="mb-6 flex h-32 items-center justify-center rounded-[24px] bg-gradient-to-br from-orange-100 to-amber-50 text-6xl shadow-inner">
                      {song.badge}
                    </div>
                    <div className="space-y-3">
                      <p className="text-xl font-bold leading-tight text-slate-900">{song.title}</p>
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-orange-600">{song.genre}</p>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="rounded-full bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700">
                          YouTube pe play karein
                        </span>
                        <div className="rounded-full bg-red-500 p-3 text-white shadow-lg">
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
