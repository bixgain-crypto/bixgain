import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCw, Sparkles, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";

const SPIN_REWARDS = [5, 10, 15, 20, 25, 50, 75, 100];
const SEGMENTS = SPIN_REWARDS.length;
const SEGMENT_ANGLE = 360 / SEGMENTS;
const MAX_SPINS = 3;
const COOLDOWN_HOURS = 3;

export default function SpinToEarn() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastWin, setLastWin] = useState<number | null>(null);

  const { data: recentSpins } = useQuery({
    queryKey: ["spin-records", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const cutoff = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("spin_records")
        .select("*")
        .eq("user_id", session!.user.id)
        .gte("spun_at", cutoff)
        .order("spun_at", { ascending: false });
      return data || [];
    },
    refetchInterval: 30000,
  });

  const spinsUsed = recentSpins?.length || 0;
  const spinsLeft = Math.max(0, MAX_SPINS - spinsUsed);

  const oldestSpin = recentSpins && recentSpins.length >= MAX_SPINS
    ? new Date(recentSpins[recentSpins.length - 1].spun_at)
    : null;
  const nextSpinAt = oldestSpin
    ? new Date(oldestSpin.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000)
    : null;

  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    if (!nextSpinAt || spinsLeft > 0) { setCountdown(""); return; }
    const tick = () => {
      const diff = nextSpinAt.getTime() - Date.now();
      if (diff <= 0) {
        setCountdown("");
        queryClient.invalidateQueries({ queryKey: ["spin-records"] });
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h}h ${m}m ${s}s`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [nextSpinAt, spinsLeft, queryClient]);

  const handleSpin = useCallback(async () => {
    if (!session?.user?.id || spinning || spinsLeft <= 0) return;
    setSpinning(true);
    setLastWin(null);

    const winIndex = Math.floor(Math.random() * SEGMENTS);
    const reward = SPIN_REWARDS[winIndex];

    const targetAngle = 360 - (winIndex * SEGMENT_ANGLE + SEGMENT_ANGLE / 2);
    const fullSpins = 5 * 360;
    const newRotation = rotation + fullSpins + targetAngle + (Math.random() * 10 - 5);
    setRotation(newRotation);

    setTimeout(async () => {
      await supabase.from("spin_records").insert({
        user_id: session.user.id,
        reward_amount: reward,
      });

      setLastWin(reward);
      setSpinning(false);
      toast.success(`🎉 You won ${reward} BIX!`);
      queryClient.invalidateQueries({ queryKey: ["spin-records"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    }, 4000);
  }, [session, spinning, spinsLeft, rotation, queryClient]);

  const segmentColors = [
    "hsl(42, 100%, 50%)", "hsl(152, 69%, 45%)", "hsl(220, 70%, 55%)", "hsl(0, 72%, 51%)",
    "hsl(38, 92%, 55%)", "hsl(280, 65%, 55%)", "hsl(42, 80%, 45%)", "hsl(152, 50%, 35%)",
  ];

  return (
    <AppLayout>
      <div className="space-y-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-primary" />
            Spin & Earn
          </h1>
          <p className="mt-1 text-muted-foreground">
            Spin the wheel to win BIX tokens! {MAX_SPINS} spins every {COOLDOWN_HOURS} hours.
          </p>
        </motion.div>

        <div className="flex flex-col items-center gap-8">
          {/* Spins remaining */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-6"
          >
            <div className="glass rounded-lg px-6 py-3 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Spins Left</p>
              <p className="text-2xl font-bold text-primary font-mono">{spinsLeft}/{MAX_SPINS}</p>
            </div>
            {countdown && (
              <div className="glass rounded-lg px-6 py-3 text-center flex items-center gap-2">
                <Clock className="h-4 w-4 text-warning" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Next Spin</p>
                  <p className="text-lg font-mono text-warning">{countdown}</p>
                </div>
              </div>
            )}
          </motion.div>

          {/* Wheel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="relative"
          >
            {/* Pointer */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
              <div className="w-0 h-0 border-l-[14px] border-r-[14px] border-t-[24px] border-l-transparent border-r-transparent border-t-primary drop-shadow-lg" />
            </div>

            <div className="relative w-72 h-72 sm:w-80 sm:h-80">
              <svg
                viewBox="0 0 300 300"
                className="w-full h-full drop-shadow-2xl"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning ? "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
                }}
              >
                {SPIN_REWARDS.map((reward, i) => {
                  const startAngle = i * SEGMENT_ANGLE;
                  const endAngle = (i + 1) * SEGMENT_ANGLE;
                  const startRad = (startAngle - 90) * (Math.PI / 180);
                  const endRad = (endAngle - 90) * (Math.PI / 180);
                  const x1 = 150 + 140 * Math.cos(startRad);
                  const y1 = 150 + 140 * Math.sin(startRad);
                  const x2 = 150 + 140 * Math.cos(endRad);
                  const y2 = 150 + 140 * Math.sin(endRad);
                  const largeArc = SEGMENT_ANGLE > 180 ? 1 : 0;

                  const midAngle = (startAngle + endAngle) / 2 - 90;
                  const midRad = midAngle * (Math.PI / 180);
                  const textX = 150 + 95 * Math.cos(midRad);
                  const textY = 150 + 95 * Math.sin(midRad);

                  return (
                    <g key={i}>
                      <path
                        d={`M 150 150 L ${x1} ${y1} A 140 140 0 ${largeArc} 1 ${x2} ${y2} Z`}
                        fill={segmentColors[i]}
                        stroke="hsl(220, 20%, 4%)"
                        strokeWidth="2"
                      />
                      <text
                        x={textX}
                        y={textY}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="white"
                        fontWeight="bold"
                        fontSize="14"
                        transform={`rotate(${startAngle + SEGMENT_ANGLE / 2}, ${textX}, ${textY})`}
                      >
                        {reward}
                      </text>
                    </g>
                  );
                })}
                <circle cx="150" cy="150" r="25" fill="hsl(220, 20%, 4%)" stroke="hsl(42, 100%, 50%)" strokeWidth="3" />
                <text x="150" y="150" textAnchor="middle" dominantBaseline="middle" fill="hsl(42, 100%, 50%)" fontSize="11" fontWeight="bold">BIX</text>
              </svg>
            </div>
          </motion.div>

          {/* Win display */}
          <AnimatePresence>
            {lastWin !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="glass rounded-xl p-6 text-center glow-gold"
              >
                <Sparkles className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">You won</p>
                <p className="text-4xl font-bold text-gradient-gold font-mono">{lastWin} BIX</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Spin button */}
          <Button
            onClick={handleSpin}
            disabled={spinning || spinsLeft <= 0}
            size="lg"
            className="bg-gradient-gold font-semibold text-lg px-12 glow-gold disabled:opacity-50"
          >
            {spinning ? (
              <><RotateCw className="h-5 w-5 animate-spin mr-2" /> Spinning...</>
            ) : spinsLeft <= 0 ? (
              "No Spins Left"
            ) : (
              <><RotateCw className="h-5 w-5 mr-2" /> SPIN!</>
            )}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
