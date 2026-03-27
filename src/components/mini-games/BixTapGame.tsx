import { getMiniGamesOverview, startMiniGameSession, submitMiniGameScore } from "@/lib/miniGamesApi";
import DragonMascot from "@/components/DragonMascot";
import { formatXp } from "@/lib/progression";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

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
  critical: boolean;
  text: string;
};

const ENERGY_FALLBACK_MAX = 100;
const TAP_THROTTLE_MS = 80;
const XP_BUBBLE_VALUE = 2;
const COMBO_WINDOW_MS = 1100;
const ROUND_SECONDS = 10;

export function BixTapGame({ onFinish }: Props) {
  const [xpTotal, setXpTotal] = useState(0);
  const [energy, setEnergy] = useState(0);
  const [maxEnergy, setMaxEnergy] = useState(ENERGY_FALLBACK_MAX);

  const [phase, setPhase] = useState<"idle" | "running" | "submitting" | "finished">("idle");
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);

  const [bubbleSeed, setBubbleSeed] = useState(0);
  const [pulseSeed, setPulseSeed] = useState(0);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);

  const [rawScore, setRawScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [criticalHits, setCriticalHits] = useState(0);
  const [coinBursts, setCoinBursts] = useState(0);

  const [errorText, setErrorText] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

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

  useEffect(() => {
    if (phase !== "running") return;

    if (timeLeft <= 0) {
      void finishRound();
      return;
    }

    const timer = window.setTimeout(() => {
      setTimeLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [finishRound, phase, timeLeft]);

  const progressPct = useMemo(() => Math.max(0, Math.min(100, (timeLeft / ROUND_SECONDS) * 100)), [timeLeft]);

  const startRound = async () => {
    if (phase === "running" || phase === "submitting") return;
    setErrorText(null);

    try {
      const session = await startMiniGameSession("bixtap", {
        input: "dragon-fire-tap",
        started_at: new Date().toISOString(),
      });
      setSessionId(session.session_id);
      setEnergy(session.energy_remaining);
      setRawScore(0);
      setCombo(0);
      setCriticalHits(0);
      setCoinBursts(0);
      setTimeLeft(ROUND_SECONDS);
      setBubbles([]);
      lastTapAtRef.current = 0;
      setPhase("running");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Could not start BixTap round.");
      setSessionId(null);
    }
  };

  const finishRound = useCallback(async () => {
    if (!sessionId || phase !== "running") {
      setPhase("finished");
      return;
    }

    setPhase("submitting");
    try {
      const result = await submitMiniGameScore(sessionId, rawScore, {
        input: "dragon-fire-tap",
        submitted_at: new Date().toISOString(),
        combo: maxCombo,
        critical_hits: criticalHits,
      });

      setXpTotal((current) => current + result.xp_earned);
      setEnergy(result.energy_remaining);
      onFinish({ rawScore: result.raw_score, estimatedXp: result.xp_earned });
      setPhase("finished");
      setSessionId(null);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Could not submit BixTap score.");
      setPhase("finished");
    }
  }, [criticalHits, maxCombo, onFinish, phase, rawScore, sessionId]);

  const handleTap = (event: PointerEvent<HTMLButtonElement>) => {
    const now = Date.now();
    if (phase !== "running" || now - lastTapAtRef.current < TAP_THROTTLE_MS) return;

    const previousTapAt = lastTapAtRef.current;
    lastTapAtRef.current = now;

    const rect = tapAreaRef.current?.getBoundingClientRect();
    const x = rect ? event.clientX - rect.left : 0;
    const y = rect ? event.clientY - rect.top : 0;

    const nextSeed = bubbleSeed + 1;
    const comboCount = now - previousTapAt <= COMBO_WINDOW_MS ? combo + 1 : 1;
    const comboMultiplier = comboCount >= 20 ? 4 : comboCount >= 10 ? 3 : comboCount >= 5 ? 2 : 1;
    const critical = Math.random() < 0.14;
    const scoreUnits = comboMultiplier + (critical ? 1 : 0);

    const bubble: Bubble = {
      id: nextSeed,
      x: x || (rect ? rect.width / 2 : 0),
      y: y || (rect ? rect.height / 2 : 0),
      driftX: Math.random() * 42 - 21,
      size: 16 + Math.random() * 8,
      duration: 0.8 + Math.random() * 0.4,
      critical,
      text: critical ? `CRIT x${scoreUnits}` : `x${scoreUnits}`,
    };

    setBubbleSeed(nextSeed);
    setPulseSeed((value) => value + 1);
    setBubbles((current) => [...current, bubble]);
    setCombo(comboCount);
    setMaxCombo((current) => Math.max(current, comboCount));
    setRawScore((current) => current + scoreUnits);

    if (critical) {
      setCriticalHits((current) => current + 1);
    }

    if (comboCount % 10 === 0) {
      setCoinBursts((current) => current + 1);
    }

    window.setTimeout(() => {
      setBubbles((current) => current.filter((item) => item.id !== bubble.id));
    }, bubble.duration * 1000 + 50);
  };

  return (
    <div className="mx-auto flex min-h-[520px] w-full max-w-md flex-col rounded-3xl border border-cyan-300/25 bg-slate-950 p-4 text-cyan-50 shadow-[0_0_70px_-35px_rgba(34,211,238,0.9)]">
      <div className="flex items-center justify-between rounded-xl border border-cyan-200/20 bg-slate-900/80 px-4 py-3 text-sm font-semibold">
        <p>{`XP: ${formatXp(xpTotal)}`}</p>
        <p>{`Energy: ${energy} / ${maxEnergy}`}</p>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-2 rounded-xl border border-cyan-200/20 bg-slate-900/70 px-3 py-2 text-[11px]">
        <p>{`Time: ${timeLeft}s`}</p>
        <p>{`Score: ${rawScore}`}</p>
        <p>{`Combo: ${combo}`}</p>
        <p>{`Best: ${maxCombo}`}</p>
        <p>{`Crit: ${criticalHits}`}</p>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-900/70">
        <motion.div
          className="h-full bg-gradient-to-r from-sky-400 via-cyan-300 to-amber-300"
          animate={{ width: `${progressPct}%` }}
          transition={{ type: "spring", stiffness: 140, damping: 24, mass: 0.5 }}
        />
      </div>

      <button
        ref={tapAreaRef}
        type="button"
        onPointerDown={handleTap}
        disabled={phase !== "running"}
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
            <span className={bubble.critical ? "text-amber-300" : "text-cyan-50"}>{`${bubble.text} • +${XP_BUBBLE_VALUE} XP`}</span>
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
          <div className="absolute inset-[14%] flex items-center justify-center rounded-full border border-cyan-100/45 bg-slate-900/35">
            <DragonMascot mood={combo >= 20 ? "rage" : "fire"} size="lg" title="Dragon Fire Tap" />
          </div>
        </motion.div>
      </button>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void startRound()}
          disabled={phase === "running" || phase === "submitting"}
          className="rounded-lg bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {phase === "finished" ? "Play again" : "Start round"}
        </button>
        <button
          type="button"
          onClick={() => void finishRound()}
          disabled={phase !== "running"}
          className="rounded-lg border border-cyan-200/30 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-200/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          End & submit
        </button>
        <p className="self-center text-xs text-cyan-200/80">{`Bursts: ${coinBursts}`}</p>
      </div>

      {errorText ? <p className="mt-3 text-center text-xs text-red-300">{errorText}</p> : null}
      <p className="mt-2 text-center text-xs text-cyan-200/80">Tap to breathe fire. Score submits once per round for secure rewards.</p>
    </div>
  );
}
