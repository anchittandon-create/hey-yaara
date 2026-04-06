import { useNavigate } from "react-router-dom";
import VoiceOrb from "@/components/VoiceOrb";
import { Mic, Music, Gamepad2 } from "lucide-react";

const actionButtons = [
  { label: "Talk to Yaara", icon: Mic, path: "/talk", color: "bg-primary text-primary-foreground" },
  { label: "Music", icon: Music, path: "/music", color: "bg-yaara-green text-secondary-foreground" },
  { label: "Games", icon: Gamepad2, path: "/games", color: "bg-yaara-gold text-accent-foreground" },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center px-6 pt-12 pb-28">
      {/* Title */}
      <h1 className="text-elderly-2xl font-extrabold text-primary mb-2">Hey Yaara</h1>

      {/* Greeting */}
      <p className="text-elderly-base text-center text-muted-foreground mb-10 max-w-xs leading-relaxed">
        Namaste! Main Yaara hoon.
        <br />
        Aap mujhse baat kar sakte hain. 🙏
      </p>

      {/* Voice Orb */}
      <div className="mb-12">
        <VoiceOrb onClick={() => navigate("/talk")} />
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-xs flex flex-col gap-4">
        {actionButtons.map(({ label, icon: Icon, path, color }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`flex items-center gap-4 w-full px-6 py-5 rounded-2xl text-elderly-lg font-bold shadow-md transition-transform active:scale-95 ${color}`}
          >
            <Icon className="w-8 h-8 flex-shrink-0" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Index;
