import { useEffect, useState } from 'react';

type Direction = 'N' | 'S' | 'E' | 'W';

type PipeType = 'straight' | 'corner' | 'tee' | 'cross' | 'source' | 'sink';

interface Pipe {
  type: PipeType;
  rotation: number;
}

interface Cell {
  pipe: Pipe;
  filled?: boolean;
}

const BASE_CONNECTIONS: Record<PipeType, Direction[]> = {
  straight: ['N', 'S'],
  corner: ['N', 'E'],
  tee: ['N', 'E', 'W'],
  cross: ['N', 'E', 'S', 'W'],
  source: ['E'],
  sink: ['W'],
};

const ROTATE_MAP: Record<Direction, Direction> = {
  N: 'E',
  E: 'S',
  S: 'W',
  W: 'N',
};

const opposite: Record<Direction, Direction> = {
  N: 'S',
  S: 'N',
  E: 'W',
  W: 'E',
};

function rotateConnections(directions: Direction[], rotation: number) {
  let result = [...directions];

  for (let i = 0; i < rotation; i++) {
    result = result.map((direction) => ROTATE_MAP[direction]);
  }

  return result;
}

function getConnections(pipe: Pipe) {
  return rotateConnections(BASE_CONNECTIONS[pipe.type], pipe.rotation);
}

function randomPipe(): PipeType {
  const types: PipeType[] = ['straight', 'corner', 'tee'];
  return types[Math.floor(Math.random() * types.length)];
}

function generatePuzzle(size: number): Cell[][] {
  const grid: Cell[][] = [];

  for (let y = 0; y < size; y++) {
    const row: Cell[] = [];

    for (let x = 0; x < size; x++) {
      row.push({
        pipe: {
          type: randomPipe(),
          rotation: Math.floor(Math.random() * 4),
        },
      });
    }

    grid.push(row);
  }

  grid[0][0].pipe = { type: 'source', rotation: 0 };
  grid[size - 1][size - 1].pipe = { type: 'sink', rotation: 0 };

  return grid;
}

function checkPath(grid: Cell[][]) {
  const size = grid.length;
  const visited = new Set<string>();

  function dfs(x: number, y: number): boolean {
    const key = `${x}-${y}`;
    if (visited.has(key)) return false;

    visited.add(key);

    const pipe = grid[y][x].pipe;
    if (pipe.type === 'sink') return true;

    const connections = getConnections(pipe);

    for (const direction of connections) {
      let nx = x;
      let ny = y;

      if (direction === 'N') ny--;
      if (direction === 'S') ny++;
      if (direction === 'E') nx++;
      if (direction === 'W') nx--;

      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;

      const nextPipe = grid[ny][nx].pipe;
      const nextConnections = getConnections(nextPipe);

      if (nextConnections.includes(opposite[direction])) {
        if (dfs(nx, ny)) return true;
      }
    }

    return false;
  }

  return dfs(0, 0);
}

function simulateWater(grid: Cell[][]) {
  const size = grid.length;
  const visited = new Set<string>();
  const filledCells: string[] = [];

  function dfs(x: number, y: number) {
    const key = `${x}-${y}`;
    if (visited.has(key)) return;

    visited.add(key);
    filledCells.push(key);

    const pipe = grid[y][x].pipe;
    const connections = getConnections(pipe);

    for (const direction of connections) {
      let nx = x;
      let ny = y;

      if (direction === 'N') ny--;
      if (direction === 'S') ny++;
      if (direction === 'E') nx++;
      if (direction === 'W') nx--;

      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;

      const nextPipe = grid[ny][nx].pipe;
      const nextConnections = getConnections(nextPipe);

      if (nextConnections.includes(opposite[direction])) {
        dfs(nx, ny);
      }
    }
  }

  dfs(0, 0);

  return filledCells;
}

function PipeTile({ cell, rotate }: { cell: Cell; rotate: () => void }) {
  const { pipe, filled } = cell;
  const isFixed = pipe.type === 'source' || pipe.type === 'sink';

  return (
    <div
      onClick={!isFixed ? rotate : undefined}
      style={{
        transform: `rotate(${pipe.rotation * 90}deg)`,
        background: filled ? '#38bdf8' : '#334155',
      }}
      className="flex h-14 w-14 select-none items-center justify-center border text-white"
    >
      {pipe.type[0].toUpperCase()}
    </div>
  );
}

export function PlumberPuzzleGame() {
  const size = 6;
  const [grid, setGrid] = useState<Cell[][]>(() => generatePuzzle(size));
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const [won, setWon] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime((current) => current + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  function rotatePipe(x: number, y: number) {
    if (won) return;

    const newGrid = grid.map((row) => row.map((cell) => ({ ...cell, pipe: { ...cell.pipe }, filled: false })));
    const pipe = newGrid[y][x].pipe;

    if (pipe.type === 'source' || pipe.type === 'sink') return;

    pipe.rotation = (pipe.rotation + 1) % 4;
    setMoves((current) => current + 1);
    setGrid(newGrid);
  }

  function startWater() {
    if (!checkPath(grid)) return;

    const cells = simulateWater(grid);
    const newGrid = grid.map((row) => row.map((cell) => ({ ...cell })));

    cells.forEach((key, index) => {
      setTimeout(() => {
        const [x, y] = key.split('-').map(Number);
        newGrid[y][x].filled = true;
        setGrid(newGrid.map((row) => [...row]));
      }, index * 120);
    });

    setTimeout(() => {
      setWon(true);
    }, cells.length * 120);
  }

  function reset() {
    setGrid(generatePuzzle(size));
    setMoves(0);
    setTime(0);
    setWon(false);
  }

  return (
    <div className="p-4 text-center text-white">
      <h1 className="mb-2 text-2xl">Pipe Puzzle</h1>

      <div className="mb-3">
        Moves: {moves} | Time: {time}s
      </div>

      {won && <div className="mb-3 text-green-400">Level Complete!</div>}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${size},56px)`,
          gap: 4,
          justifyContent: 'center',
        }}
      >
        {grid.map((row, y) =>
          row.map((cell, x) => <PipeTile key={`${x}-${y}`} cell={cell} rotate={() => rotatePipe(x, y)} />),
        )}
      </div>

      <div className="mt-4 flex justify-center gap-3">
        <button onClick={startWater} className="rounded bg-blue-600 px-4 py-2">
          Start Water
        </button>

        <button onClick={reset} className="rounded bg-red-600 px-4 py-2">
          New Puzzle
        </button>
      </div>
    </div>
  );
}
