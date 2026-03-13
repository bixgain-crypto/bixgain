import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
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
      gridSize
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

  const checkConnections = (grid: Pipe[][], startPos: { x: number; y: number }, endPos: { x: number; y: number }): boolean => {
    const visited = new Set<string>();
    const queue = [startPos];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = `${current.x},${current.y}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const pipe = grid[current.y][current.x];
      const connections = PIPE_CONNECTIONS[pipe.type as keyof typeof PIPE_CONNECTIONS][pipe.rotation];

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
            const neighborConnections = PIPE_CONNECTIONS[neighbor.type as keyof typeof PIPE_CONNECTIONS][neighbor.rotation];
            if (neighborConnections[(i + 2) % 4]) { // Check opposite direction
              queue.push({ x: nx, y: ny });
            }
          }
        }
      }
    }

    return visited.has(`${endPos.x},${endPos.y}`);
  };

  const drawPipe = (ctx: CanvasRenderingContext2D, x: number, y: number, pipe: Pipe, cellSize: number) => {
    const centerX = x * cellSize + cellSize / 2;
    const centerY = y * cellSize + cellSize / 2;
    const radius = cellSize * 0.3;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((pipe.rotation * Math.PI) / 2);

    ctx.strokeStyle = pipe.connected ? 'hsl(142, 76%, 36%)' : 'hsl(220, 10%, 50%)'; // green-600 for connected, muted for disconnected
    ctx.lineWidth = 4;
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
        ctx.strokeStyle = pipe.rotation === 0 ? 'hsl(0, 72%, 51%)' : 'hsl(142, 76%, 36%)'; // red-600 for closed, green-600 for open
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, 2 * Math.PI);
        ctx.stroke();
        break;
      case 'pump':
        ctx.strokeStyle = 'hsl(217, 91%, 60%)'; // blue-600
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.fillStyle = 'hsl(217, 91%, 60%)';
        ctx.fill();
        break;
      case 'leak':
        ctx.strokeStyle = 'hsl(25, 95%, 53%)'; // orange-600
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, 2 * Math.PI);
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

    ctx.restore();
  };

  const drawGrid = useCallback(() => {
    if (!gameState || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw dark theme background
    ctx.fillStyle = 'hsl(220, 18%, 7%)'; // card background color
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines with theme colors
    ctx.strokeStyle = 'hsl(220, 14%, 14%)'; // border color
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
        drawPipe(ctx, x, y, gameState.grid[y][x], CELL_SIZE);
      }
    }

    // Highlight start and end with theme colors
    ctx.fillStyle = 'hsla(142, 76%, 36%, 0.3)'; // green-600 with opacity
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
        pipe.rotation = (pipe.rotation + 1) % 4;
        setGameState(prev => prev ? { ...prev, moves: prev.moves + 1 } : null);
      }
    }
  };

  const checkSolution = useCallback(() => {
    if (!gameState) return;

    const solved = checkConnections(gameState.grid, gameState.startPos, gameState.endPos);
    if (solved && !gameState.solved) {
      setGameState(prev => prev ? { ...prev, solved: true } : null);
      const finalScore = calculateScore(gameState.moves, gameState.timeElapsed, gameState.level);
      setScore(finalScore);
      toast.success(`Puzzle solved! Score: ${finalScore}`);

      // Send to backend
      submitGameResult(gameState.level, gameState.moves, gameState.timeElapsed, true);
    }
  }, [gameState]);

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
        grid_size: gameState.gridSize,
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
          <h3 className="text-xl font-semibold">Plumber Puzzle Game</h3>
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
                <Button onClick={() => startGame((gameState.level || 1) + 1)} className="bg-gradient-gold text-primary-foreground font-semibold">
                  Next Level
                </Button>
              </div>
            )}

            <div className="text-sm text-muted-foreground text-center">
              Click pipes to rotate them. Connect the green highlighted pipes to complete the puzzle.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}