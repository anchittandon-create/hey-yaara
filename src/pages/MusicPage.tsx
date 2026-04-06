import { useState } from "react";
import { ArrowLeft, Search, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";

const categories = [
  { title: "Old Bollywood", emoji: "🎬", songs: ["Lag Jaa Gale", "Dum Maro Dum", "Mere Sapno Ki Rani", "Tujhe Dekha To", "Kabhi Kabhie"] },
  { title: "Bhajans", emoji: "🙏", songs: ["Achyutam Keshavam", "Hanuman Chalisa", "Om Jai Jagdish", "Raghupati Raghav", "Shri Ram Dhun"] },
  { title: "Punjabi Classics", emoji: "💃", songs: ["Mundian To Bach Ke", "Paani Da Rang", "Jugni Ji", "Dil Da Mamla", "Laung Da Lashkara"] },
];

const MusicPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const filtered = categories.map((cat) => ({
    ...cat,
    songs: cat.songs.filter((s) => s.toLowerCase().includes(search.toLowerCase())),
  })).filter((cat) => cat.songs.length > 0);

  return (
    <div className="mx-auto min-h-screen w-full max-w-md pb-28 md:max-w-2xl lg:max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-4 md:px-8 lg:px-10">
        <button onClick={() => navigate("/")} className="p-3 rounded-full bg-card" aria-label="Back">
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </button>
        <h2 className="text-elderly-lg font-bold text-foreground">Music 🎵</h2>
      </div>

      {/* Search */}
      <div className="mb-6 px-4 md:px-8 lg:px-10">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search songs (Hindi, English, Punjabi)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-card text-elderly-base text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-6 px-4 md:px-8 lg:px-10">
        {filtered.map((cat) => (
          <div key={cat.title}>
            <h3 className="text-elderly-lg font-bold text-foreground mb-3">
              {cat.emoji} {cat.title}
            </h3>
            <div className="grid gap-2 md:grid-cols-2">
              {cat.songs.map((song) => (
                <button
                  key={song}
                  onClick={() => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(song + " full song")}`, "_blank")}
                  className="flex w-full items-center justify-between rounded-2xl bg-card px-5 py-4 transition-transform active:scale-[0.98]"
                >
                  <span className="text-elderly-base font-semibold text-foreground">{song}</span>
                  <Play className="w-7 h-7 text-primary flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MusicPage;
