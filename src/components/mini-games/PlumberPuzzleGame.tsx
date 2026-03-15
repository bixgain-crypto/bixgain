import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DragonMascot from '@/components/DragonMascot';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Lock, Play, RotateCcw, Trophy, Clock, Zap } from 'lucide-react';

interface Pipe {
  type: string;
  rotation: number;
  connected: boolean;
  locked: boolean;
  flowPhase?: number;
}

interface GameState {
  grid: Pipe[][];
  startPos: { x: number; y: number };
  endPos: { x: number; y: number };
  solved: boolean;
  moves: number;
  timeElapsed: number;
  level: number;
  gridSize: number;
  flowPath: { x: number; y: number }[] | null;
  flowProgress: number;
}

const PIPE_TYPES = {
  straight: 'straight',
  corner: 'corner',
  cross: 'cross',
  t: 't',
  valve: 'valve',
  pump: 'pump',
  leak: 'leak',
  locked: 'locked'
};

const PIPE_CONNECTIONS = {
  straight: [[false, true, false, true], [true, false, true, false]], // 0: horizontal, 1: vertical
  corner: [[true, false, false, true], [false, true, true, false], [false, true, false, true], [true, false, true, false]], // 0: NE, 1: NW, 2: SW, 3: SE
  cross: [[true, true, true, true], [true, true, true, true], [true, true, true, true], [true, true, true, true]],
  t: [[true, true, false, true], [true, false, true, true], [false, true, true, true], [true, true, true, false]], // 0: N, 1: W, 2: S, 3: E
  valve: [[false, false, false, false], [true, true, true, true]], // 0: closed, 1: open
  pump: [[true, true, true, true], [true, true, true, true], [true, true, true, true], [true, true, true, true]], // always connected
  leak: [[true, true, true, true], [true, true, true, true], [true, true, true, true], [true, true, true, true]], // connected but leaks
  locked: [[true, true, true, true], [true, true, true, true], [true, true, true, true], [true, true, true, true]] // connected
};

