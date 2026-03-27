import { useState, useEffect, useCallback, useRef } from 'react';
import { computeFlow, checkWin, rotatePipe } from '@/lib/pipeGame/pipeTypes';
import type { Grid } from '@/lib/pipeGame/pipeTypes';
import { generateLevel, getLevelConfig } from '@/lib/pipeGame/puzzleGenerator';
import { submitMiniGameScore, startMiniGameSession } from '@/lib/miniGamesApi';
import { formatBix } from '@/lib/currency';
import { BixCounter } from '@/components/BixCounter';
import { formatXp } from '@/lib/progression';
import PipeTile from './PipeTile';

type Phase = 'playing' | 'flowing' | 'won';

interface GameState {
  currentLevel: number;
  totalXP: number;
}

interface PlumberPuzzleGameProps {
  onSuccess?: () => void | Promise<void>;
}

const STORAGE_KEY = 'bixpuzzle-plumber-state';

function loadState(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    currentLevel: 1,
    totalXP: 0,
  };
}

function saveState(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function PlumberPuzzleGame({ onSuccess }: PlumberPuzzleGameProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>(loadState);
  const [grid, setGrid] = useState<Grid>([]);
  const [filled, setFilled] = useState<boolean[][]>([]);
  const [phase, setPhase] = useState<Phase>('playing');
  const [moves, setMoves] = useState(0);
  const [timer, setTimer] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [hint, setHint] = useState<[number, number] | null>(null);
  const [hintsLeft, setHintsLeft] = useState(3);
  const [earnedXP, setEarnedXP] = useState(0);
  const [showWin, setShowWin] = useState(false);
  const [splash, setSplash] = useState(false);
  const winTimeout = useRef<ReturnType<typeof setTimeout>>();

  const config = getLevelConfig(gameState.currentLevel);
  const { rows, cols } = config;

  const TILE_SIZE = Math.min(
    Math.floor(Math.min(window.innerWidth - 32, 480) / cols) - 4,
    Math.floor(360 / rows) - 4
  );

  const initLevel = useCallback(async () => {
    const newGrid = generateLevel(config);
    setGrid(newGrid);
    setFilled(Array.from({ length: config.rows }, () => Array(config.cols).fill(false)));
    setMoves(0);
    setPhase('playing');
    setShowWin(false);
    setSplash(false);
    setTimer(0);
    setTimerActive(true);
    setHint(null);
    
    try {
      const session = await startMiniGameSession('plumber_puzzle', {
        level: gameState.currentLevel,
        started_at: new Date().toISOString()
      });
      setSessionId(session.session_id);
    } catch (err) {
      console.error("Failed to start session:", err);
    }
  }, [config.levelNumber]);

  useEffect(() => { initLevel(); }, [initLevel]);

  useEffect(() => {
    if (grid.length === 0) return;
    const f = computeFlow(grid, rows, cols);
    setFilled(f);
    if (checkWin(grid, f, rows, cols) && phase === 'playing') {
      const finalTime = timer;
      setPhase('flowing');
      setTimerActive(false);
      setSplash(true);
      
      winTimeout.current = setTimeout(async () => {
        const xp = config.xpReward + (finalTime < 30 ? Math.floor(config.xpReward * 0.5) : 0);
        setEarnedXP(xp);
        
        if (sessionId) {
          setSubmitting(true);
          try {
            const result = await submitMiniGameScore(sessionId, moves, {
              xp_earned: xp,
              duration: finalTime,
              level: gameState.currentLevel,
              final_grid: grid // Send the grid state for backend verification
            });
            
            const updated = { 
              ...gameState, 
              totalXP: gameState.totalXP + result.xp_earned
            };
            setGameState(updated);
            saveState(updated);
            await onSuccess?.();
            setPhase('won');
            setShowWin(true);
          } catch (err) {
            console.error("Reward sync failed:", err);
          } finally {
            setSubmitting(false);
            setSplash(false);
          }
        }
      }, 1500);
    }
  }, [grid, gameState, config, phase, rows, cols, sessionId, moves, onSuccess]);

  useEffect(() => {
    if (!timerActive) return;
    const id = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [timerActive]);

  useEffect(() => () => { if (winTimeout.current) clearTimeout(winTimeout.current); }, []);

  function handleRotate(r: number, c: number) {
    if (phase !== 'playing') return;
    const cell = grid[r][c];
    if (!cell.pipe || cell.pipe.isSource || cell.pipe.isSink) return;
    setGrid(prev => {
      const g = prev.map(row => row.map(cell => ({ ...cell, pipe: cell.pipe ? { ...cell.pipe } : null })));
      g[r][c] = { pipe: rotatePipe(cell.pipe!) };
      return g;
    });
    setMoves(m => m + 1);
    setHint(null);
  }

  function handleHint() {
    if (hintsLeft <= 0 || phase !== 'playing') return;
    const wrongCells: [number, number][] = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (grid[r][c].pipe && !grid[r][c].pipe!.isSource && !grid[r][c].pipe!.isSink && !filled[r][c])
          wrongCells.push([r, c]);
    if (wrongCells.length === 0) return;
    const pick = wrongCells[Math.floor(Math.random() * wrongCells.length)];
    setHint(pick);
    setHintsLeft(h => h - 1);
    setTimeout(() => setHint(null), 2500);
  }

  function handleNextLevel() {
    const updated = { ...gameState, currentLevel: gameState.currentLevel + 1 };
    setGameState(updated);
    saveState(updated);
    setShowWin(false);
  }

  function handleRestart() {
    initLevel();
  }

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const diffColor = config.difficulty === 'easy' ? 'text-emerald-400' : config.difficulty === 'medium' ? 'text-amber-400' : 'text-rose-400';
  const diffLabel = config.difficulty === 'easy' ? 'Easy' : config.difficulty === 'medium' ? 'Medium' : 'Hard';

  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-b from-slate-950 via-purple-950/30 to-slate-950 select-none p-4">
      {/* Header */}
      <div className="w-full max-w-lg text-center pb-3">
        <h1 className="text-2xl font-black bg-gradient-to-r from-purple-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent tracking-tight">
          Plumber Puzzle
        </h1>
        <div className="flex items-center justify-center gap-3 mt-1 text-xs">
          <span className="text-slate-400">Level <span className="text-white font-bold">{gameState.currentLevel}</span></span>
          <span className={`font-semibold ${diffColor}`}>{diffLabel}</span>
          <span className="text-slate-400">Moves <span className="text-white font-bold">{moves}</span></span>
          <span className="text-slate-400">{fmt(timer)}</span>
        </div>
        {/* XP progress */}
        <div className="mt-2 mx-auto max-w-xs">
          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
            <span>Total XP</span>
            <div className="flex gap-2">
              <span>{formatXp(gameState.totalXP)} XP</span>
              <span className="text-amber-400 font-bold">{formatBix(gameState.totalXP)} BIX</span>
            </div>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full transition-all duration-500"
              style={{ width: `${((gameState.totalXP % 10000) / 10000) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Puzzle Grid */}
      <div className="flex-1 flex flex-col items-center justify-center w-full">
        <div
          className="relative bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700/60 p-3 shadow-2xl"
          style={{ boxShadow: splash ? '0 0 40px 10px rgba(34,211,238,0.2)' : undefined, transition: 'box-shadow 0.5s' }}
        >
          {grid.length > 0 && (
            <div
              style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, ${TILE_SIZE}px)`, gap: 4 }}
            >
              {grid.map((row, r) =>
                row.map((cell, c) => (
                  <PipeTile
                    key={`${r}-${c}`}
                    cell={cell}
                    filled={filled[r]?.[c] ?? false}
                    highlighted={hint?.[0] === r && hint?.[1] === c}
                    onClick={() => handleRotate(r, c)}
                    size={TILE_SIZE}
                  />
                ))
              )}
            </div>
          )}

          {splash && (
            <div className="absolute inset-0 rounded-2xl pointer-events-none flex items-center justify-center z-20">
              <div className="text-5xl animate-bounce">💧</div>
              {submitting && (
                <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center">
                  <span className="text-xs text-cyan-400 animate-pulse">Syncing Rewards...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reward preview */}
        <div className="mt-3 text-center">
          <span className="text-xs text-slate-500">Complete for </span>
          <span className="text-xs font-bold text-yellow-400">+{config.xpReward} XP</span>
          <span className="text-xs font-bold text-amber-400 ml-1">({formatBix(config.xpReward)} BIX)</span>
          {timer < 30 && (
            <span className="text-xs text-emerald-400 ml-1">(+{Math.floor(config.xpReward * 0.5)} time bonus!)</span>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="w-full max-w-lg py-4">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={handleRestart}
            className="flex-1 flex flex-col items-center gap-1 py-3 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600/60 rounded-2xl text-slate-300 hover:text-white transition-all active:scale-95"
          >
            <span className="text-xl">🔄</span>
            <span className="text-xs font-medium">Restart</span>
          </button>
          <button
            onClick={handleHint}
            disabled={hintsLeft <= 0 || phase !== 'playing'}
            className="flex-1 flex flex-col items-center gap-1 py-3 bg-slate-800/80 hover:bg-amber-900/40 border border-slate-600/60 rounded-2xl text-slate-300 hover:text-amber-300 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="text-xl">💡</span>
            <span className="text-xs font-medium">Hint ({hintsLeft})</span>
          </button>
        </div>
      </div>

      {/* Win Modal */}
      {showWin && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 border border-purple-500/40 rounded-3xl p-7 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-90 duration-400"
            style={{ boxShadow: '0 0 60px rgba(139,92,246,0.3)' }}>
            <div className="text-5xl mb-3 animate-bounce">🎉</div>
            <h2 className="text-2xl font-black bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent mb-1">
              Level Complete!
            </h2>
            <p className="text-slate-400 text-sm mb-4">Level {gameState.currentLevel - 1} solved in {moves} moves</p>

            <div className="bg-slate-700/50 rounded-2xl p-4 mb-5 border border-slate-600/40">
              <div className="text-3xl font-black text-yellow-400 mb-1">+{earnedXP} XP</div>
              <div className="text-sm font-bold text-amber-500 mb-1">+{formatBix(earnedXP)} BIX</div>
              <div className="text-xs text-slate-400 mt-2 flex flex-col gap-1">
                <span>Total: {formatXp(gameState.totalXP)} XP</span>
                <span className="text-amber-400/80 font-medium">
                  <BixCounter value={gameState.totalXP / 10000} /> BIX
                </span>
              </div>
              {earnedXP > config.xpReward && (
                <div className="mt-2 text-xs text-emerald-400 font-semibold">⚡ Time Bonus Included!</div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleNextLevel}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold rounded-2xl transition-all active:scale-95 text-sm shadow-lg"
              >
                Next Level →
              </button>
              <button
                onClick={handleRestart}
                className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-2xl transition-all active:scale-95 text-sm border border-slate-600"
              >
                Play Again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlumberPuzzleGame;
