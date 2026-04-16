import { cn } from "@/lib/utils";

interface VoiceOrbProps {
  isListening?: boolean;
  isActive?: boolean;
  /** “Thinking” / LLM+TTS pipeline — keeps motion visible (avoids a dead-looking orb). */
  isProcessing?: boolean;
  size?: "sm" | "lg" | "xl";
  onClick?: () => void;
}

const VoiceOrb = ({
  isListening = false,
  isActive = false,
  isProcessing = false,
  size = "lg",
  onClick,
}: VoiceOrbProps) => {
  const sizeClasses =
    size === "xl"
      ? "h-56 w-56 sm:h-[15rem] sm:w-[15rem] md:h-64 md:w-64 lg:h-72 lg:w-72 xl:h-80 xl:w-80"
      : size === "lg"
        ? "h-40 w-40 sm:h-44 sm:w-44 md:h-48 md:w-48 lg:h-52 lg:w-52"
        : "h-24 w-24 sm:h-28 sm:w-28";
  const innerSize =
    size === "xl"
      ? "h-44 w-44 sm:h-[12.25rem] sm:w-[12.25rem] md:h-52 md:w-52 lg:h-[17rem] lg:w-[17rem] xl:h-[18rem] xl:w-[18rem]"
      : size === "lg"
        ? "h-32 w-32 sm:h-36 sm:w-36 md:h-40 md:w-40 lg:h-44 lg:w-44"
        : "h-20 w-20 sm:h-[5.5rem] sm:w-[5.5rem]";
  const iconSize =
    size === "xl"
      ? "h-14 w-14 sm:h-16 sm:w-16 md:h-[4.25rem] md:w-[4.25rem] lg:h-[4.5rem] lg:w-[4.5rem] xl:h-20 xl:w-20"
      : size === "lg"
        ? "h-12 w-12 md:h-14 md:w-14"
        : "h-8 w-8 sm:h-9 sm:w-9";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("relative flex items-center justify-center rounded-full", sizeClasses)}
      aria-label={
        isProcessing ? "Thinking…" : isListening ? "Listening…" : isActive ? "Speaking…" : "Voice assistant"
      }
    >
      {/* Outer pulse rings — include processing so the screen never looks “blank” mid-call */}
      {(isListening || isActive || isProcessing) && (
        <>
          <span
            className={cn(
              "absolute inset-0 rounded-full animate-orb-ring",
              isProcessing ? "bg-purple-400/25" : "bg-primary/20",
            )}
          />
          <span
            className={cn(
              "absolute inset-0 rounded-full animate-orb-ring",
              isProcessing ? "bg-indigo-400/20" : "bg-primary/15",
            )}
            style={{ animationDelay: "0.5s" }}
          />
        </>
      )}

      {/* Main orb */}
      <span
        className={cn(
          "relative rounded-full flex items-center justify-center shadow-lg",
          "bg-gradient-to-br from-primary to-yaara-pulse",
          innerSize,
          isProcessing ? "animate-orb-processing" : isListening ? "animate-orb-listening" : "animate-orb-breathe",
        )}
      >
        {/* Mic icon */}
        <svg
          className={cn("text-primary-foreground", iconSize)}
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
