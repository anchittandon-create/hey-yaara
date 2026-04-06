import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Home, Mic, Music, Gamepad2 } from "lucide-react";

const navItems = [
  { path: "/", label: "Home", icon: Home },
  { path: "/talk", label: "Yaara", icon: Mic },
  { path: "/music", label: "Music", icon: Music },
  { path: "/games", label: "Games", icon: Gamepad2 },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border px-2 pb-safe">
      <div className="mx-auto flex h-20 w-full max-w-md items-center justify-around md:max-w-2xl lg:max-w-4xl">
        {navItems.map(({ path, label, icon: Icon }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                "flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-colors min-w-[72px]",
                active
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground"
              )}
            >
              <Icon className="w-7 h-7" strokeWidth={active ? 2.5 : 2} />
              <span className="text-sm font-semibold">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
