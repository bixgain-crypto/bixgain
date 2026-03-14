import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatXp } from "@/lib/progression";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

type GameFinishPayload = {
  rawScore: number;
  longestLength?: number;
  estimatedXp?: number;
};

type Props = {
  onFinish: (payload: GameFinishPayload) => void;
};

type FloatingXpText = {
  id: number;
  x: number;
};

const BIX_TAP_DURATION_SECONDS = 10;
const BIX_TAP_XP_PER_TAP = 2;
const ENERGY_MAX = 100;
const ENERGY_COST_PER_TAP = 5;
const TAP_THROTTLE_MS = 80;

export function BixTapGame({ onFinish }: Props) {
  const [phase, setPhase] = useState<"idle" | "running" | "finished">("idle");
  const [timeLeft, setTimeLeft] = useState(BIX_TAP_DURATION_SECONDS);
  const [score, setScore] = useState(0);
  const [pulseSeed, setPulseSeed] = useState(0);
  const [particleSeed, setParticleSeed] = useState(0);
  const [floatingXpTexts, setFloatingXpTexts] = useState<FloatingXpText[]>([]);
  const [energy, setEnergy] = useState(ENERGY_MAX);
  const lastTapAtRef = useRef(0);

  const elapsedSeconds = useMemo(() => Math.max(0, BIX_TAP_DURATION_SECONDS - timeLeft), [timeLeft]);
  const progressPct = useMemo(() => Math.max(0, Math.min(100, (timeLeft / BIX_TAP_DURATION_SECONDS) * 100)), [timeLeft]);
  const tapsPerSecond = useMemo(() => (elapsedSeconds > 0 ? score / elapsedSeconds : 0), [score, elapsedSeconds]);
  const estimatedBaseXp = score * BIX_TAP_XP_PER_TAP;
  const estimatedBix = useMemo(() => estimatedBaseXp / 10000, [estimatedBaseXp]);
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
    setFloatingXpTexts([]);
    lastTapAtRef.current = 0;
    setPhase("running");
  };

  const handleTap = () => {
    const now = Date.now();
    if (phase !== "running" || energy < ENERGY_COST_PER_TAP || now - lastTapAtRef.current < TAP_THROTTLE_MS) return;

    lastTapAtRef.current = now;
    const nextSeed = particleSeed + 1;
    setParticleSeed(nextSeed);
    setScore((current) => current + 1);
    setEnergy((current) => Math.max(0, current - ENERGY_COST_PER_TAP));
    setPulseSeed((current) => current + 1);

    const floatingXp: FloatingXpText = {
      id: nextSeed,
      x: Math.random() * 64 - 32,
    };

    setFloatingXpTexts((current) => [...current, floatingXp]);

    window.setTimeout(() => {
      setFloatingXpTexts((current) => current.filter((text) => text.id !== floatingXp.id));
    }, 700);
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-4 rounded-3xl border border-cyan-200/10 bg-slate-950/90 p-4 text-slate-100 shadow-[0_0_80px_-45px_rgba(56,189,248,0.8)] sm:p-5">
      <div className="rounded-2xl border border-cyan-300/20 bg-slate-900/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-cyan-100">BIXTap</p>
            <p className="text-xs text-slate-300">Tap to earn XP. Rewards are finalized by backend verification.</p>
          </div>
          <Badge variant="secondary" className="border border-cyan-300/40 bg-cyan-300/15 text-[11px] text-cyan-100">
            {`${BIX_TAP_XP_PER_TAP} XP / tap`}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-cyan-200/20 bg-slate-950/80 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wider text-slate-400">XP</p>
            <p className="mt-1 text-2xl font-black text-cyan-100">{rewardCounter}</p>
          </div>
          <div className="rounded-xl border border-cyan-200/20 bg-slate-950/80 px-3 py-2.5 text-right">
            <p className="text-[11px] uppercase tracking-wider text-slate-400">BIX</p>
            <p className="mt-1 text-2xl font-black text-emerald-300">{estimatedBix.toFixed(4)}</p>
          </div>
          <div className="rounded-xl border border-cyan-200/20 bg-slate-950/80 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wider text-slate-400">Time Left</p>
            <p className="mt-1 text-xl font-bold text-slate-100">{`${timeLeft}s`}</p>
          </div>
          <div className="rounded-xl border border-cyan-200/20 bg-slate-950/80 px-3 py-2.5 text-right">
            <p className="text-[11px] uppercase tracking-wider text-slate-400">Tap Speed</p>
            <p className="mt-1 text-xl font-bold text-slate-100">{`${tapsPerSecond.toFixed(1)}/s`}</p>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-400/5 px-3 py-2 text-xs text-cyan-100">
          <p className="font-semibold">Profit indicator</p>
          <p>{`+${BIX_TAP_XP_PER_TAP} XP per tap`}</p>
          <p className="text-cyan-200/80">{`≈ ${(BIX_TAP_XP_PER_TAP / 10000).toFixed(4)} BIX`}</p>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-300">
            <span>Energy</span>
            <span>{Math.round(energy)} / {ENERGY_MAX}</span>
          </div>
          <div className="h-2 rounded-full border border-cyan-200/20 bg-slate-950/90 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-300"
              animate={{ width: `${(energy / ENERGY_MAX) * 100}%` }}
              transition={{ type: "spring", stiffness: 150, damping: 24, mass: 0.45 }}
            />
          </div>
          <div className="h-1.5 rounded-full border border-cyan-200/20 bg-slate-950/90 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-teal-300"
              animate={{ width: `${progressPct}%` }}
              transition={{ type: "spring", stiffness: 140, damping: 24, mass: 0.5 }}
            />
          </div>

          <Button variant="outline" disabled className="mt-3 w-full border-cyan-300/30 bg-cyan-300/10 text-cyan-100 opacity-90">
            Boost (Coming Soon)
          </Button>
        </div>
      </div>

      <motion.button
        type="button"
        onPointerDown={handleTap}
        disabled={phase !== "running"}
        whileTap={phase === "running" ? { scale: 0.98 } : undefined}
        style={{ touchAction: "manipulation" }}
        className={`relative flex min-h-[320px] w-full items-center justify-center overflow-hidden rounded-[2rem] border transition-all ${
          phase === "running"
            ? "border-cyan-300/50 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.35),rgba(30,41,59,0.96))] shadow-[0_0_70px_-30px_rgba(56,189,248,1)]"
            : "border-slate-700 bg-slate-900/70"
        }`}
      >
        {floatingXpTexts.map((xpText) => (
          <motion.div
            key={xpText.id}
            initial={{ opacity: 0, y: 20, x: xpText.x, scale: 0.85 }}
            animate={{ opacity: [0, 1, 0], y: -85, x: xpText.x }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="pointer-events-none absolute left-1/2 top-1/2 text-lg font-black text-cyan-200 drop-shadow-[0_0_14px_rgba(34,211,238,0.95)]"
          >
            {`+${BIX_TAP_XP_PER_TAP} XP`}
          </motion.div>
        ))}

        <motion.div
          key={pulseSeed}
          initial={{ scale: 1 }}
          animate={{ scale: phase === "running" ? [1, 0.95, 1.02, 1] : 1 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="relative"
        >
          <div className="h-[220px] w-[220px] rounded-full border-4 border-cyan-200/70 bg-gradient-to-br from-cyan-200/50 via-sky-300/20 to-slate-900 shadow-[0_0_80px_-20px_rgba(6,182,212,0.9)]" />
          <img src="/bixgain.png" alt="BIX Coin" className="absolute inset-[14%] h-[72%] w-[72%] rounded-full object-cover" />
        </motion.div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-cyan-200/30 bg-slate-900/70 px-4 py-1 text-xs text-cyan-100 backdrop-blur-sm">
          {phase === "running" ? "Tap the coin" : phase === "idle" ? "Press Start to begin" : "Round complete"}
        </div>
      </motion.button>

      <div className="flex flex-wrap gap-2">
        <Button onClick={startRound} className="bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-500 text-slate-950 font-bold">
          {phase === "running" ? "Restart Round" : phase === "finished" ? "Play Again" : "Start BIXTap"}
        </Button>
        <Button variant="outline" onClick={handleTap} disabled={phase !== "running" || energy < ENERGY_COST_PER_TAP}>
          +1 Tap
        </Button>
      </div>

      {phase === "finished" ? (
        <p className="text-sm text-muted-foreground text-center">Round complete. Submit score to verify reward.</p>
      ) : null}
    </div>
  );
}
