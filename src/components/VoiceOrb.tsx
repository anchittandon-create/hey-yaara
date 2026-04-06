import { cn } from "@/lib/utils";

interface VoiceOrbProps {
  isListening?: boolean;
  isActive?: boolean;
  size?: "sm" | "lg";
  onClick?: () => void;
}

const VoiceOrb = ({ isListening = false, isActive = false, size = "lg", onClick }: VoiceOrbProps) => {
  const sizeClasses = size === "lg" ? "w-40 h-40" : "w-24 h-24";
  const innerSize = size === "lg" ? "w-32 h-32" : "w-20 h-20";

  return (
    <button
      onClick={onClick}
      className={cn("relative flex items-center justify-center rounded-full", sizeClasses)}
      aria-label={isListening ? "Listening..." : "Tap to talk"}
    >
      {/* Outer pulse rings */}
      {(isListening || isActive) && (
        <>
          <span className="absolute inset-0 rounded-full bg-primary/20 animate-orb-ring" />
          <span className="absolute inset-0 rounded-full bg-primary/15 animate-orb-ring" style={{ animationDelay: "0.5s" }} />
        </>
      )}

      {/* Main orb */}
      <span
        className={cn(
          "relative rounded-full flex items-center justify-center shadow-lg",
          "bg-gradient-to-br from-primary to-yaara-pulse",
          innerSize,
          isListening ? "animate-orb-listening" : "animate-orb-breathe"
        )}
      >
        {/* Mic icon */}
        <svg
          className={cn("text-primary-foreground", size === "lg" ? "w-12 h-12" : "w-8 h-8")}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a4 4 0 00-4 4v6a4 4 0 008 0V5a4 4 0 00-4-4z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v1a7 7 0 01-14 0v-1" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </span>
    </button>
  );
};

export default VoiceOrb;
