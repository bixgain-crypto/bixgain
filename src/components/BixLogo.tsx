import { motion } from "framer-motion";
import { Coins } from "lucide-react";

export function BixLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeMap = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };
  const textMap = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-3xl",
  };

  return (
    <div className="flex items-center gap-2">
      <motion.div
        animate={{ rotate: [0, 10, -10, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className={`${sizeMap[size]} rounded-full bg-gradient-gold flex items-center justify-center`}
      >
        <Coins className="h-1/2 w-1/2 text-primary-foreground" />
      </motion.div>
      <span className={`${textMap[size]} font-bold text-gradient-gold`}>
        BIXGAIN
      </span>
    </div>
  );
}
