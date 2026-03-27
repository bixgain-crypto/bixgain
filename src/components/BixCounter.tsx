import { useEffect } from "react";
import { useMotionValue, useSpring, useTransform, motion } from "framer-motion";
import { formatBixAmount } from "@/lib/currency";

interface BixCounterProps {
  value: number;
  className?: string;
}

export function BixCounter({ value, className }: BixCounterProps) {
  const motionValue = useMotionValue(value);
  const springValue = useSpring(motionValue, {
    stiffness: 60,
    damping: 20,
    restDelta: 0.0001
  });
  const displayValue = useTransform(springValue, (latest) => formatBixAmount(latest));

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  return <motion.span className={className}>{displayValue}</motion.span>;
}