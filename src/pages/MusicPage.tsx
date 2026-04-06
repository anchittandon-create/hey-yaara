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
    title: "Your Favorites",
    subtitle: "Jo aapko baar-baar pasand aata hai",
    songs: [
      { title: "Lag Jaa Gale", badge: "❤️", query: "Lag Jaa Gale full song", genre: "Classic" },
      { title: "Hanuman Chalisa", badge: "🙏", query: "Hanuman Chalisa full song", genre: "Bhajan" },
      { title: "Mundian To Bach Ke", badge: "💃", query: "Mundian To Bach Ke full song", genre: "Punjabi" },
      { title: "Kabhi Kabhie", badge: "🌙", query: "Kabhi Kabhie full song", genre: "Old Bollywood" },
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
    ],
  },
  {
    title: "Bhajans",
    subtitle: "Shant aur sukoon bhari dhun",
    songs: [
      { title: "Achyutam Keshavam", badge: "🪔", query: "Achyutam Keshavam full song", genre: "Bhajan" },
      { title: "Om Jai Jagdish", badge: "✨", query: "Om Jai Jagdish full song", genre: "Aarti" },
      { title: "Raghupati Raghav", badge: "📿", query: "Raghupati Raghav full song", genre: "Bhajan" },
      { title: "Shri Ram Dhun", badge: "🌼", query: "Shri Ram Dhun full song", genre: "Devotional" },
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
    ],
  },
  {
    title: "Ghazals",
    subtitle: "Dil ko halka karne wali awaaz",
    songs: [
      { title: "Hothon Se Chhu Lo Tum", badge: "🎙️", query: "Hothon Se Chhu Lo Tum full song", genre: "Ghazal" },
      { title: "Tum Itna Jo Muskura Rahe Ho", badge: "🌙", query: "Tum Itna Jo Muskura Rahe Ho full song", genre: "Ghazal" },
      { title: "Chitthi Na Koi Sandesh", badge: "✉️", query: "Chitthi Na Koi Sandesh full song", genre: "Ghazal" },
      { title: "Jhuki Jhuki Si Nazar", badge: "💫", query: "Jhuki Jhuki Si Nazar full song", genre: "Ghazal" },
    ],
  },
  {
    title: "Relaxing / Instrumental",
    subtitle: "Aaraam aur halka sa sukoon",
    songs: [
      { title: "Flute Meditation", badge: "🎶", query: "flute meditation music", genre: "Instrumental" },
      { title: "Santoor Relaxation", badge: "🪷", query: "santoor relaxing music", genre: "Instrumental" },
      { title: "Rain Sounds", badge: "🌧️", query: "rain sounds relaxing music", genre: "Relaxing" },
      { title: "Morning Meditation", badge: "☀️", query: "morning meditation instrumental", genre: "Meditation" },
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
    <div className="min-h-screen bg-background pb-32">
      <div className="mx-auto w-full max-w-screen-2xl px-4 pt-6 md:px-8 md:pt-8 lg:px-12">
        <div className="mb-6 rounded-[34px] bg-white/75 p-5 shadow-[0_18px_50px_rgba(180,120,60,0.12)] backdrop-blur md:p-7">
          <div className="mb-5 flex items-center gap-3">
            <button onClick={() => navigate("/")} className="rounded-full bg-card p-3" aria-label="Back">
              <ArrowLeft className="h-6 w-6 text-foreground" />
            </button>
            <div>
              <h2 className="text-elderly-xl font-extrabold text-foreground">Music</h2>
              <p className="text-base font-semibold text-muted-foreground">Gaane aur genres dono se dhoondhiye</p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Gaana ya genre dhoondhiye"
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
                    key={`${section.title}-${song.title}`}
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
                    <div className="space-y-3">
                      <div>
                        <p className="text-elderly-base font-extrabold text-foreground">{song.title}</p>
                        <p className="mt-1 text-base font-semibold text-muted-foreground">Tap to play</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-primary/10 px-3 py-2 text-sm font-bold text-primary">
                          {song.genre}
                        </span>
                        <span className="rounded-full bg-primary p-3 text-primary-foreground">
                          <Play className="h-5 w-5 fill-current" />
                        </span>
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
