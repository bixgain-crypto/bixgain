import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatXp } from "@/lib/progression";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

type GameFinishPayload = {
  rawScore: number;
  longestLength?: number;
  estimatedXp?: number;
};

type Props = {
  onFinish: (payload: GameFinishPayload) => void;
};

type BubbleParticle = {
  id: number;
  x: number;
  y: number;
  driftX: number;
  driftY: number;
  size: number;
  rotate: number;
};

type SparkleParticle = {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
};

const BIX_TAP_DURATION_SECONDS = 10;
const BIX_TAP_XP_PER_TAP = 2;
const ENERGY_MAX = 100;
const ENERGY_COST_PER_TAP = 5;

export function BixTapGame({ onFinish }: Props) {
  const [phase, setPhase] = useState<"idle" | "running" | "finished">("idle");
  const [timeLeft, setTimeLeft] = useState(BIX_TAP_DURATION_SECONDS);
  const [score, setScore] = useState(0);
  const [pulseSeed, setPulseSeed] = useState(0);
  const [particleSeed, setParticleSeed] = useState(0);
  const [bubbleParticles, setBubbleParticles] = useState<BubbleParticle[]>([]);
  const [sparkles, setSparkles] = useState<SparkleParticle[]>([]);
  const [energy, setEnergy] = useState(ENERGY_MAX);

  const elapsedSeconds = useMemo(() => Math.max(0, BIX_TAP_DURATION_SECONDS - timeLeft), [timeLeft]);
  const progressPct = useMemo(() => Math.max(0, Math.min(100, (timeLeft / BIX_TAP_DURATION_SECONDS) * 100)), [timeLeft]);
  const tapsPerSecond = useMemo(() => (elapsedSeconds > 0 ? score / elapsedSeconds : 0), [score, elapsedSeconds]);
  const estimatedBaseXp = score * BIX_TAP_XP_PER_TAP;
  const rewardCounter = useMemo(() => formatXp(estimatedBaseXp), [estimatedBaseXp]);

  useEffect(() => {
    if (phase !== "running") return;

    if (timeLeft <= 0) {
      setPhase("finished");
      onFinish({ rawScore: score });
      return;
    }

    const timer = window.setTimeout(() => setTimeLeft((current) => Math.max(0, current - 1)), 1000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [phase, timeLeft, score, onFinish]);

  useEffect(() => {
    if (phase !== "running") return;

    const refillTimer = window.setInterval(() => {
      setEnergy((current) => Math.min(ENERGY_MAX, current + 1.25));
    }, 140);

    return () => {
      window.clearInterval(refillTimer);
    };
  }, [phase]);

  const startRound = () => {
    setScore(0);
    setTimeLeft(BIX_TAP_DURATION_SECONDS);
    setEnergy(ENERGY_MAX);
    setBubbleParticles([]);
    setSparkles([]);
    setPhase("running");
  };

  const handleTap = () => {
    if (phase !== "running" || energy < 1) return;

    const nextSeed = particleSeed + 1;
    setParticleSeed(nextSeed);
    setScore((current) => current + 1);
    setEnergy((current) => Math.max(0, current - ENERGY_COST_PER_TAP));
    setPulseSeed((current) => current + 1);

    const bubbles = Array.from({ length: 3 + Math.floor(Math.random() * 3) }, (_, index) => ({
      id: nextSeed * 10 + index,
      x: Math.random() * 40 - 20,
      y: Math.random() * 12 - 6,
      driftX: Math.random() * 110 - 55,
      driftY: -(60 + Math.random() * 75),
      size: 18 + Math.random() * 14,
      rotate: Math.random() * 50 - 25,
    }));

    const glowSparkles = Array.from({ length: 8 }, (_, index) => ({
      id: nextSeed * 100 + index,
      x: Math.random() * 220 - 110,
      y: Math.random() * 220 - 110,
      size: 5 + Math.random() * 7,
      delay: Math.random() * 0.14,
    }));

    setBubbleParticles((current) => [...current, ...bubbles]);
    setSparkles((current) => [...current, ...glowSparkles]);

    window.setTimeout(() => {
      setBubbleParticles((current) => current.filter((bubble) => !bubbles.some((item) => item.id === bubble.id)));
    }, 950);

    window.setTimeout(() => {
      setSparkles((current) => current.filter((sparkle) => !glowSparkles.some((item) => item.id === sparkle.id)));
    }, 650);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-amber-300/30 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.25),rgba(251,146,60,0.16),rgba(46,16,101,0.95))] p-4 sm:p-5 shadow-[0_20px_70px_-40px_rgba(251,146,60,0.9)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-amber-100">BIXTap Treasure Rush</p>
            <p className="text-xs text-amber-100/70">Tap the golden BIX coin and burst glowing +BIX treasure bubbles.</p>
          </div>
          <Badge variant="secondary" className="border border-amber-300/40 bg-amber-100/20 text-[11px] text-amber-50">
            {`${BIX_TAP_XP_PER_TAP} BIX / tap`}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-amber-200/30 bg-purple-950/50 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wider text-amber-100/65">Time Left</p>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-amber-100">{`${timeLeft}s`}</p>
          </div>
          <div className="rounded-xl border border-amber-200/30 bg-purple-950/50 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wider text-amber-100/65">Tap Counter</p>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-amber-100">{score}</p>
          </div>
          <div className="rounded-xl border border-amber-200/30 bg-purple-950/50 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wider text-amber-100/65">Tap Speed</p>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-amber-100">{`${tapsPerSecond.toFixed(1)}/s`}</p>
          </div>
          <div className="rounded-xl border border-amber-200/30 bg-purple-950/50 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wider text-amber-100/65">Reward Counter</p>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-yellow-300">{rewardCounter}</p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-amber-100/70">
            <span>Energy</span>
            <span>{Math.round(energy)} / {ENERGY_MAX}</span>
          </div>
          <div className="h-2 rounded-full bg-purple-950/60 overflow-hidden border border-amber-200/20">
            <motion.div
              className="h-full bg-gradient-to-r from-orange-500 via-amber-300 to-yellow-200"
              animate={{ width: `${(energy / ENERGY_MAX) * 100}%` }}
              transition={{ type: "spring", stiffness: 150, damping: 24, mass: 0.45 }}
            />
          </div>
          <div className="h-1.5 rounded-full bg-purple-950/60 overflow-hidden border border-amber-200/20">
            <motion.div
              className="h-full bg-gradient-to-r from-fuchsia-400 via-orange-400 to-amber-300"
              animate={{ width: `${progressPct}%` }}
              transition={{ type: "spring", stiffness: 140, damping: 24, mass: 0.5 }}
            />
          </div>
        </div>
      </div>

      <motion.button
        type="button"
        onPointerDown={handleTap}
        disabled={phase !== "running"}
        whileTap={phase === "running" ? { scale: 0.965 } : undefined}
        style={{ touchAction: "manipulation" }}
        className={`relative w-full min-h-[260px] sm:min-h-[320px] rounded-[2rem] border overflow-hidden transition-all ${
          phase === "running"
            ? "border-yellow-300/40 bg-[radial-gradient(circle_at_50%_25%,rgba(251,191,36,0.35),rgba(249,115,22,0.22),rgba(46,16,101,0.98))] shadow-[0_20px_80px_-35px_rgba(249,115,22,0.9)]"
            : "border-border/60 bg-secondary/20"
        }`}
      >
        {bubbleParticles.map((bubble) => (
          <motion.div
            key={bubble.id}
            initial={{ opacity: 0, x: bubble.x, y: bubble.y, scale: 0.2, rotate: bubble.rotate }}
            animate={{ opacity: [0, 1, 0], x: bubble.x + bubble.driftX, y: bubble.y + bubble.driftY, scale: [0.4, 1, 0.7], rotate: bubble.rotate + 15 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="pointer-events-none absolute left-1/2 top-1/2 flex items-center justify-center rounded-full border border-yellow-200/70 bg-amber-200/30 text-[10px] font-extrabold text-yellow-100 shadow-[0_0_22px_rgba(253,224,71,0.85)]"
            style={{ width: bubble.size * 1.95, height: bubble.size }}
          >
            +BIX
          </motion.div>
        ))}

        {sparkles.map((sparkle) => (
          <motion.span
            key={sparkle.id}
            initial={{ opacity: 0, scale: 0.15 }}
            animate={{ opacity: [0, 0.95, 0], scale: [0.2, 1, 0.2] }}
            transition={{ duration: 0.55, delay: sparkle.delay, ease: "easeOut" }}
            className="pointer-events-none absolute rounded-full bg-yellow-200"
            style={{
              width: sparkle.size,
              height: sparkle.size,
              left: `calc(50% + ${sparkle.x}px)`,
              top: `calc(50% + ${sparkle.y}px)`,
              boxShadow: "0 0 12px rgba(253, 224, 71, 0.95)",
            }}
          />
        ))}

        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div key={pulseSeed} initial={{ scale: 1 }} animate={{ scale: phase === "running" ? [1, 0.94, 1.03, 1] : 1 }} transition={{ duration: 0.26, ease: "easeOut" }} className="relative">
            <div className="h-[196px] w-[196px] sm:h-[224px] sm:w-[224px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(254,240,138,0.96),rgba(251,146,60,0.9),rgba(120,53,15,0.95))] border-4 border-yellow-200/80 shadow-[0_0_40px_rgba(251,191,36,0.8)]" />
            <motion.div
              animate={{ rotate: phase === "running" ? [0, -2, 2, 0] : 0, y: phase === "running" ? [0, -1.5, 0] : 0 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="absolute -top-6 left-1/2 -translate-x-1/2 text-5xl sm:text-6xl drop-shadow-[0_0_15px_rgba(251,191,36,0.9)]"
            >
              🐉
            </motion.div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-full border-4 border-amber-950/50 bg-amber-900/35 px-8 py-5 shadow-inner shadow-amber-950/50">
                <p className="text-4xl sm:text-5xl font-black tracking-tight text-amber-50">BIX</p>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-yellow-200/30 bg-amber-100/10 px-4 py-1 text-xs text-amber-50/90 backdrop-blur-sm">
          {phase === "running" ? "Tap the treasure coin!" : phase === "idle" ? "Press Start, then tap rapidly." : "Round complete."}
        </div>
      </motion.button>

      <div className="flex flex-wrap gap-2">
        <Button onClick={startRound} className="bg-gradient-to-r from-yellow-400 via-orange-400 to-amber-500 text-amber-950 font-bold">
          {phase === "running" ? "Restart Round" : phase === "finished" ? "Play Again" : "Start BIXTap"}
        </Button>
        <Button variant="outline" onClick={handleTap} disabled={phase !== "running" || energy < 1}>
          +1 Tap
        </Button>
      </div>

      {phase === "finished" ? (
        <p className="text-sm text-muted-foreground text-center">Round complete. Submit score to verify reward.</p>
      ) : null}
    </div>
  );
}
