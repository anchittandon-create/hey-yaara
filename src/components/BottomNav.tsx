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
      <div className="mx-auto flex h-20 w-full max-w-screen-2xl items-center justify-around gap-2 px-2 md:h-24 md:px-6 lg:px-12">
        {navItems.map(({ path, label, icon: Icon }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                "flex min-w-[72px] flex-1 flex-col items-center gap-1 rounded-2xl px-4 py-2 transition-colors md:max-w-[180px]",
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