export function PlumberPuzzleGame() {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameMode, setGameMode] = useState<'classic' | 'timeAttack' | 'daily'>('classic');
  const [timeLimit, setTimeLimit] = useState(300); // 5 minutes
  const [timer, setTimer] = useState(0);
  const [score, setScore] = useState(0);
  const [userLevel, setUserLevel] = useState(0);
  const [flowAnimating, setFlowAnimating] = useState(false);
  const animationRef = useRef<number | null>(null);

  const CELL_SIZE = 50;
  const GRID_PADDING = 20;

  useEffect(() => {
    if (user?.current_level) {
      setUserLevel(user.current_level);
    }
  }, [user]);

  const generateLevel = useCallback((level: number, gridSize: number): GameState => {
    const grid: Pipe[][] = [];
    for (let y = 0; y < gridSize; y++) {
      grid[y] = [];
      for (let x = 0; x < gridSize; x++) {
        grid[y][x] = {
          type: 'straight',
          rotation: Math.floor(Math.random() * 4),
          connected: false,
          locked: false
        };
      }
    }

    // Generate solved path
    const path = generateSolvedPath(gridSize);
    for (const pos of path) {
      grid[pos.y][pos.x].type = getRandomPipeType(level);
      grid[pos.y][pos.x].rotation = 0; // Will be randomized later
    }

    // Set start and end
    const startPos = path[0];
    const endPos = path[path.length - 1];
    grid[startPos.y][startPos.x].type = 'pump';
    grid[endPos.y][endPos.x].type = 'pump';

    // Randomize rotations
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        if (grid[y][x].type !== 'pump') {
          grid[y][x].rotation = Math.floor(Math.random() * 4);
        }
      }
    }

    // Add locked pipes for higher levels
    if (level > 5) {
      const lockedCount = Math.min(Math.floor(level / 2), gridSize * gridSize * 0.1);
      for (let i = 0; i < lockedCount; i++) {
        const x = Math.floor(Math.random() * gridSize);
        const y = Math.floor(Math.random() * gridSize);
        if (grid[y][x].type !== 'pump') {
          grid[y][x].locked = true;
          grid[y][x].type = 'locked';
        }
      }
    }

    return {
      grid,
      startPos,
      endPos,
      solved: false,
      moves: 0,
      timeElapsed: 0,
      level,
      gridSize,
      flowPath: null,
      flowProgress: 0
    };
  }, []);

  const generateSolvedPath = (gridSize: number): { x: number; y: number }[] => {
    const path = [];
    let x = 0;
    let y = Math.floor(Math.random() * gridSize);
    path.push({ x, y });

    while (x < gridSize - 1) {
      const direction = Math.random() > 0.5 ? 1 : (y > 0 && y < gridSize - 1 ? (Math.random() > 0.5 ? -1 : 1) : 1);
      if (direction === -1 && y > 0) y--;
      else if (direction === 1 && y < gridSize - 1) y++;
      x++;
      path.push({ x, y });
    }

    return path;
  };

  const getRandomPipeType = (level: number): string => {
    const types = ['straight', 'corner'];
    if (level > 2) types.push('t');
    if (level > 4) types.push('cross');
    if (level > 6) types.push('valve');
    if (level > 8) types.push('pump');
    if (level > 10) types.push('leak');
    return types[Math.floor(Math.random() * types.length)];
  };

  const findConnectedPath = (grid: Pipe[][], startPos: { x: number; y: number }, endPos: { x: number; y: number }): { x: number; y: number }[] | null => {
    const visited = new Set<string>();
    const parent = new Map<string, { x: number; y: number }>();
    const queue = [startPos];
    visited.add(`${startPos.x},${startPos.y}`);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.x === endPos.x && current.y === endPos.y) {
        const path: { x: number; y: number }[] = [];
        let cur = endPos;
        while (cur.x !== startPos.x || cur.y !== startPos.y) {
          path.push(cur);
          cur = parent.get(`${cur.x},${cur.y}`)!;
        }
        path.push(startPos);
        return path.reverse();
      }

      const pipe = grid[current.y][current.x];
      const pipeDefs = PIPE_CONNECTIONS[pipe.type as keyof typeof PIPE_CONNECTIONS];
      const connections = pipeDefs[pipe.rotation % pipeDefs.length];

      // Check all four directions
      const directions = [
        { dx: 0, dy: -1, dir: 0 }, // North
        { dx: 1, dy: 0, dir: 1 },  // East
        { dx: 0, dy: 1, dir: 2 },  // South
        { dx: -1, dy: 0, dir: 3 }  // West
      ];

      for (let i = 0; i < 4; i++) {
        if (connections[i]) {
          const nx = current.x + directions[i].dx;
          const ny = current.y + directions[i].dy;
          if (nx >= 0 && nx < grid[0].length && ny >= 0 && ny < grid.length) {
            const neighbor = grid[ny][nx];
            const neighborDefs = PIPE_CONNECTIONS[neighbor.type as keyof typeof PIPE_CONNECTIONS];
            const neighborConnections = neighborDefs[neighbor.rotation % neighborDefs.length];
            if (neighborConnections[(i + 2) % 4]) { // Check opposite direction
              const neighborKey = `${nx},${ny}`;
              if (!visited.has(neighborKey)) {
                visited.add(neighborKey);
                parent.set(neighborKey, current);
                queue.push({ x: nx, y: ny });
              }
            }
          }
        }
      }
    }

    return null;
  };

  const createMetallicGradient = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => {
    const gradient = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.12, x, y, r * 1.1);
    gradient.addColorStop(0, '#e8f0ff');
    gradient.addColorStop(0.3, '#adc2df');
    gradient.addColorStop(0.55, '#6d82a1');
    gradient.addColorStop(0.8, '#45566d');
    gradient.addColorStop(1, '#283647');
    return gradient;
  };

  const createRustGradient = (ctx: CanvasRenderingContext2D, r: number) => {
    const gradient = ctx.createLinearGradient(-r, -r, r, r);
    gradient.addColorStop(0, '#7a3f1f');
    gradient.addColorStop(0.45, '#9a5530');
    gradient.addColorStop(0.75, '#c07d44');
    gradient.addColorStop(1, '#6e371c');
    return gradient;
  };

  const drawFlange = (ctx: CanvasRenderingContext2D, dir: number, cellSize: number, connected: boolean) => {
    const flangeSize = cellSize * 0.16;
    const half = cellSize / 2;
    const offsets = [
      { dx: 0, dy: -half },
      { dx: half, dy: 0 },
      { dx: 0, dy: half },
      { dx: -half, dy: 0 }
    ];
    const { dx, dy } = offsets[dir];

    ctx.save();
    ctx.translate(dx, dy);

    ctx.beginPath();
    ctx.arc(0, 0, flangeSize, 0, Math.PI * 2);
    ctx.fillStyle = connected ? '#4f6886' : '#4f5563';
    ctx.fill();

    const boltR = flangeSize * 0.2;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
      const bx = Math.cos(a) * flangeSize * 0.58;
      const by = Math.sin(a) * flangeSize * 0.58;
      ctx.beginPath();
      ctx.arc(bx, by, boltR, 0, Math.PI * 2);
      ctx.fillStyle = '#23262f';
      ctx.fill();
    }

    ctx.restore();
  };

  const drawPipe = (ctx: CanvasRenderingContext2D, x: number, y: number, pipe: Pipe, cellSize: number, gridPadding: number, flowAnim: boolean) => {
    const centerX = x * cellSize + cellSize / 2 + gridPadding;
    const centerY = y * cellSize + cellSize / 2 + gridPadding;
    const radius = cellSize * 0.38;
    const innerR = radius * 0.62;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((pipe.rotation * Math.PI) / 2);

    const useRust = pipe.type === 'leak' || ((x * 13 + y * 7 + pipe.rotation) % 9 === 0 && pipe.type === 'straight');
    const pipeGradient = useRust ? createRustGradient(ctx, radius) : createMetallicGradient(ctx, 0, 0, radius);

    ctx.fillStyle = pipeGradient;
    ctx.fillRect(-radius, -radius * 0.35, radius * 2, radius * 0.7);

    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = cellSize * 0.06;
    ctx.strokeRect(-radius + 3, -radius * 0.35 + 3, radius * 2 - 6, radius * 0.7 - 6);

    ctx.fillStyle = 'rgba(20,28,45,0.8)';
    ctx.fillRect(-innerR, -innerR * 0.32, innerR * 2, innerR * 0.64);

    ctx.strokeStyle = pipe.connected ? '#79c3ff' : '#73839d';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    switch (pipe.type) {
      case 'straight':
        ctx.beginPath();
        ctx.moveTo(-radius, 0);
        ctx.lineTo(radius, 0);
        ctx.stroke();
        break;
      case 'corner':
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI / 2);
        ctx.stroke();
        break;
      case 'cross':
        ctx.beginPath();
        ctx.moveTo(-radius, 0);
        ctx.lineTo(radius, 0);
        ctx.moveTo(0, -radius);
        ctx.lineTo(0, radius);
        ctx.stroke();
        break;
      case 't':
        ctx.beginPath();
        ctx.moveTo(-radius, 0);
        ctx.lineTo(radius, 0);
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -radius);
        ctx.stroke();
        break;
      case 'valve':
        ctx.strokeStyle = pipe.rotation === 0 ? '#dc4444' : '#37a46b';
        ctx.lineWidth = cellSize * 0.1;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.75, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.fillStyle = '#23262f';
        ctx.fillRect(-radius * 0.12, -radius * 1.04, radius * 0.24, radius * 0.42);
        break;
      case 'pump':
        ctx.strokeStyle = '#3f8bff';
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.72, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.fillStyle = 'rgba(63,139,255,0.75)';
        ctx.fill();
        break;
      case 'leak':
        ctx.strokeStyle = '#f08b3b';
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.7, 0, 2 * Math.PI);
        ctx.stroke();
        break;
      case 'locked':
        ctx.strokeStyle = 'hsl(0, 72%, 51%)'; // red-600
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(-radius, -radius);
        ctx.lineTo(radius, radius);
        ctx.moveTo(radius, -radius);
        ctx.lineTo(-radius, radius);
        ctx.stroke();
        break;
    }

    const defs = PIPE_CONNECTIONS[pipe.type as keyof typeof PIPE_CONNECTIONS];
    const connections = defs[pipe.rotation % defs.length];
    connections.forEach((isOpen, dir) => {
      if (isOpen) {
        drawFlange(ctx, dir, cellSize, pipe.connected);
      }
    });

    if (flowAnim && pipe.connected && pipe.flowPhase !== undefined) {
      const phase = pipe.flowPhase;
      ctx.strokeStyle = `rgba(105,190,255,${0.35 + Math.sin(phase * Math.PI * 4) * 0.28})`;
      ctx.shadowColor = 'rgba(105,190,255,0.55)';
      ctx.shadowBlur = 10;
      ctx.lineWidth = innerR * 0.7;
      ctx.setLineDash([cellSize * 0.38, cellSize * 0.58]);
      ctx.lineDashOffset = -phase * cellSize * 2;
      ctx.beginPath();
      connections.forEach((isOpen, dir) => {
        if (!isOpen) return;
        const target = [
          { x: 0, y: -radius },
          { x: radius, y: 0 },
          { x: 0, y: radius },
          { x: -radius, y: 0 }
        ][dir];
        ctx.moveTo(0, 0);
        ctx.lineTo(target.x, target.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  };

  const drawGrid = useCallback(() => {
    if (!gameState || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw industrial cavern background
    const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bg.addColorStop(0, '#0f172a');
    bg.addColorStop(1, '#020617');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetX = 8;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = 'rgba(30,40,60,0.4)';
    ctx.fillRect(GRID_PADDING - 10, GRID_PADDING - 10, gameState.gridSize * CELL_SIZE + 20, gameState.gridSize * CELL_SIZE + 20);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Draw grid lines with theme colors
    ctx.strokeStyle = 'rgba(120,140,180,0.16)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= gameState.gridSize; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE + GRID_PADDING, GRID_PADDING);
      ctx.lineTo(i * CELL_SIZE + GRID_PADDING, gameState.gridSize * CELL_SIZE + GRID_PADDING);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(GRID_PADDING, i * CELL_SIZE + GRID_PADDING);
      ctx.lineTo(gameState.gridSize * CELL_SIZE + GRID_PADDING, i * CELL_SIZE + GRID_PADDING);
      ctx.stroke();
    }

    // Draw pipes
    for (let y = 0; y < gameState.gridSize; y++) {
      for (let x = 0; x < gameState.gridSize; x++) {
        const pipe = gameState.grid[y][x];
        const isFlowing = gameState.flowPath?.some((pos) => pos.x === x && pos.y === y) ?? false;
        drawPipe(ctx, x, y, pipe, CELL_SIZE, GRID_PADDING, isFlowing);
      }
    }

    // Highlight start and end lava gates
    ctx.fillStyle = 'hsla(28, 96%, 58%, 0.18)';
    ctx.fillRect(
      gameState.startPos.x * CELL_SIZE + GRID_PADDING,
      gameState.startPos.y * CELL_SIZE + GRID_PADDING,
      CELL_SIZE,
      CELL_SIZE
    );
    ctx.fillRect(
      gameState.endPos.x * CELL_SIZE + GRID_PADDING,
      gameState.endPos.y * CELL_SIZE + GRID_PADDING,
      CELL_SIZE,
      CELL_SIZE
    );
  }, [gameState]);

  useEffect(() => {
    drawGrid();
  }, [drawGrid]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!gameState || gameState.solved) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - GRID_PADDING;
    const y = event.clientY - rect.top - GRID_PADDING;

    const gridX = Math.floor(x / CELL_SIZE);
    const gridY = Math.floor(y / CELL_SIZE);

    if (gridX >= 0 && gridX < gameState.gridSize && gridY >= 0 && gridY < gameState.gridSize) {
      const pipe = gameState.grid[gridY][gridX];
      if (!pipe.locked) {
        const defs = PIPE_CONNECTIONS[pipe.type as keyof typeof PIPE_CONNECTIONS];
        pipe.rotation = (pipe.rotation + 1) % defs.length;
        setGameState(prev => prev ? {
          ...prev,
          moves: prev.moves + 1,
          solved: false,
          flowPath: null,
          flowProgress: 0,
          grid: prev.grid.map((row) => row.map((currentPipe) => ({ ...currentPipe, connected: false, flowPhase: 0 })))
        } : null);
      }
    }
  };

  const checkSolution = useCallback(() => {
    if (!gameState) return;

    const path = findConnectedPath(gameState.grid, gameState.startPos, gameState.endPos);
    if (path && !gameState.solved) {
      setGameState(prev => prev ? {
        ...prev,
        solved: true,
        flowPath: path,
        flowProgress: 0,
        grid: prev.grid.map((row) => row.map((pipe) => ({ ...pipe, connected: false, flowPhase: 0 })))
      } : null);
      setFlowAnimating(true);
      const finalScore = calculateScore(gameState.moves, gameState.timeElapsed, gameState.level);
      setScore(finalScore);
      const rewardXp = Math.max(30, Math.round(finalScore / 12));
      const rewardBix = rewardXp / 10000;
      toast.success(`Treasure unlocked! Score: ${finalScore} • +${rewardXp} XP • +${rewardBix.toFixed(4)} BIX`);

      // Send to backend
      submitGameResult(gameState.level, gameState.moves, gameState.timeElapsed, true);
    }
  }, [gameState]);

  useEffect(() => {
    if (!flowAnimating || !gameState?.flowPath) return;

    const startedAt = performance.now();
    const duration = 1800;

    const animate = (time: number) => {
      const progress = Math.min((time - startedAt) / duration, 1);
      setGameState((prev) => {
        if (!prev?.flowPath) return prev;
        const pathLength = prev.flowPath.length;
        const grid = prev.grid.map((row) => row.map((pipe) => ({ ...pipe, connected: false, flowPhase: 0 })));
        prev.flowPath.forEach((pos, idx) => {
          const segmentProgress = Math.max(0, Math.min(1, (progress - idx / pathLength) * pathLength));
          grid[pos.y][pos.x].flowPhase = segmentProgress;
          grid[pos.y][pos.x].connected = segmentProgress > 0;
        });
        return {
          ...prev,
          flowProgress: progress,
          grid
        };
      });

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setFlowAnimating(false);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [flowAnimating, gameState?.flowPath]);

  useEffect(() => {
    if (gameState && !gameState.solved) {
      checkSolution();
    }
  }, [gameState, checkSolution]);

  const calculateScore = (moves: number, time: number, level: number): number => {
    const basePoints = level * 100;
    const timeBonus = Math.max(0, 300 - time) * 10;
    const movePenalty = moves * 5;
    return basePoints + timeBonus - movePenalty;
  };

  const submitGameResult = async (level: number, moves: number, time: number, completed: boolean) => {
    if (!user?.id) return;

    try {
      await supabase.from('plumber_puzzle_sessions').insert({
        user_id: user.id,
        level,
        grid_size: gameState?.gridSize ?? 6,
        moves,
        time_elapsed: time,
        completed,
        score: calculateScore(moves, time, level)
      });
    } catch (error) {
      console.error('Failed to submit game result:', error);
    }
  };

  const startGame = (level: number) => {
    const gridSize = level <= 3 ? 6 : level <= 6 ? 8 : 10;
    const newGameState = generateLevel(level, gridSize);
    setGameState(newGameState);
    setIsPlaying(true);
    setTimer(0);
    setScore(0);
    setFlowAnimating(false);
  };

  const resetGame = () => {
    setGameState(null);
    setIsPlaying(false);
    setTimer(0);
    setScore(0);
  };

  useEffect(() => {
    let interval: number;
    if (isPlaying && !gameState?.solved) {
      interval = window.setInterval(() => {
        setTimer(prev => prev + 1);
        setGameState(prev => prev ? { ...prev, timeElapsed: prev.timeElapsed + 1 } : null);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, gameState?.solved]);

  if (userLevel < 3) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="glass rounded-2xl p-8 text-center max-w-md w-full">
          <Lock className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Level 3 Required</h2>
          <p className="text-muted-foreground mb-4">
            Reach Level 3 to unlock the Plumber Puzzle game!
          </p>
          <Badge variant="outline">Current Level: {userLevel}</Badge>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-6 w-6 text-primary" />
          <h3 className="text-xl font-semibold">Dragon Treasure Puzzle</h3>
          <DragonMascot mood="idle" size="sm" className="ml-auto" title="Puzzle Dragon" />
        </div>

        {!isPlaying ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button onClick={() => startGame(1)} className="h-20 bg-secondary/35 hover:bg-secondary/50 border border-border/60">
                <div className="text-center">
                  <Play className="h-8 w-8 mx-auto mb-2" />
                  <div>Level 1</div>
                  <div className="text-sm opacity-75">6x6 Grid</div>
                </div>
              </Button>
              <Button onClick={() => startGame(5)} variant="outline" className="h-20 border-border/60 hover:bg-secondary/35">
                <div className="text-center">
                  <Play className="h-8 w-8 mx-auto mb-2" />
                  <div>Level 5</div>
                  <div className="text-sm opacity-75">8x8 Grid</div>
                </div>
              </Button>
              <Button onClick={() => startGame(10)} variant="outline" className="h-20 border-border/60 hover:bg-secondary/35">
                <div className="text-center">
                  <Play className="h-8 w-8 mx-auto mb-2" />
                  <div>Level 10</div>
                  <div className="text-sm opacity-75">10x10 Grid</div>
                </div>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex gap-4">
                <div className="rounded-lg border border-border/60 bg-secondary/35 px-3 py-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Time</p>
                  <p className="text-sm font-mono">{Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-secondary/35 px-3 py-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Moves</p>
                  <p className="text-sm font-mono">{gameState?.moves || 0}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-secondary/35 px-3 py-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Level</p>
                  <p className="text-sm font-mono">{gameState?.level || 0}</p>
                </div>
              </div>
              <Button onClick={resetGame} variant="outline" className="border-border/60 hover:bg-secondary/35">
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>

            <div className="flex justify-center">
              <canvas
                ref={canvasRef}
                width={gameState ? gameState.gridSize * CELL_SIZE + GRID_PADDING * 2 : 400}
                height={gameState ? gameState.gridSize * CELL_SIZE + GRID_PADDING * 2 : 400}
                onClick={handleCanvasClick}
                className="glass rounded-xl cursor-pointer border-0"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            </div>

            {gameState?.solved && (
              <div className="text-center space-y-4 p-6 rounded-xl border border-primary/30 bg-primary/10">
                <h3 className="text-2xl font-bold text-primary">Puzzle Solved!</h3>
                <p className="text-lg">Score: <span className="text-gradient-gold font-bold">{score}</span></p>
                <p className="text-sm text-muted-foreground">Treasure reward unlocked: XP + BIX.</p>
                <Button onClick={() => startGame((gameState.level || 1) + 1)} className="bg-gradient-gold text-primary-foreground font-semibold">
                  Next Level
                </Button>
              </div>
            )}

            <div className="text-sm text-muted-foreground text-center">
              Rotate lava tunnels to guide flow from dragon gate to treasure gate.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
