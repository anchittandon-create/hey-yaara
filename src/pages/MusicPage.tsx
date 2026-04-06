import { useState } from "react";
import { ArrowLeft, Search, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { openExternalUrlInNewTab } from "@/lib/external-links";
import { useDeviceType } from "@/hooks/use-device-type";

const categories = [
  { title: "Old Bollywood", emoji: "🎬", songs: ["Lag Jaa Gale", "Dum Maro Dum", "Mere Sapno Ki Rani", "Tujhe Dekha To", "Kabhi Kabhie"] },
  { title: "Bhajans", emoji: "🙏", songs: ["Achyutam Keshavam", "Hanuman Chalisa", "Om Jai Jagdish", "Raghupati Raghav", "Shri Ram Dhun"] },
  { title: "Punjabi Classics", emoji: "💃", songs: ["Mundian To Bach Ke", "Paani Da Rang", "Jugni Ji", "Dil Da Mamla", "Laung Da Lashkara"] },
];

const MusicPage = () => {
  const navigate = useNavigate();
  const deviceType = useDeviceType();
  const [search, setSearch] = useState("");
  const songsGridClass =
    deviceType === "desktop"
      ? "grid gap-3 lg:grid-cols-3 xl:grid-cols-4"
      : deviceType === "tablet"
        ? "grid gap-3 md:grid-cols-2"
        : "space-y-2";

  const filtered = categories.map((cat) => ({
    ...cat,
    songs: cat.songs.filter((s) => s.toLowerCase().includes(search.toLowerCase())),
  })).filter((cat) => cat.songs.length > 0);

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="mx-auto w-full max-w-screen-2xl px-4 md:px-8 lg:px-12">
        <div className="flex items-center gap-3 pt-6 pb-5 md:pt-8 md:pb-6">
          <button onClick={() => navigate("/")} className="rounded-full bg-card p-3" aria-label="Back">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <div>
            <h2 className="text-elderly-lg font-bold text-foreground md:text-[1.8rem]">Music</h2>
            <p className="text-base font-semibold text-muted-foreground">Apne pasand ke gaane chun lijiye</p>
          </div>
        </div>

        <div className="mb-6">
          <div className={deviceType === "desktop" ? "mx-auto max-w-4xl" : ""}>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search songs (Hindi, English, Punjabi)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-2xl border border-border bg-card py-4 pl-12 pr-4 text-elderly-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary md:py-5 lg:text-[1.35rem]"
              />
            </div>
          </div>
        </div>

        <div className="space-y-7 pb-8">
          {filtered.map((cat) => (
            <section key={cat.title} className="rounded-[30px] bg-card/55 p-4 md:p-6 lg:p-8">
              <h3 className="mb-4 text-elderly-lg font-bold text-foreground md:text-[1.65rem]">
                {cat.emoji} {cat.title}
              </h3>

              <div className={songsGridClass}>
                {cat.songs.map((song) => (
                  <button
                    key={song}
                    onClick={() =>
                      openExternalUrlInNewTab(
                        `https://www.youtube.com/results?search_query=${encodeURIComponent(song + " full song")}`,
                      )
                    }
                    className="flex w-full items-center justify-between rounded-2xl bg-background px-5 py-4 text-left transition-transform active:scale-[0.98] hover:scale-[1.01] md:min-h-[92px]"
                  >
                    <span className="pr-4 text-elderly-base font-semibold text-foreground lg:text-[1.3rem]">{song}</span>
                    <Play className="w-7 h-7 flex-shrink-0 text-primary" />
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
