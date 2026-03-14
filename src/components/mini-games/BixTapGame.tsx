import { getMiniGamesOverview, startMiniGameSession, submitMiniGameScore } from "@/lib/miniGamesApi";
import { formatXp } from "@/lib/progression";
import { motion } from "framer-motion";
import { useEffect, useRef, useState, type PointerEvent } from "react";

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

const ENERGY_FALLBACK_MAX = 100;
const TAP_THROTTLE_MS = 80;
const XP_BUBBLE_VALUE = 2;

export function BixTapGame({ onFinish }: Props) {
  const [xpTotal, setXpTotal] = useState(0);
  const [energy, setEnergy] = useState(0);
  const [maxEnergy, setMaxEnergy] = useState(ENERGY_FALLBACK_MAX);
  const [bubbleSeed, setBubbleSeed] = useState(0);
  const [pulseSeed, setPulseSeed] = useState(0);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [isSubmittingTap, setIsSubmittingTap] = useState(false);

  const [errorText, setErrorText] = useState<string | null>(null);
  const tapAreaRef = useRef<HTMLButtonElement | null>(null);
  const lastTapAtRef = useRef(0);

  useEffect(() => {
    let isMounted = true;

    const loadFromBackend = async () => {
      try {
        const overview = await getMiniGamesOverview();
        if (!isMounted) return;
        setXpTotal(overview.stats.total_xp_from_games);
        setEnergy(overview.energy);
        setMaxEnergy(overview.max_energy);
        setErrorText(null);
      } catch (error) {
        if (!isMounted) return;
        setErrorText(error instanceof Error ? error.message : "Could not load BIXTap data.");
      }
    };

    void loadFromBackend();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleTap = async (event: PointerEvent<HTMLButtonElement>) => {
    const now = Date.now();
    if (isSubmittingTap || energy <= 0 || now - lastTapAtRef.current < TAP_THROTTLE_MS) return;

    lastTapAtRef.current = now;
    setIsSubmittingTap(true);
    setErrorText(null);

    const rect = tapAreaRef.current?.getBoundingClientRect();
    const x = rect ? event.clientX - rect.left : 0;
    const y = rect ? event.clientY - rect.top : 0;

    const nextSeed = bubbleSeed + 1;
    const bubble: Bubble = {
      id: nextSeed,
      x: x || (rect ? rect.width / 2 : 0),
      y: y || (rect ? rect.height / 2 : 0),
      driftX: Math.random() * 42 - 21,
      size: 16 + Math.random() * 8,
      duration: 0.8 + Math.random() * 0.4,
    };

    try {
      const session = await startMiniGameSession("bixtap", { input: "tap" });
      const result = await submitMiniGameScore(session.session_id, 1, { input: "tap" });

      setBubbleSeed(nextSeed);
      setPulseSeed((value) => value + 1);
      setBubbles((current) => [...current, bubble]);
      setEnergy(result.energy_remaining);
      setXpTotal((current) => current + result.xp_earned);

      onFinish({ rawScore: result.raw_score, estimatedXp: result.xp_earned });

      window.setTimeout(() => {
        setBubbles((current) => current.filter((item) => item.id !== bubble.id));
      }, bubble.duration * 1000 + 50);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Tap failed. Please retry.");

      try {
        const overview = await getMiniGamesOverview();
        setXpTotal(overview.stats.total_xp_from_games);
        setEnergy(overview.energy);
        setMaxEnergy(overview.max_energy);
      } catch {
        // Preserve original error text when fallback refresh fails.
      }
    } finally {
      setIsSubmittingTap(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[520px] w-full max-w-md flex-col rounded-3xl border border-cyan-300/25 bg-slate-950 p-4 text-cyan-50 shadow-[0_0_70px_-35px_rgba(34,211,238,0.9)]">
      <div className="flex items-center justify-between rounded-xl border border-cyan-200/20 bg-slate-900/80 px-4 py-3 text-sm font-semibold">
        <p>{`XP: ${formatXp(xpTotal)}`}</p>
        <p>{`Energy: ${energy} / ${maxEnergy}`}</p>
      </div>

      <button
        ref={tapAreaRef}
        type="button"
        onPointerDown={(event) => {
          void handleTap(event);
        }}
        disabled={energy <= 0 || isSubmittingTap}
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
            <span>{`+${XP_BUBBLE_VALUE} XP`}</span>
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

        {energy <= 0 ? (
          <div className="absolute bottom-4 rounded-full border border-cyan-200/30 bg-slate-900/90 px-3 py-1 text-xs text-cyan-100">
            No energy left. Recharge required.
          </div>
        ) : null}
      </button>

      {errorText ? <p className="mt-3 text-center text-xs text-red-300">{errorText}</p> : null}
    </div>
  );
}
