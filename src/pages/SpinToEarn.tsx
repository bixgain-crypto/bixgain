import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/context/AppDataContext";
import { useAuth } from "@/hooks/useAuth";
import { claimDailyReward } from "@/lib/progressionApi";
import { formatXp } from "@/lib/progression";
import { AnimatePresence, motion } from "framer-motion";
import { Orbit, RotateCw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const WHEEL_LABELS = ["+25 XP", "+50 XP", "+75 XP", "XP Boost", "Mission Reset", "Streak Bonus"];
const SEGMENT_ANGLE = 360 / WHEEL_LABELS.length;

type ClaimResult = {
  xp: number;
  nextClaimAt?: string;
};

function parseClaimResult(payload: Record<string, unknown>): ClaimResult {
  const xpRaw = payload.reward_xp ?? payload.awarded_xp ?? payload.claimed_xp ?? payload.xp ?? 0;
  const xp = Number(xpRaw);
  const nextClaimAt = typeof payload.next_claim_at === "string" ? payload.next_claim_at : undefined;
  return { xp: Number.isFinite(xp) ? xp : 0, nextClaimAt };
}

export default function SpinToEarn() {
  const { user } = useAuth();
  const { refreshActivities, refreshUserProfile, refreshLeaderboard } = useAppData();
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [resultLabel, setResultLabel] = useState<string | null>(null);

  const segmentColors = useMemo(
    () => [
      "hsl(205, 80%, 55%)",
      "hsl(192, 76%, 42%)",
      "hsl(170, 70%, 42%)",
      "hsl(42, 100%, 50%)",
      "hsl(28, 95%, 55%)",
      "hsl(264, 65%, 56%)",
    ],
    [],
  );

  const handleSpin = async () => {
    if (spinning) return;
    setSpinning(true);
    setResult(null);
    setResultLabel(null);

    const index = Math.floor(Math.random() * WHEEL_LABELS.length);
    const label = WHEEL_LABELS[index];
    const targetAngle = 360 - (index * SEGMENT_ANGLE + SEGMENT_ANGLE / 2);
    setRotation((prev) => prev + 6 * 360 + targetAngle + (Math.random() * 8 - 4));

    setTimeout(async () => {
      try {
        const response = await claimDailyReward();
        const parsed = parseClaimResult(response);
        setResult(parsed);
        setResultLabel(label);
        toast.success(`Daily reward claimed: +${formatXp(parsed.xp)} XP`);
        await Promise.all([
          refreshUserProfile(),
          refreshActivities(),
          refreshLeaderboard("weekly"),
          refreshLeaderboard("season"),
        ]);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unable to claim daily reward";
        toast.error(message);
      } finally {
        setSpinning(false);
      }
    }, 4200);
  };

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
          <div className="glass rounded-xl px-5 py-3 text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Bix Balance</p>
            <p className="text-xl font-bold">{Number(user?.bix_balance || 0).toLocaleString()} Bix</p>
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
                {WHEEL_LABELS.map((label, index) => {
                  const start = index * SEGMENT_ANGLE;
                  const end = (index + 1) * SEGMENT_ANGLE;
                  const startRad = (start - 90) * (Math.PI / 180);
                  const endRad = (end - 90) * (Math.PI / 180);
                  const x1 = 160 + 145 * Math.cos(startRad);
                  const y1 = 160 + 145 * Math.sin(startRad);
                  const x2 = 160 + 145 * Math.cos(endRad);
                  const y2 = 160 + 145 * Math.sin(endRad);
                  const midAngle = (start + end) / 2 - 90;
                  const midRad = midAngle * (Math.PI / 180);
                  const textX = 160 + 104 * Math.cos(midRad);
                  const textY = 160 + 104 * Math.sin(midRad);

                  return (
                    <g key={label}>
                      <path
                        d={`M 160 160 L ${x1} ${y1} A 145 145 0 0 1 ${x2} ${y2} Z`}
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
                        {label}
                      </text>
                    </g>
                  );
                })}

                <circle cx="160" cy="160" r="28" fill="hsl(220, 20%, 6%)" stroke="hsl(42, 100%, 50%)" strokeWidth="3" />
                <text x="160" y="160" textAnchor="middle" dominantBaseline="middle" fill="hsl(42, 100%, 50%)" fontSize="10" fontWeight="700">
                  BOOST
                </text>
              </svg>
            </div>
          </motion.div>

          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="glass rounded-xl p-5 text-center glow-gold max-w-sm"
              >
                <Sparkles className="h-7 w-7 mx-auto text-primary mb-2" />
                <p className="text-sm text-muted-foreground">Daily reward secured</p>
                <p className="text-2xl font-bold text-gradient-gold">{resultLabel || "XP Reward"}</p>
                <p className="text-sm font-mono mt-2 text-primary">{`+${formatXp(result.xp)} XP`}</p>
                {result.nextClaimAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {`Next claim: ${new Date(result.nextClaimAt).toLocaleString()}`}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            onClick={handleSpin}
            disabled={spinning}
            size="lg"
            className="bg-gradient-gold text-primary-foreground font-semibold text-lg px-12 glow-gold disabled:opacity-50"
          >
            {spinning ? (
              <>
                <RotateCw className="h-5 w-5 animate-spin mr-2" />
                Boosting...
              </>
            ) : (
              <>
                <RotateCw className="h-5 w-5 mr-2" />
                Claim Daily Boost
              </>
            )}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
