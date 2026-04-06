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
    <nav className="fixed bottom-4 left-0 right-0 z-50 px-4 pb-safe md:bottom-6 md:px-8">
      <div className="mx-auto flex h-24 w-full max-w-screen-2xl items-center justify-between gap-3 rounded-full border border-orange-200 bg-white/90 px-4 shadow-[0_32px_70px_rgba(251,146,60,0.18)] backdrop-blur-xl md:h-28 md:px-6 lg:px-10">
        {navItems.map(({ path, label, icon: Icon, emoji }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                "flex min-w-[72px] flex-1 flex-col items-center justify-center gap-2 rounded-3xl px-3 py-3 transition-all duration-300",
                active
                  ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg"
                  : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
              )}
            >
              <span className="text-2xl md:text-3xl">{emoji}</span>
              <Icon className={cn("h-5 w-5 md:h-6 md:w-6", active ? "text-white" : "text-orange-600")} />
              <span className="text-xs font-semibold uppercase tracking-[0.16em] md:text-sm">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
