import React from "react";
import { cn } from "@/lib/utils";

type XpProgressBarProps = {
  value: number;
  className?: string;
  trackClassName?: string;
  barClassName?: string;
};

export const XpProgressBar = React.forwardRef<HTMLDivElement, XpProgressBarProps>(
  ({ value, className, trackClassName, barClassName }, ref) => {
    const safeValue = Math.max(0, Math.min(100, value));

    return (
      <div ref={ref} className={cn("relative w-full", className)}>
        <div className={cn("h-3 w-full rounded-full bg-secondary/80", trackClassName)}>
          <div
            className={cn("h-full rounded-full bg-gradient-gold transition-all duration-500 ease-out", barClassName)}
            style={{ width: `${safeValue}%` }}
          />
        </div>
      </div>
    );
  },
);

XpProgressBar.displayName = "XpProgressBar";
