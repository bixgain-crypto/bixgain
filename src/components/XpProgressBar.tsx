import { cn } from "@/lib/utils";

type XpProgressBarProps = {
  value: number;
  className?: string;
  trackClassName?: string;
  barClassName?: string;
};

export function XpProgressBar({ value, className, trackClassName, barClassName }: XpProgressBarProps) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className={cn("relative w-full", className)}>
      <div className={cn("h-3 w-full rounded-full bg-secondary/80", trackClassName)}>
        <div
          className={cn("h-full rounded-full bg-gradient-gold transition-all duration-500 ease-out", barClassName)}
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}
