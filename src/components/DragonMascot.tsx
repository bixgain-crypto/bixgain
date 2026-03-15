import { cn } from "@/lib/utils";

type DragonMascotProps = {
  mood?: "idle" | "fire" | "rage";
  size?: "sm" | "md" | "lg";
  className?: string;
  title?: string;
};

const sizeMap = {
  sm: "h-12 w-12 text-xl",
  md: "h-16 w-16 text-2xl",
  lg: "h-24 w-24 text-4xl",
};

export default function DragonMascot({ mood = "idle", size = "md", className, title = "BIX Dragon" }: DragonMascotProps) {
  const moodClasses = mood === "rage"
    ? "from-amber-300/40 via-orange-500/30 to-red-500/30 shadow-[0_0_26px_-6px_rgba(251,146,60,0.9)]"
    : mood === "fire"
    ? "from-emerald-300/35 via-cyan-400/20 to-slate-900 shadow-[0_0_20px_-8px_rgba(34,211,238,0.75)]"
    : "from-emerald-300/25 via-cyan-500/10 to-slate-900";

  return (
    <div
      title={title}
      className={cn(
        "relative inline-flex items-center justify-center rounded-full border border-cyan-100/30 bg-gradient-to-br",
        moodClasses,
        sizeMap[size],
        className,
      )}
      aria-label={title}
    >
      <span aria-hidden>🐉</span>
      {mood !== "idle" ? (
        <span className={cn("absolute -bottom-1 text-[10px]", mood === "rage" ? "text-orange-200" : "text-cyan-100")}>
          {mood === "rage" ? "RAGE" : "FIRE"}
        </span>
      ) : null}
    </div>
  );
}
