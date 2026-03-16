export type Direction = 'N' | 'E' | 'S' | 'W';
export type PipeType = 'straight' | 'elbow' | 'tee' | 'cross' | 'source' | 'sink' | 'dead-end';

export interface PipeCell {
  type: PipeType;
  rotation: number;
  connections: Direction[];
  isSource?: boolean;
  isSink?: boolean;
  filled?: boolean;
  isLocked?: boolean;
}

export interface GridCell {
  pipe: PipeCell | null;
}

export type Grid = GridCell[][];

export const OPPOSITE: Record<Direction, Direction> = { N: 'S', S: 'N', E: 'W', W: 'E' };
export const DIR_ORDER: Direction[] = ['N', 'E', 'S', 'W'];

export function rotateDir(d: Direction, steps: number): Direction {
  const idx = DIR_ORDER.indexOf(d);
  return DIR_ORDER[((idx + steps) % 4 + 4) % 4];
}

export function getConnections(type: PipeType, rotation: number): Direction[] {
  const base: Record<PipeType, Direction[]> = {
    straight: ['N', 'S'],
    elbow: ['N', 'E'],
    tee: ['N', 'E', 'S'],
    cross: ['N', 'E', 'S', 'W'],
    'dead-end': ['N'],
    source: ['S'],
    sink: ['N'],
  };
  const steps = ((rotation % 4) + 4) % 4;
  return base[type].map(d => rotateDir(d, steps));
}

export function makePipe(type: PipeType, rotation = 0, extra: Partial<PipeCell> = {}): PipeCell {
  return {
    type,
    rotation,
    connections: getConnections(type, rotation),
    filled: false,
    ...extra,
  };
}

export function rotatePipe(pipe: PipeCell): PipeCell {
  const newRotation = (pipe.rotation + 1) % 4;
  return { ...pipe, rotation: newRotation, connections: getConnections(pipe.type, newRotation) };
}

export function getNeighbor(r: number, c: number, dir: Direction): [number, number] {
  if (dir === 'N') return [r - 1, c];
  if (dir === 'S') return [r + 1, c];
  if (dir === 'E') return [r, c + 1];
  return [r, c - 1];
}

export function autoSolve(grid: Grid, rows: number, cols: number): Grid {
  const solved: Grid = grid.map(row =>
    row.map(cell => ({ pipe: cell.pipe ? { ...cell.pipe } : null }))
  );

  const visited: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  const queue: [number, number][] = [];

  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (solved[r][c]?.pipe?.isSource) { visited[r][c] = true; queue.push([r, c]); }

  let iterations = 0;
  while (queue.length && iterations < rows * cols * 4) {
    iterations++;
    const [r, c] = queue.shift()!;
    const pipe = solved[r][c]?.pipe;
    if (!pipe) continue;

    for (const dir of pipe.connections) {
      const [nr, nc] = getNeighbor(r, c, dir);
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || visited[nr][nc]) continue;
      const nb = solved[nr][nc]?.pipe;
      if (!nb) continue;

      const needed = OPPOSITE[dir];
      if (!nb.connections.includes(needed)) {
        if (nb.isSource || nb.isSink) continue;
        for (let rot = 0; rot < 4; rot++) {
          const conns = getConnections(nb.type, rot);
          if (conns.includes(needed)) {
            solved[nr][nc] = { pipe: { ...nb, rotation: rot, connections: conns } };
            break;
          }
        }
      }

      visited[nr][nc] = true;
      queue.push([nr, nc]);
    }
  }

  return solved;
}

export function computeFlow(grid: Grid, rows: number, cols: number): boolean[][] {
  const filled = Array.from({ length: rows }, () => Array(cols).fill(false));
  const queue: [number, number][] = [];

  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (grid[r][c]?.pipe?.isSource) { filled[r][c] = true; queue.push([r, c]); }

  while (queue.length) {
    const [r, c] = queue.shift()!;
    const pipe = grid[r][c]?.pipe;
    if (!pipe) continue;
    for (const dir of pipe.connections) {
      const [nr, nc] = getNeighbor(r, c, dir);
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || filled[nr][nc]) continue;
      const nb = grid[nr][nc]?.pipe;
      if (nb?.connections.includes(OPPOSITE[dir])) { filled[nr][nc] = true; queue.push([nr, nc]); }
    }
  }
  return filled;
}

export function checkWin(grid: Grid, filled: boolean[][], rows: number, cols: number): boolean {
  let hasSink = false;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (grid[r][c]?.pipe && !filled[r][c]) return false;
      if (grid[r][c]?.pipe?.isSink) { hasSink = true; if (!filled[r][c]) return false; }
    }
  return hasSink;
}
