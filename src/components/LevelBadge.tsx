import React from "react";
import { cn } from "@/lib/utils";
import { LEVEL_TIERS, getLevelTier, type LevelTier } from "@/lib/progression";

type LevelBadgeProps = {
  totalXp: number;
  className?: string;
  compact?: boolean;
  /**
   * Optional override coming from the backend.
   * Use this to display the authoritative level even when the badge is shown
   * next to period XP (weekly/season) or lifetime XP earned.
   */
  level?: number | null;
  levelName?: string | null;
};

function getTierByLevel(level: number): LevelTier | null {
  return LEVEL_TIERS.find((tier) => tier.level === level) ?? null;
}

export const LevelBadge = React.forwardRef<HTMLDivElement, LevelBadgeProps>(
  ({ totalXp, className, compact = false, level, levelName }, ref) => {
    const resolvedTier =
      typeof level === "number" && Number.isFinite(level)
        ? getTierByLevel(Math.max(1, Math.floor(level))) ?? getLevelTier(totalXp)
        : getLevelTier(totalXp);

    const resolvedLevel =
      typeof level === "number" && Number.isFinite(level)
        ? Math.max(1, Math.floor(level))
        : resolvedTier.level;

    const resolvedName = (levelName && levelName.trim().length > 0 ? levelName.trim() : resolvedTier.name) as string;

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
          "ring-1 ring-inset",
          resolvedTier.badgeClass,
          resolvedTier.ringClass,
          className,
        )}
      >
        <span className="text-[10px] font-mono">{`L${resolvedLevel}`}</span>
        {!compact && <span>{resolvedName}</span>}
      </div>
    );
  },
);

LevelBadge.displayName = "LevelBadge";
