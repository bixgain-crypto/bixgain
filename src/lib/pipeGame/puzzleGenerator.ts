import {
  type Grid, type GridCell, type Direction, type PipeType,
  makePipe, getConnections, getNeighbor, OPPOSITE, DIR_ORDER,
} from './pipeTypes';

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface LevelConfig {
  rows: number;
  cols: number;
  levelNumber: number;
  difficulty: 'easy' | 'medium' | 'hard';
  xpReward: number;
}

export function getLevelConfig(levelNumber: number): LevelConfig {
  if (levelNumber <= 10) return { rows: 4, cols: 4, levelNumber, difficulty: 'easy', xpReward: 10 };
  if (levelNumber <= 30) return { rows: 5, cols: 5, levelNumber, difficulty: 'medium', xpReward: 25 };
  if (levelNumber <= 60) return { rows: 6, cols: 6, levelNumber, difficulty: 'hard', xpReward: 50 };
  return { rows: 7, cols: 7, levelNumber, difficulty: 'hard', xpReward: 75 };
}

export function generateLevel(config: LevelConfig): Grid {
  const { rows, cols } = config;
  const grid: Grid = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ pipe: null }))
  );

  // Generate a random path from source to sink using DFS
  const path = generatePath(rows, cols);
  if (!path || path.length < 2) return generateLevel(config);

  // Place source at path[0]
  const [sr, sc] = path[0];
  const [er, ec] = path[path.length - 1];

  // For each segment in the path, figure out what pipe type to place
  for (let i = 0; i < path.length; i++) {
    const [r, c] = path[i];
    const prevDir: Direction | null = i > 0 ? getDirectionBetween(path[i - 1], path[i]) : null;
    const nextDir: Direction | null = i < path.length - 1 ? getDirectionBetween(path[i], path[i + 1]) : null;

    let type: PipeType;
    let targetConnections: Direction[];

    if (i === 0) {
      type = 'source';
      targetConnections = [nextDir!];
    } else if (i === path.length - 1) {
      type = 'sink';
      targetConnections = [OPPOSITE[prevDir!]];
    } else {
      const incoming = OPPOSITE[prevDir!];
      const outgoing = nextDir!;
      targetConnections = [incoming, outgoing];

      if (incoming === OPPOSITE[outgoing]) {
        type = 'straight';
      } else {
        type = 'elbow';
      }

      // Occasionally add extra connections for tee/cross
      const extraChance = config.difficulty === 'easy' ? 0 : config.difficulty === 'medium' ? 0.1 : 0.2;
      if (Math.random() < extraChance && type === 'elbow') {
        type = 'tee';
        const extras = DIR_ORDER.filter(d => !targetConnections.includes(d));
        targetConnections.push(extras[Math.floor(Math.random() * extras.length)]);
      }
    }

    const rotation = findRotation(type, targetConnections);
    grid[r][c] = {
      pipe: makePipe(type, rotation, {
        isSource: i === 0,
        isSink: i === path.length - 1,
        isLocked: i === 0 || i === path.length - 1,
      }),
    };
  }

  // Fill remaining cells with random pipes (dead-ends or empty)
  const fillChance = config.difficulty === 'easy' ? 0.2 : config.difficulty === 'medium' ? 0.35 : 0.5;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].pipe) continue;
      if (Math.random() < fillChance) {
        const type: PipeType = Math.random() < 0.5 ? 'dead-end' : 'elbow';
        const rotation = Math.floor(Math.random() * 4);
        grid[r][c] = { pipe: makePipe(type, rotation) };
      }
    }
  }

  // Shuffle rotations for non-locked pipes
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      if (cell.pipe && !cell.pipe.isLocked) {
        const rndRot = Math.floor(Math.random() * 4);
        cell.pipe = { ...cell.pipe, rotation: rndRot, connections: getConnections(cell.pipe.type, rndRot) };
      }
    }
  }

  return grid;
}

function generatePath(rows: number, cols: number): [number, number][] {
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  const minLen = Math.floor((rows * cols) * 0.3);

  function dfs(r: number, c: number, path: [number, number][]): [number, number][] | null {
    visited[r][c] = true;
    path.push([r, c]);

    if (path.length >= minLen && Math.random() < 0.3) return path;

    const dirs = shuffleArray(DIR_ORDER);
    for (const d of dirs) {
      const [nr, nc] = getNeighbor(r, c, d);
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc]) {
        const result = dfs(nr, nc, path);
        if (result) return result;
      }
    }

    if (path.length >= minLen) return path;
    path.pop();
    visited[r][c] = false;
    return null;
  }

  const startR = Math.floor(Math.random() * rows);
  const startC = Math.floor(Math.random() * cols);
  return dfs(startR, startC, []) ?? null;
}

function getDirectionBetween(from: [number, number], to: [number, number]): Direction {
  const dr = to[0] - from[0];
  const dc = to[1] - from[1];
  if (dr === -1) return 'N';
  if (dr === 1) return 'S';
  if (dc === 1) return 'E';
  return 'W';
}

function findRotation(type: PipeType, targetConnections: Direction[]): number {
  for (let rot = 0; rot < 4; rot++) {
    const conns = getConnections(type, rot);
    if (conns.length === targetConnections.length && targetConnections.every(d => conns.includes(d))) return rot;
  }
  return 0;
}
