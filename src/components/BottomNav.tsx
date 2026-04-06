import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Home, Mic, Music, Gamepad2, FileText } from "lucide-react";

const navItems = [
  { path: "/", label: "Home", icon: Home },
  { path: "/talk", label: "Yaara", icon: Mic },
  { path: "/dashboard", label: "Calls", icon: FileText },
  { path: "/music", label: "Music", icon: Music },
  { path: "/games", label: "Games", icon: Gamepad2 },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-3 left-0 right-0 z-50 px-3 pb-safe md:bottom-4 md:px-6">
      <div className="mx-auto flex h-24 w-full max-w-screen-2xl items-center justify-around gap-2 rounded-[30px] border border-white/70 bg-card/95 px-2 shadow-[0_20px_50px_rgba(180,120,60,0.18)] backdrop-blur md:h-28 md:px-4 lg:px-8">
        {navItems.map(({ path, label, icon: Icon }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                "flex min-w-[72px] flex-1 flex-col items-center gap-2 rounded-2xl px-4 py-3 transition-all md:max-w-[180px]",
                active
                  ? "bg-primary/12 text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-background/80"
              )}
            >
              <Icon className="h-7 w-7 md:h-8 md:w-8" strokeWidth={active ? 2.5 : 2} />
              <span className="text-base font-bold md:text-[1.05rem]">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
