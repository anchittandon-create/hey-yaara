import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Home, Mic, Music, Gamepad2, FileText } from "lucide-react";

const navItems = [
  { path: "/", label: "Home", icon: Home, emoji: "🏠" },
  { path: "/talk", label: "Yaara", icon: Mic, emoji: "💬" },
  { path: "/music", label: "Music", icon: Music, emoji: "🎵" },
  { path: "/games", label: "Games", icon: Gamepad2, emoji: "🎮" },
  { path: "/dashboard", label: "Calls", icon: FileText, emoji: "📞" },
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

      <aside className="fixed inset-y-0 left-0 z-50 hidden w-28 flex-col items-center justify-between border-r border-orange-200 bg-white/95 px-2 py-5 shadow-[0_40px_90px_rgba(251,146,60,0.14)] backdrop-blur-xl md:flex">
        <div className="flex h-20 w-full items-center justify-center rounded-3xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg">
          <span className="text-lg font-bold">Yaara</span>
        </div>

        <div className="flex w-full flex-1 flex-col items-center justify-center gap-3">
          {navItems.map(({ path, label, icon: Icon, emoji }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  "group inline-flex w-full flex-col items-center justify-center gap-2 rounded-3xl px-3 py-4 text-center transition-all duration-300",
                  active
                    ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg"
                    : "text-slate-600 hover:bg-slate-100/90 hover:text-slate-900"
                )}
                title={label}
              >
                <span className="text-xl md:text-2xl">{emoji}</span>
                <Icon className={cn("h-6 w-6", active ? "text-white" : "text-orange-600")} />
                <span className="hidden text-[11px] font-semibold uppercase tracking-[0.12em] md:block">
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex h-16 w-full items-center justify-center rounded-3xl bg-slate-100 text-slate-700 text-center text-xs font-semibold leading-tight shadow-sm">
          Menu
        </div>
      </aside>
    </>
  );
};

export default BottomNav;
