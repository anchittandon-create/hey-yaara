import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Home, Mic, Music, Gamepad2, FileText, User, Heart } from "lucide-react";

const navItems = [
  { path: "/", label: "Home", icon: Home, emoji: "🏠" },
  { path: "/talk", label: "Talk with Yaara", icon: Mic, emoji: "💬" },
  { path: "/music", label: "Music Hub", icon: Music, emoji: "🎵" },
  { path: "/games", label: "Games Center", icon: Gamepad2, emoji: "🎮" },
  { path: "/calls", label: "Call History", icon: FileText, emoji: "📞" },
  { path: "/profile", label: "My Profile", icon: User, emoji: "👤" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <>
      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 px-2 pb-2 md:hidden">
        <div className="mx-auto flex h-20 w-full max-w-lg items-center justify-around rounded-3xl border border-white/20 bg-[#162038]/90 px-2 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            const shortLabel = label.split(" ")[0]; // Just use "Talk", "Music", etc. for mobile
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-2 transition-all duration-300",
                  active ? "text-orange-400" : "text-white/40 hover:text-white/70"
                )}
              >
                <Icon className={cn("h-6 w-6 transition-transform", active && "scale-110")} />
                <span className="text-[10px] font-medium tracking-tight">
                  {shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-[#ffffff0a] bg-[#0c1222] shadow-[4px_0_24px_rgba(0,0,0,0.3)] md:flex">
        {/* LOGO AREA */}
        <div className="p-8 pb-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg shadow-orange-500/20">
              <Heart className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Hey Yaara</h1>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/30">Companion</p>
            </div>
          </div>
        </div>

        {/* NAVIGATION */}
        <div className="flex-1 space-y-1.5 px-4 overflow-y-auto custom-scrollbar">
          <div className="mb-4 px-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/20">Menu</p>
          </div>
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  "group relative flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-left transition-all duration-300",
                  active
                    ? "bg-white/5 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                    : "text-white/40 hover:bg-white/[0.03] hover:text-white/70"
                )}
              >
                {/* Active Indicator Line */}
                {active && <div className="absolute left-0 top-1/4 h-1/2 w-1 rounded-full bg-orange-500" />}

                <Icon className={cn(
                  "h-5 w-5 transition-colors",
                  active ? "text-orange-500" : "text-white/20 group-hover:text-white/40"
                )} />
                <span className="text-sm font-semibold tracking-wide">{label}</span>
              </button>
            );
          })}
        </div>

        {/* FOOTER AREA - SIMPLE PROFILE PREVIEW */}
        <div className="mt-auto p-4">
          <div className="rounded-[32px] bg-white/[0.03] p-4 border border-white/[0.05]">
             <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                   <User className="h-5 w-5 text-orange-500" />
                </div>
                <div className="overflow-hidden">
                   <p className="text-sm font-bold text-white truncate">Grandpa Dave</p>
                   <p className="text-[11px] text-white/30 font-medium">Verified Account</p>
                </div>
             </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default BottomNav;
