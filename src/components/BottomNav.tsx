import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Home, Mic, Music, Gamepad2, FileText } from "lucide-react";

const navItems = [
  { path: "/", label: "Home", icon: Home, emoji: "🏠" },
  { path: "/talk", label: "Yaara", icon: Mic, emoji: "💬" },
  { path: "/music", label: "Music", icon: Music, emoji: "🎵" },
  { path: "/games", label: "Games", icon: Gamepad2, emoji: "🎮" },
  { path: "/calls", label: "Calls", icon: FileText, emoji: "📞" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <>
      <nav className="fixed bottom-4 left-0 right-0 z-50 px-4 pb-safe md:hidden">
        <div className="mx-auto flex h-24 w-full max-w-screen-2xl items-center justify-between gap-3 rounded-full border border-orange-200 bg-white/90 px-4 shadow-[0_32px_70px_rgba(251,146,60,0.18)] backdrop-blur-xl md:h-28 md:px-6 lg:px-10">
          {navItems.map(({ path, label, icon: Icon, emoji }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  "flex min-w-[56px] flex-1 flex-col items-center justify-center gap-2 rounded-3xl px-3 py-2 transition-all duration-300",
                  active
                    ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                )}
              >
                <span className="text-2xl">{emoji}</span>
                <Icon className={cn("h-5 w-5", active ? "text-white" : "text-orange-600")} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] md:text-xs">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <aside className="fixed inset-y-0 left-0 z-50 hidden w-48 flex-col justify-between border-r border-orange-200 bg-white/95 px-4 py-6 shadow-[0_40px_90px_rgba(251,146,60,0.14)] backdrop-blur-xl md:flex">
        <div className="space-y-4">
          <div className="flex h-20 w-full items-center justify-center rounded-3xl bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg">
            <span className="text-lg font-semibold tracking-tight">Yaara</span>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-medium text-slate-700 shadow-sm">
            Aapka warm helper, ab hamesha saath.
          </div>
        </div>

        <div className="flex w-full flex-1 flex-col gap-3 pt-2">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[26px] px-4 py-4 text-left transition-all duration-300",
                  active
                    ? "bg-gradient-to-r from-orange-400 to-orange-600 text-white shadow-xl"
                    : "border border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50 hover:text-slate-900"
                )}
              >
                <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", active ? "bg-white/20 text-white" : "bg-orange-50 text-orange-600")}>
                  <Icon className={cn("h-5 w-5", active ? "text-white" : "text-orange-600")} />
                </span>
                <div>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-[11px] text-slate-500">{label === "Home" ? "Dashboard" : label === "Yaara" ? "Call" : label === "Music" ? "Listen" : label === "Games" ? "Play" : "History"}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-700 shadow-sm">
          <p className="font-semibold">Need a quick start?</p>
          <p className="mt-1 text-[13px] text-slate-500">Choose Yaara to begin a warm conversation.</p>
        </div>
      </aside>
    </>
  );
};

export default BottomNav;
