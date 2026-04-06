import { useMemo, useState } from "react";
import { ArrowLeft, Heart, Search, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { openExternalUrlInNewTab } from "@/lib/external-links";

const musicSections = [
  {
    title: "Your Favorites",
    subtitle: "Jo aapko baar-baar pasand aata hai",
    songs: [
      { title: "Lag Jaa Gale", badge: "❤️", query: "Lag Jaa Gale full song" },
      { title: "Hanuman Chalisa", badge: "🙏", query: "Hanuman Chalisa full song" },
      { title: "Mundian To Bach Ke", badge: "💃", query: "Mundian To Bach Ke full song" },
    ],
  },
  {
    title: "Old Bollywood",
    subtitle: "Purane yaadgaar gaane",
    songs: [
      { title: "Mere Sapno Ki Rani", badge: "🎬", query: "Mere Sapno Ki Rani full song" },
      { title: "Dum Maro Dum", badge: "🎵", query: "Dum Maro Dum full song" },
      { title: "Kabhi Kabhie", badge: "🌙", query: "Kabhi Kabhie full song" },
      { title: "Tujhe Dekha To", badge: "🌹", query: "Tujhe Dekha To full song" },
    ],
  },
  {
    title: "Bhajans",
    subtitle: "Shant aur sukoon bhari dhun",
    songs: [
      { title: "Achyutam Keshavam", badge: "🪔", query: "Achyutam Keshavam full song" },
      { title: "Om Jai Jagdish", badge: "🙏", query: "Om Jai Jagdish full song" },
      { title: "Raghupati Raghav", badge: "✨", query: "Raghupati Raghav full song" },
      { title: "Shri Ram Dhun", badge: "📿", query: "Shri Ram Dhun full song" },
    ],
  },
  {
    title: "Punjabi Songs",
    subtitle: "Thoda mood halka karte hain",
    songs: [
      { title: "Jugni Ji", badge: "🪩", query: "Jugni Ji full song" },
      { title: "Paani Da Rang", badge: "💧", query: "Paani Da Rang full song" },
      { title: "Dil Da Mamla", badge: "💛", query: "Dil Da Mamla full song" },
      { title: "Laung Da Lashkara", badge: "🌼", query: "Laung Da Lashkara full song" },
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
        songs: section.songs.filter((song) => song.title.toLowerCase().includes(normalizedSearch)),
      }))
      .filter((section) => section.songs.length > 0);
  }, [search]);

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="mx-auto w-full max-w-screen-2xl px-4 pt-6 md:px-8 md:pt-8 lg:px-12">
        <div className="mb-6 rounded-[34px] bg-white/75 p-5 shadow-[0_18px_50px_rgba(180,120,60,0.12)] backdrop-blur md:p-7">
          <div className="mb-5 flex items-center gap-3">
            <button onClick={() => navigate("/")} className="rounded-full bg-card p-3" aria-label="Back">
              <ArrowLeft className="h-6 w-6 text-foreground" />
            </button>
            <div>
              <h2 className="text-elderly-xl font-extrabold text-foreground">Music</h2>
              <p className="text-base font-semibold text-muted-foreground">Jo sunna ho, woh turant chuniye</p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Gaana dhoondhiye"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-[28px] border border-border bg-card py-4 pl-12 pr-4 text-elderly-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary md:py-5"
            />
          </div>
        </div>

        <div className="space-y-6 pb-8">
          {filteredSections.map((section) => (
            <section key={section.title} className="rounded-[34px] bg-card/85 p-4 shadow-sm md:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-elderly-lg font-extrabold text-foreground">{section.title}</h3>
                  <p className="text-base font-semibold text-muted-foreground">{section.subtitle}</p>
                </div>
                {section.title === "Your Favorites" && (
                  <span className="rounded-full bg-primary/10 px-3 py-2 text-primary">
                    <Heart className="h-5 w-5 fill-current" />
                  </span>
                )}
              </div>

              <div className="flex snap-x gap-4 overflow-x-auto pb-1">
                {section.songs.map((song) => (
                  <button
                    key={song.title}
                    onClick={() =>
                      openExternalUrlInNewTab(
                        `https://www.youtube.com/results?search_query=${encodeURIComponent(song.query)}`,
                      )
                    }
                    className="min-w-[250px] snap-start rounded-[28px] bg-background p-4 text-left shadow-sm transition-transform active:scale-[0.98] hover:scale-[1.01] md:min-w-[280px] lg:min-w-[300px]"
                  >
                    <div className="mb-4 flex h-28 items-center justify-center rounded-[24px] bg-gradient-to-br from-primary/20 via-accent/20 to-secondary/20 text-5xl">
                      {song.badge}
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-elderly-base font-extrabold text-foreground">{song.title}</p>
                        <p className="mt-1 text-base font-semibold text-muted-foreground">Tap to play</p>
                      </div>
                      <span className="rounded-full bg-primary p-3 text-primary-foreground">
                        <Play className="h-5 w-5 fill-current" />
                      </span>
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
