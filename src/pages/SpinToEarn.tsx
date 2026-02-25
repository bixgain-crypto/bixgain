import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatXp } from "@/lib/progression";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Orbit, RotateCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type WheelReward = {
  label: string;
  xp: number;
  detail: string;
};

const WHEEL_REWARDS: WheelReward[] = [
  { label: "+25 XP", xp: 25, detail: "Quick progression boost" },
  { label: "+50 XP", xp: 50, detail: "Daily acceleration" },
  { label: "+75 XP", xp: 75, detail: "Strong mission momentum" },
  { label: "XP Boost", xp: 120, detail: "Temporary XP power-up payout" },
  { label: "Mission Reset", xp: 90, detail: "Mission queue refresh bonus" },
  { label: "Streak Bonus", xp: 110, detail: "Streak preservation reward" },
];

const SEGMENTS = WHEEL_REWARDS.length;
const SEGMENT_ANGLE = 360 / SEGMENTS;
const MAX_SPINS = 1;
const COOLDOWN_HOURS = 24;

export default function SpinToEarn() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastWin, setLastWin] = useState<WheelReward | null>(null);
  const [countdown, setCountdown] = useState("");

  const { data: recentSpins } = useQuery({
    queryKey: ["daily-boost-records", session?.user?.id],
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
  const nextSpinAt = useMemo(() => {
    const latestSpin = recentSpins?.[0] ? new Date(recentSpins[0].spun_at) : null;
    return latestSpin
      ? new Date(latestSpin.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000)
      : null;
  }, [recentSpins]);

  useEffect(() => {
    if (!nextSpinAt || spinsLeft > 0) {
      setCountdown("");
      return;
    }

    const tick = () => {
      const diff = nextSpinAt.getTime() - Date.now();
      if (diff <= 0) {
        setCountdown("");
        queryClient.invalidateQueries({ queryKey: ["daily-boost-records"] });
        return;
      }
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setCountdown(`${hours}h ${minutes}m ${seconds}s`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [nextSpinAt, queryClient, spinsLeft]);

  const handleSpin = useCallback(async () => {
    if (!session?.user?.id || spinning || spinsLeft <= 0) return;
    setSpinning(true);
    setLastWin(null);

    const index = Math.floor(Math.random() * SEGMENTS);
    const reward = WHEEL_REWARDS[index];

    const targetAngle = 360 - (index * SEGMENT_ANGLE + SEGMENT_ANGLE / 2);
    const fullTurns = 6 * 360;
    const newRotation = rotation + fullTurns + targetAngle + (Math.random() * 8 - 4);
    setRotation(newRotation);

    setTimeout(async () => {
      const { error } = await supabase.from("spin_records").insert({
        user_id: session.user.id,
        reward_amount: reward.xp,
      });

      if (error) {
        toast.error(error.message);
      } else {
        setLastWin(reward);
        toast.success(`Daily Boost secured: +${reward.xp} XP`);
        queryClient.invalidateQueries({ queryKey: ["daily-boost-records"] });
        queryClient.invalidateQueries({ queryKey: ["progression-summary"] });
        queryClient.invalidateQueries({ queryKey: ["wallet"] });
      }

      setSpinning(false);
    }, 4200);
  }, [queryClient, rotation, session, spinning, spinsLeft]);

  const segmentColors = [
    "hsl(205, 80%, 55%)",
    "hsl(192, 76%, 42%)",
    "hsl(170, 70%, 42%)",
    "hsl(42, 100%, 50%)",
    "hsl(28, 95%, 55%)",
    "hsl(264, 65%, 56%)",
  ];

  return (
    <AppLayout>
      <div className="space-y-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Orbit className="h-8 w-8 text-primary" />
            Daily Boost
          </h1>
          <p className="mt-1 text-muted-foreground">Boost your progression</p>
        </motion.div>

        <div className="flex flex-col items-center gap-7">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="glass rounded-xl px-5 py-3 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Daily Boost Attempts</p>
              <p className="text-2xl font-bold text-primary font-mono">
                {spinsLeft}/{MAX_SPINS}
              </p>
            </div>
            {countdown && (
              <div className="glass rounded-xl px-5 py-3 text-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1">
                  <Clock className="h-3 w-3" />
                  Cooldown
                </p>
                <p className="font-mono text-lg text-warning">{countdown}</p>
              </div>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="relative"
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
              <div className="w-0 h-0 border-l-[14px] border-r-[14px] border-t-[22px] border-l-transparent border-r-transparent border-t-primary drop-shadow-lg" />
            </div>

            <div className="relative w-80 h-80">
              <svg
                viewBox="0 0 320 320"
                className="w-full h-full drop-shadow-2xl"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning ? "transform 4.2s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
                }}
              >
                {WHEEL_REWARDS.map((reward, index) => {
                  const start = index * SEGMENT_ANGLE;
                  const end = (index + 1) * SEGMENT_ANGLE;
                  const startRad = (start - 90) * (Math.PI / 180);
                  const endRad = (end - 90) * (Math.PI / 180);
                  const x1 = 160 + 145 * Math.cos(startRad);
                  const y1 = 160 + 145 * Math.sin(startRad);
                  const x2 = 160 + 145 * Math.cos(endRad);
                  const y2 = 160 + 145 * Math.sin(endRad);
                  const largeArc = SEGMENT_ANGLE > 180 ? 1 : 0;

                  const midAngle = (start + end) / 2 - 90;
                  const midRad = midAngle * (Math.PI / 180);
                  const textX = 160 + 104 * Math.cos(midRad);
                  const textY = 160 + 104 * Math.sin(midRad);

                  return (
                    <g key={reward.label}>
                      <path
                        d={`M 160 160 L ${x1} ${y1} A 145 145 0 ${largeArc} 1 ${x2} ${y2} Z`}
                        fill={segmentColors[index]}
                        stroke="hsl(220, 22%, 6%)"
                        strokeWidth="2"
                      />
                      <text
                        x={textX}
                        y={textY}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="white"
                        fontWeight="700"
                        fontSize="13"
                        transform={`rotate(${start + SEGMENT_ANGLE / 2}, ${textX}, ${textY})`}
                      >
                        {reward.label}
                      </text>
                    </g>
                  );
                })}

                <circle cx="160" cy="160" r="28" fill="hsl(220, 20%, 6%)" stroke="hsl(42, 100%, 50%)" strokeWidth="3" />
                <text
                  x="160"
                  y="160"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="hsl(42, 100%, 50%)"
                  fontSize="10"
                  fontWeight="700"
                >
                  BOOST
                </text>
              </svg>
            </div>
          </motion.div>

          <AnimatePresence>
            {lastWin && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="glass rounded-xl p-5 text-center glow-gold max-w-sm"
              >
                <Sparkles className="h-7 w-7 mx-auto text-primary mb-2" />
                <p className="text-sm text-muted-foreground">Reward secured</p>
                <p className="text-2xl font-bold text-gradient-gold">{lastWin.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{lastWin.detail}</p>
                <p className="text-sm font-mono mt-2 text-primary">+{formatXp(lastWin.xp)} XP</p>
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            onClick={handleSpin}
            disabled={spinning || spinsLeft <= 0}
            size="lg"
            className="bg-gradient-gold text-primary-foreground font-semibold text-lg px-12 glow-gold disabled:opacity-50"
          >
            {spinning ? (
              <>
                <RotateCw className="h-5 w-5 animate-spin mr-2" />
                Boosting...
              </>
            ) : spinsLeft <= 0 ? (
              "Boost Unavailable"
            ) : (
              <>
                <RotateCw className="h-5 w-5 mr-2" />
                Spin Daily Boost Wheel
              </>
            )}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
