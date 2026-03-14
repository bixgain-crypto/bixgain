import { formatXp } from "@/lib/progression";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

type GameFinishPayload = {
  rawScore: number;
  longestLength?: number;
  estimatedXp?: number;
};

type Props = {
  onFinish: (payload: GameFinishPayload) => void;
};

type Bubble = {
  id: number;
  x: number;
  y: number;
  driftX: number;
  size: number;
  duration: number;
};

const ROUND_DURATION_SECONDS = 10;
const XP_PER_TAP = 2;
const ENERGY_MAX = 100;
const ENERGY_COST_PER_TAP = 1;
const ENERGY_REGEN_MS = 5000;
const TAP_THROTTLE_MS = 60;

export function BixTapGame({ onFinish }: Props) {
  const [score, setScore] = useState(0);
  const [, setTimeLeft] = useState(ROUND_DURATION_SECONDS);
  const scoreRef = useRef(0);
  const [energy, setEnergy] = useState(ENERGY_MAX);
  const [pulseSeed, setPulseSeed] = useState(0);
  const [bubbleSeed, setBubbleSeed] = useState(0);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);

  const tapAreaRef = useRef<HTMLButtonElement | null>(null);
  const lastTapAtRef = useRef(0);

  const xp = useMemo(() => score * XP_PER_TAP, [score]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          onFinish({ rawScore: scoreRef.current });
          setScore(0);
          scoreRef.current = 0;
          setEnergy(ENERGY_MAX);
          return ROUND_DURATION_SECONDS;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [onFinish]);

  useEffect(() => {
    const regenTimer = window.setInterval(() => {
      setEnergy((current) => Math.min(ENERGY_MAX, current + 1));
    }, ENERGY_REGEN_MS);

    return () => {
      window.clearInterval(regenTimer);
    };
  }, []);

  const handleTap = (event: PointerEvent<HTMLButtonElement>) => {
    const now = Date.now();
    if (energy < ENERGY_COST_PER_TAP || now - lastTapAtRef.current < TAP_THROTTLE_MS) return;

    lastTapAtRef.current = now;
    const nextSeed = bubbleSeed + 1;
    setBubbleSeed(nextSeed);
    setScore((current) => current + 1);
    setEnergy((current) => Math.max(0, current - ENERGY_COST_PER_TAP));
    setPulseSeed((current) => current + 1);

    const rect = tapAreaRef.current?.getBoundingClientRect();
    const localX = rect ? event.clientX - rect.left : 0;
    const localY = rect ? event.clientY - rect.top : 0;

    const nextBubble: Bubble = {
      id: nextSeed,
      x: localX || (rect ? rect.width / 2 : 0),
      y: localY || (rect ? rect.height / 2 : 0),
      driftX: Math.random() * 42 - 21,
      size: 16 + Math.random() * 8,
      duration: 0.8 + Math.random() * 0.4,
    };

    setBubbles((current) => [...current, nextBubble]);

    window.setTimeout(() => {
      setBubbles((current) => current.filter((bubble) => bubble.id !== nextBubble.id));
    }, nextBubble.duration * 1000 + 60);
  };

  return (
    <div className="mx-auto flex min-h-[500px] w-full max-w-md flex-col rounded-3xl border border-cyan-300/20 bg-slate-950 p-4 text-cyan-50 shadow-[0_0_70px_-35px_rgba(34,211,238,0.9)]">
      <div className="flex items-center justify-between rounded-xl border border-cyan-200/20 bg-slate-900/80 px-4 py-3 text-sm font-semibold">
        <p>{`XP: ${formatXp(xp)}`}</p>
        <p>{`Energy: ${energy} / ${ENERGY_MAX}`}</p>
      </div>

      <button
        ref={tapAreaRef}
        type="button"
        onPointerDown={handleTap}
        disabled={energy < ENERGY_COST_PER_TAP}
        style={{ touchAction: "manipulation" }}
        className="relative mt-4 flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/25 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.24),rgba(15,23,42,1))]"
      >
        {bubbles.map((bubble) => (
          <motion.div
            key={bubble.id}
            initial={{ opacity: 0, x: bubble.x, y: bubble.y, scale: 0.7 }}
            animate={{ opacity: [0, 1, 0], x: bubble.x + bubble.driftX, y: bubble.y - 80, scale: [0.8, 1, 0.9] }}
            transition={{ duration: bubble.duration, ease: "easeOut" }}
            className="pointer-events-none absolute inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 text-[10px] font-bold text-cyan-50 drop-shadow-[0_0_12px_rgba(34,211,238,0.8)]"
          >
            <span
              className="inline-flex items-center justify-center rounded-full border border-cyan-100/35 bg-cyan-100/15 shadow-[0_0_12px_rgba(34,211,238,0.55)]"
              style={{ width: bubble.size, height: bubble.size }}
            >
              <img src="/bixgain.png" alt="BixGain" className="h-[70%] w-[70%] rounded-full object-cover" />
            </span>
            <span>+{XP_PER_TAP} XP</span>
          </motion.div>
        ))}

        <motion.div
          key={pulseSeed}
          initial={{ scale: 1 }}
          animate={{ scale: [1, 0.94, 1.04, 1] }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative"
        >
          <div className="h-[240px] w-[240px] rounded-full border-4 border-cyan-100/60 bg-gradient-to-br from-cyan-300/60 via-sky-300/20 to-slate-900 shadow-[0_0_90px_-18px_rgba(34,211,238,1)]" />
          <img src="/bixgain.png" alt="Tap BIX coin" className="absolute inset-[14%] h-[72%] w-[72%] rounded-full object-cover" />
        </motion.div>

        {energy < ENERGY_COST_PER_TAP ? (
          <div className="absolute bottom-4 rounded-full border border-cyan-200/30 bg-slate-900/90 px-3 py-1 text-xs text-cyan-100">
            Energy empty · regenerates every 5s
          </div>
        ) : null}
      </button>

    </div>
  );
}
