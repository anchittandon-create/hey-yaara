/**
 * MusicPage.tsx  –  Yaara Premium Music Hub
 *
 * A beautiful dashboard for bhajans, classics, and favorites.
 * Features:
 *  - Premium Song Cards
 *  - YouTube Search Integration
 *  - Curated Playlists for Seniors
 */

import { useMemo, useState } from "react";
import { Heart, Search, Play, Music, ArrowLeft, Star, Sparkles, Youtube } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { openExternalUrlInNewTab } from "@/lib/external-links";
import { cn } from "@/lib/utils";

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
    title: "✨ Recommended for You",
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
    title: "🎬 Old Bollywood",
    subtitle: "Purane yaadgaar gaane aur yaadein",
    songs: [
      { title: "Mere Sapno Ki Rani",  badge: "🚂", query: "Mere Sapno Ki Rani full song",  genre: "Retro" },
      { title: "Dum Maro Dum",        badge: "🎵", query: "Dum Maro Dum full song",        genre: "Classic" },
      { title: "Tujhe Dekha To",      badge: "🌹", query: "Tujhe Dekha To full song",      genre: "Romantic" },
      { title: "Ajeeb Dastan Hai Yeh",badge: "📻", query: "Ajeeb Dastan Hai Yeh full song",genre: "Retro" },
      { title: "Tere Bina Zindagi Se",badge: "💔", query: "Tere Bina Zindagi Se full song",genre: "Sad" },
      { title: "Salaam-e-Ishq",       badge: "💕", query: "Salaam-e-Ishq full song",       genre: "Romantic" },
    ],
  },
  {
    title: "📿 Devotional",
    subtitle: "Shant aur sukoon bhari dhun",
    songs: [
      { title: "Raghupati Raghav", badge: "🕉️", query: "Raghupati Raghav full song", genre: "Bhajan" },
      { title: "Shri Ram Dhun",    badge: "🌼", query: "Shri Ram Dhun full song",    genre: "Devotional" },
      { title: "Gayatri Mantra",   badge: "✨", query: "Gayatri Mantra full song",   genre: "Mantra" },
      { title: "Shiv Dhun",        badge: "🌺", query: "Shiv Dhun full song",        genre: "Devotional" },
      { title: "Durga Chalisa",    badge: "⚡", query: "Durga Chalisa full song",    genre: "Chalisa" },
      { title: "Sai Baba Aarti",   badge: "🪔", query: "Sai Baba Aarti full song",   genre: "Aarti" },
    ],
  },
  {
    title: "🕺 Punjabi Beat",
    subtitle: "Thoda mood halka aur energetic karte hain",
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

const searchYouTube = (query: string) => {
  openExternalUrlInNewTab(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
};

const MusicPage = () => {
  const navigate = useNavigate();
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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (q) searchYouTube(q + " song");
  };

  const noLocalMatch = search.trim() !== "" && filteredSections.length === 0;

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-orange-100 selection:text-orange-900 pb-40 overflow-x-hidden">
      
      {/* ── Background Glow ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-5%] left-[-10%] w-[45%] h-[40%] bg-orange-400/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] right-[-10%] w-[40%] h-[45%] bg-rose-400/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative mx-auto w-full max-w-screen-xl px-4 pt-8 md:px-8 lg:px-12">
        
        {/* ── Header Container ── */}
        <header className="mb-10 rounded-[48px] bg-white p-8 md:p-12 shadow-2xl shadow-slate-200/50 border border-slate-100">
          <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-4 py-2 text-sm font-bold text-orange-600 uppercase tracking-widest">
                  <Music className="h-4 w-4" /> Melodies for relaxation
              </div>
              <h1 className="text-4xl font-black text-slate-900 md:text-6xl tracking-tight leading-tight">
                 Suron Ki Duniya. <br/><span className="text-orange-500">Aapka Apna Radio.</span>
              </h1>
              <p className="mt-3 text-lg leading-8 text-slate-500 font-medium max-w-xl">
                 Apne pasand ka koi bhi gaana khojein, ya phir niche diye gaye curated lists se chunein.
              </p>
            </div>
            <button
               onClick={() => navigate("/")}
               className="group inline-flex items-center justify-center rounded-3xl bg-slate-900 px-8 py-5 text-base font-bold text-white shadow-xl transition-all duration-300 hover:bg-slate-800 hover:-translate-x-1 active:scale-95"
            >
               <ArrowLeft className="mr-3 h-5 w-5 transition-transform group-hover:-translate-x-1" /> Wapas Home
            </button>
          </div>

          {/* ── Search Bar ── */}
          <form onSubmit={handleSearchSubmit} className="relative z-10 flex flex-col sm:flex-row items-stretch gap-4">
            <div className="relative flex-1">
              <div className="absolute left-7 top-1/2 -translate-y-1/2 text-orange-500">
                <Search className="h-8 w-8" />
              </div>
              <input
                id="music-search"
                type="text"
                placeholder="Koi bhi gaana likhein..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-[40px] border border-orange-100 bg-slate-50 py-6 pl-20 pr-8 text-xl font-bold text-slate-900 placeholder:text-slate-400 shadow-inner focus:bg-white focus:border-orange-300 focus:outline-none focus:ring-4 focus:ring-orange-100 transition-all"
              />
            </div>
            <button
              type="submit"
              className="flex items-center justify-center gap-3 rounded-[32px] bg-red-600 px-10 py-6 text-lg font-black text-white shadow-xl shadow-red-200 transition-all hover:bg-red-700 hover:-translate-y-1 active:scale-95"
            >
              <Youtube className="h-7 w-7" />
              <span>Khojein</span>
            </button>
          </form>

          {/* ── No Match Alert ── */}
          {noLocalMatch && (
            <div className="mt-6 flex items-center gap-4 rounded-[32px] bg-orange-50/80 p-5 border border-orange-100 md:animate-in md:fade-in md:slide-in-from-top-4">
              <Sparkles className="h-8 w-8 text-orange-500" />
              <div className="flex-1">
                <p className="text-lg font-bold text-slate-800 italic">
                  Abhi YouTube pe "<span className="text-orange-600 underline">探索: {search}</span>" filter kar rahe hain.
                </p>
                <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Click khojein to play everywhere</p>
              </div>
            </div>
          )}
        </header>

        {/* ── Music Sections ── */}
        <div className="space-y-16 pb-8">
          {filteredSections.map(section => (
            <section key={section.title} className="relative">
              <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between px-4">
                <div>
                   <h2 className="text-4xl font-black text-slate-900 tracking-tight">{section.title}</h2>
                   <p className="text-lg font-medium text-slate-500 mt-1">{section.subtitle}</p>
                </div>
                {section.title.includes("Recommended") && (
                   <span className="inline-flex items-center gap-2 rounded-full bg-white/80 backdrop-blur px-5 py-2 text-sm font-bold text-orange-600 shadow-sm border border-slate-100">
                      <Heart className="h-4 w-4 fill-current" /> Especially for you
                   </span>
                )}
              </div>

              <div className="flex gap-8 overflow-x-auto pb-10 px-4 scrollbar-hide">
                {section.songs.map(song => (
                  <button
                    key={`${section.title}-${song.title}`}
                    onClick={() => searchYouTube(song.query)}
                    className={cn(
                        "min-w-[280px] flex-shrink-0 rounded-[50px] bg-white p-8 group transition-all duration-500",
                        "hover:-translate-y-3 hover:shadow-[0_40px_100px_rgba(255,160,50,0.22)] active:scale-95",
                        "border border-slate-50 shadow-2xl shadow-slate-200/40"
                    )}
                  >
                    <div className="mb-8 flex h-44 items-center justify-center rounded-[40px] bg-slate-50 text-7xl shadow-inner relative overflow-hidden group-hover:bg-orange-50 transition-colors">
                       <div className="absolute inset-0 bg-gradient-to-br from-orange-400/5 to-rose-400/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                       <span className="relative z-10 group-hover:scale-125 transition-transform duration-700">{song.badge}</span>
                    </div>
                    <div className="space-y-4 text-left">
                       <div>
                          <p className="text-sm font-bold uppercase tracking-widest text-orange-500">{song.genre}</p>
                          <p className="text-2xl font-black leading-tight text-slate-900 mt-1">{song.title}</p>
                       </div>
                       <div className="flex items-center justify-between gap-4 pt-4">
                          <span className="text-sm font-bold text-slate-400 line-clamp-1">Listen on YouTube</span>
                          <div className="h-14 w-14 rounded-full bg-slate-900 flex items-center justify-center text-white shadow-xl transition-transform group-hover:scale-110 group-hover:bg-red-600">
                             <Play className="h-6 w-6 fill-current ml-1" />
                          </div>
                       </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* ── Footer ── */}
        <footer className="mt-12 text-center p-12 rounded-[50px] bg-slate-950 text-white shadow-2xl border border-slate-800">
           <div className="inline-flex items-center gap-2 text-orange-400 font-bold mb-6">
              <Star className="h-5 w-5 fill-current" /> Harmonious Living
           </div>
           <p className="text-3xl font-black max-w-2xl mx-auto leading-tight italic">
              “Sangeet wo hai jo rooh ko sukoon de, aur yaadon ko taza kare.”
           </p>
           <p className="mt-4 text-slate-400 font-bold uppercase tracking-widest text-sm">Yaara Music Player</p>
        </footer>
      </div>
    </div>
  );
};

export default MusicPage;
