import { cn } from "@/lib/utils";
import { getLevelTier } from "@/lib/progression";

type LevelBadgeProps = {
  totalXp: number;
  className?: string;
  compact?: boolean;
};

export function LevelBadge({ totalXp, className, compact = false }: LevelBadgeProps) {
  const tier = getLevelTier(totalXp);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
        "ring-1 ring-inset",
        tier.badgeClass,
        tier.ringClass,
        className,
      )}
    >
      <span className="text-[10px] font-mono">{`L${tier.level}`}</span>
      {!compact && <span>{tier.name}</span>}
    </div>
  );
}
