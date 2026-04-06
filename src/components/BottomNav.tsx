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
      <div className="mx-auto flex h-32 w-full max-w-screen-2xl items-center justify-around gap-3 rounded-[40px] border-2 border-orange-200 bg-gradient-to-r from-orange-50/95 to-amber-50/95 px-4 shadow-2xl backdrop-blur-xl md:h-36 md:px-6 lg:px-10">
        {navItems.map(({ path, label, icon: Icon, emoji }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex min-w-[80px] flex-1 flex-col items-center gap-3 rounded-3xl px-4 py-4 transition-all duration-300 md:max-w-[200px] ${
                active
                  ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg scale-105"
                  : "text-gray-700 hover:bg-white/60 hover:scale-102"
              }`}
            >
              <span className="text-2xl md:text-3xl">{emoji}</span>
              <Icon className={`h-6 w-6 md:h-7 md:w-7 ${active ? "text-white" : "text-orange-600"}`} />
              <span className={`text-sm font-bold md:text-base ${active ? "text-white" : "text-gray-700"}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
