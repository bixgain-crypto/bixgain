import { getMiniGamesOverview, submitMiniGameScore, startMiniGameSession } from "@/lib/miniGamesApi";
import { formatBix } from "@/lib/currency";
import { BixCounter } from "@/components/BixCounter";
import { formatXp } from "@/lib/progression";
import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

type GameFinishPayload = {
  rawScore: number;
  longestLength?: number;
  estimatedXp?: number;
};

type Props = {
  onFinish: (payload: GameFinishPayload) => void;
  onSyncSuccess?: () => void;
};

type Bubble = {
  id: number;
  x: number;
  y: number;
  xp: number;
  type: "normal" | "perfect" | "double" | "jackpot";
};

// Constants based on requirements
const MAX_ENERGY = 100;
const ENERGY_REGEN_MS = 500;
const BASE_XP = 10;
const PERFECT_WINDOW_MIN = 200;
const PERFECT_WINDOW_MAX = 600;
const MAX_ACTIVE_BUBBLES = 20;

export function BixTapGame({ onFinish, onSyncSuccess }: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Requirement 2: Energy System
  const [energy, setEnergy] = useState(MAX_ENERGY);
  
  // Requirement 4 & 7: XP Tracking
  const [localXp, setSessionXp] = useState(0);
  
  // Requirement 3: Combo System
  const [combo, setCombo] = useState(0);
  const lastTapAtRef = useRef(0);
  
  // Requirement 5: Bubble Animations
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  
  // Requirement 8: Local Accumulator for Backend
  const pendingXpRef = useRef(0);

  // Initialize energy from backend if available
  useEffect(() => {
    const init = async () => {
      const data = await getMiniGamesOverview();
      if (data?.energy !== undefined) setEnergy(data.energy);
      
      const session = await startMiniGameSession('bixtap', { started_at: new Date().toISOString() });
      setSessionId(session.session_id);
    };
    init().catch(() => {});
  }, []);

  // Requirement 2: Energy Regeneration Logic
  useEffect(() => {
    const timer = setInterval(() => {
      setEnergy((prev) => Math.min(MAX_ENERGY, prev + 1));
    }, ENERGY_REGEN_MS);
    return () => clearInterval(timer);
  }, []);

  // Requirement 8: Periodic Backend Sync
  const syncXp = useCallback(async () => {
    const scoreToSync = pendingXpRef.current; // Using XP as score for Tap
    if (scoreToSync <= 0 || !sessionId) return;

    pendingXpRef.current = 0; // Optimistically clear
    try {
      await submitMiniGameScore(sessionId, scoreToSync, {
        ts: Date.now(),
        type: 'periodic_sync'
      });
      if (onSyncSuccess) onSyncSuccess();
    } catch (err) {
      pendingXpRef.current += scoreToSync; // Re-add on failure
    }
  }, [sessionId, onSyncSuccess]);

  useEffect(() => {
    const syncInterval = setInterval(syncXp, 15000); // Sync every 15s
    return () => {
      clearInterval(syncInterval);
      syncXp(); // Final sync on unmount
    };
  }, [syncXp]);

  // Requirement 4: Calculate XP modularly
  const calculateXP = useCallback((currentCombo: number) => {
    const comboMultiplier = 1 + (currentCombo * 0.1);
    const variance = Math.random() * (1.1 - 0.9) + 0.9;
    
    let bonus = 1;
    let type: Bubble["type"] = "normal";
    const roll = Math.random();

    if (roll < 0.05) {
      bonus = 5; // JACKPOT
      type = "jackpot";
    } else if (roll < 0.20) {
      bonus = 2; // DOUBLE
      type = "double";
    }

    const earned = Math.floor(BASE_XP * comboMultiplier * variance * bonus);
    return { earned, type, comboMultiplier };
  }, []);

  // Requirement 5 & 9: Spawn Bubble with cleanup
  const spawnBubble = useCallback((x: number, y: number, xp: number, type: Bubble["type"]) => {
    const id = Date.now();
    setBubbles((prev) => [...prev.slice(-(MAX_ACTIVE_BUBBLES - 1)), { id, x, y, xp, type }]);
    setTimeout(() => {
      setBubbles((prev) => prev.filter((b) => b.id !== id));
    }, 1000);
  }, []);

  // Requirement 1 & 3: Handle Tap
  const handleTap = (event: PointerEvent<HTMLDivElement>) => {
    if (energy <= 0) return;

    const now = Date.now();
    const diff = now - lastTapAtRef.current;
    lastTapAtRef.current = now;

    // Combo window check
    const isPerfect = diff >= PERFECT_WINDOW_MIN && diff <= PERFECT_WINDOW_MAX;
    const newCombo = isPerfect ? combo + 1 : 0;

    const { earned, type } = calculateXP(newCombo);
    const finalType = (isPerfect && type === "normal") ? "perfect" : type;

    // Bug Fix: Prevent NaN in XP if multiplier fails
    if (Number.isNaN(earned)) {
      console.error("XP Calculation resulted in NaN");
      return;
    }

    setEnergy((e) => e - 1);
    setCombo(newCombo);
    setSessionXp((prev) => prev + earned);
    pendingXpRef.current += earned;

    // Trigger animation
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect ? event.clientX - rect.left : 0;
    const y = rect ? event.clientY - rect.top : 0;
    spawnBubble(x, y, earned, finalType);
  };

  // Requirement 7: XP -> BIX Conversion Display
  const currentMultiplier = useMemo(() => (1 + combo * 0.1).toFixed(1), [combo]);

  return (
    <div 
      className="relative mx-auto flex h-[600px] w-full max-w-md flex-col rounded-3xl border border-cyan-500/20 bg-slate-950 p-6 text-cyan-50 shadow-2xl overflow-hidden touch-none select-none"
      onPointerDown={handleTap}
    >
      {/* Requirement 6: UI ELEMENTS (TOP SECTION ONLY) */}
      <div className="z-10 space-y-4 pointer-events-none">
        {/* Energy Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-cyan-400">
            <span>Energy</span>
            <span className={energy < 10 ? "text-red-500 animate-pulse" : ""}>{energy} / {MAX_ENERGY}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-900/80 border border-white/5 overflow-hidden">
            <motion.div 
              className={`h-full bg-gradient-to-r ${energy < 10 ? 'from-red-500 to-orange-500' : 'from-cyan-400 to-blue-500'}`}
              animate={{ width: `${(energy / MAX_ENERGY) * 100}%` }}
            />
          </div>
          {energy < 10 && <p className="text-[9px] text-red-400 text-center font-bold">REGENERATING...</p>}
        </div>

        {/* XP Progress & BIX equivalent */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-amber-400">
            <span>Session XP: {formatXp(localXp)}</span>
            <span>
              <BixCounter value={localXp / 10000} />
              {" BIX"}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-900/80 border border-white/5 overflow-hidden">
            <motion.div 
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
              animate={{ width: `${(localXp % 10000) / 100}%` }}
            />
          </div>
        </div>

        {/* Overlays for Multiplier and Combo */}
        <div className="flex justify-between items-center pt-2">
          <AnimatePresence mode="wait">
            {combo > 0 && (
              <motion.div 
                key={combo}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.2, opacity: 0 }}
                className="text-2xl font-black text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.6)]"
              >
                COMBO x{combo}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs font-bold backdrop-blur-sm">
            MULTIPLIER x{currentMultiplier}
          </div>
        </div>
      </div>

      {/* Animations: Floating XP Bubbles */}
      <AnimatePresence>
        {bubbles.map((b) => (
          <motion.div
            key={b.id}
            initial={{ opacity: 0, y: b.y, x: b.x, scale: 0.5 }}
            animate={{ opacity: [0, 1, 0], y: b.y - 120, x: b.x + (Math.random() * 40 - 20), scale: [0.5, 1.2, 1] }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`pointer-events-none absolute font-black italic
              ${b.type === 'jackpot' ? 'text-amber-400 text-3xl drop-shadow-[0_0_15px_rgba(251,191,36,1)]' : 
                b.type === 'double' ? 'text-blue-400 text-2xl' : 
                b.type === 'perfect' ? 'text-cyan-300 text-xl' : 'text-white'}`}
          >
            +{b.xp}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Background Hint */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
        <p className="text-4xl font-black uppercase tracking-tighter text-slate-800">
          {energy > 0 ? "Tap to Earn" : "Out of Energy"}
        </p>
      </div>
    </div>
  );
}