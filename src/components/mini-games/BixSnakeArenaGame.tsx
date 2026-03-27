import { formatBix } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import DragonMascot from "@/components/DragonMascot";
import { cn } from "@/lib/utils";
import { Gauge, Trophy, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Vec2 = { x: number; y: number };
type BotDifficulty = "easy" | "medium" | "hard";
type FoodKind = "normal" | "golden" | "mega";

type Snake = {
  id: string;
  name: string;
  color: string;
  isBot: boolean;
  difficulty: BotDifficulty;
  segments: Vec2[];
  dir: number;
  targetDir: number;
  baseSpeed: number;
  turnRate: number;
  growth: number;
  xp: number;
  rawScoreUnits: number;
  longestLength: number;
  alive: boolean;
  boostHold: boolean;
  boostDrainTimer: number;
  aiThinkIn: number;
  boostTimer: number;
};

type Food = {
  id: number;
  x: number;
  y: number;
  kind: FoodKind;
  xp: number;
  radius: number;
  color: string;
  glow: string;
  growth: number;
};

type ArenaState = {
  snakes: Snake[];
  foods: Food[];
  nextFoodId: number;
  nextSnakeId: number;
  playerId: string;
  startedAt: number;
  lastTimestamp: number;
  keyboardBoost: boolean;
  touchBoost: boolean;
  swipeStart: Vec2 | null;
  botSpawnTimer: number;
  rafHandle: number;
  gameFinished: boolean;
  gameFinishedSent: boolean;
  fireBursts: Array<{ x: number; y: number; ttl: number; strength: number }>;
  playerCoinStreak: number;
  playerRageTimer: number;
};

type ArenaLeaderboardRow = {
  id: string;
  name: string;
  xp: number;
  isPlayer: boolean;
  isBot: boolean;
};

type ArenaHud = {
  xp: number;
  bix: number;
  length: number;
  longestLength: number;
  boosting: boolean;
  rageMode: boolean;
  streak: number;
  leaderboard: ArenaLeaderboardRow[];
};

export type BixSnakeArenaFinishResult = {
  rawScore: number;
  xp: number;
  bix: number;
  longestLength: number;
  durationSeconds: number;
};

type BixSnakeArenaGameProps = {
  onFinish: (result: BixSnakeArenaFinishResult) => void;
  playerName?: string;
  className?: string;
};

const ARENA_WIDTH = 2800;
const ARENA_HEIGHT = 2800;
const ARENA_PADDING = 28;
const SEGMENT_SPACING = 10;
const BODY_RADIUS = 6;
const HEAD_RADIUS = 8;
const PLAYER_START_SEGMENTS = 12;
const BOT_START_SEGMENTS_MIN = 9;
const BOT_START_SEGMENTS_MAX = 17;
const MIN_SEGMENTS_FOR_BOOST = 10;
const PLAYER_BASE_SPEED = 132;
const BOOST_MULTIPLIER = 1.78;
const BOOST_MASS_DRAIN_SECONDS = 0.2;
const FOOD_TARGET = 300;
const FOOD_LIMIT = 430;
const MIN_TOTAL_SNAKES = 10;
const MAX_TOTAL_SNAKES = 20;
const INITIAL_BOT_MIN = 8;
const INITIAL_BOT_MAX = 15;
const HUD_SYNC_MS = 120;
const RAGE_STREAK_THRESHOLD = 10;
const RAGE_DURATION_SECONDS = 6;
const WING_UNLOCK_LENGTH = 36;
const RAGE_SPEED_MULTIPLIER = 1.22;

const BOT_NAMES = [
  "NeonByte",
  "ShadowTail",
  "CryptoSlither",
  "PixelViper",
  "QuantumSnake",
  "NovaHunter",
  "OrbitStrike",
  "DarkByte",
  "LumenFang",
  "ZeroTrace",
  "VoltRider",
  "SkyCipher",
  "IronScale",
  "RapidHex",
  "BlazeCircuit",
  "PulseDrift",
  "HyperFang",
  "NightVector",
];

const FOOD_CONFIG: Record<
  FoodKind,
  { xp: number; radius: number; color: string; glow: string; growth: number }
> = {
  normal: { xp: 10, radius: 4, color: "#f59e0b", glow: "rgba(245,158,11,0.62)", growth: 1 },
  golden: { xp: 50, radius: 6, color: "#fcd34d", glow: "rgba(252,211,77,0.76)", growth: 3 },
  mega: { xp: 100, radius: 7, color: "#fb923c", glow: "rgba(251,146,60,0.82)", growth: 5 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomInRange(min, max + 1));
}

function toRadians(direction: "up" | "down" | "left" | "right"): number {
  if (direction === "up") return -Math.PI / 2;
  if (direction === "down") return Math.PI / 2;
  if (direction === "left") return Math.PI;
  return 0;
}

function vectorFromAngle(angle: number): Vec2 {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function distanceSquared(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function normalizeAngle(angle: number): number {
  let normalized = angle;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
}

function rotateTowards(current: number, target: number, maxDelta: number): number {
  const diff = normalizeAngle(target - current);
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}

function weightedFoodKind(): FoodKind {
  const roll = Math.random();
  if (roll < 0.83) return "normal";
  if (roll < 0.97) return "golden";
  return "mega";
}

function computeLeaderboard(state: ArenaState): ArenaLeaderboardRow[] {
  return state.snakes
    .filter((snake) => snake.alive)
    .map((snake) => ({
      id: snake.id,
      name: snake.name,
      xp: snake.xp,
      isPlayer: snake.id === state.playerId,
      isBot: snake.isBot,
    }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 5);
}

function pickBotName(usedNames: Set<string>): string {
  const pool = BOT_NAMES.filter((name) => !usedNames.has(name));
  if (pool.length === 0) return BOT_NAMES[randomInt(0, BOT_NAMES.length - 1)];
  return pool[randomInt(0, pool.length - 1)];
}

function createSegments(start: Vec2, count: number, direction: number): Vec2[] {
  const backward = vectorFromAngle(direction + Math.PI);
  return Array.from({ length: count }).map((_, index) => ({
    x: start.x + backward.x * SEGMENT_SPACING * index,
    y: start.y + backward.y * SEGMENT_SPACING * index,
  }));
}

function randomSpawnPoint(snakes: Snake[]): Vec2 {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const point = {
      x: randomInRange(ARENA_PADDING + 180, ARENA_WIDTH - ARENA_PADDING - 180),
      y: randomInRange(ARENA_PADDING + 180, ARENA_HEIGHT - ARENA_PADDING - 180),
    };
    const tooClose = snakes.some((snake) => distanceSquared(point, snake.segments[0]) < 220 * 220);
    if (!tooClose) return point;
  }
  return {
    x: randomInRange(ARENA_PADDING + 80, ARENA_WIDTH - ARENA_PADDING - 80),
    y: randomInRange(ARENA_PADDING + 80, ARENA_HEIGHT - ARENA_PADDING - 80),
  };
}

function spawnFoodAt(state: ArenaState, x: number, y: number, kind: FoodKind) {
  if (state.foods.length >= FOOD_LIMIT) return;
  const config = FOOD_CONFIG[kind];
  const clampedX = clamp(x, ARENA_PADDING, ARENA_WIDTH - ARENA_PADDING);
  const clampedY = clamp(y, ARENA_PADDING, ARENA_HEIGHT - ARENA_PADDING);
  state.foods.push({
    id: state.nextFoodId,
    x: clampedX,
    y: clampedY,
    kind,
    xp: config.xp,
    radius: config.radius,
    color: config.color,
    glow: config.glow,
    growth: config.growth,
  });
  state.nextFoodId += 1;
}

function spawnRandomFood(state: ArenaState, count: number) {
  for (let i = 0; i < count; i += 1) {
    const kind = weightedFoodKind();
    spawnFoodAt(
      state,
      randomInRange(ARENA_PADDING, ARENA_WIDTH - ARENA_PADDING),
      randomInRange(ARENA_PADDING, ARENA_HEIGHT - ARENA_PADDING),
      kind,
    );
  }
}

function createPlayerSnake(playerName: string): Snake {
  const spawn = { x: ARENA_WIDTH * 0.5, y: ARENA_HEIGHT * 0.5 };
  return {
    id: "player",
    name: playerName.trim().length > 0 ? playerName.trim().slice(0, 18) : "Player",
    color: "hsl(45, 96%, 61%)",
    isBot: false,
    difficulty: "hard",
    segments: createSegments(spawn, PLAYER_START_SEGMENTS, 0),
    dir: 0,
    targetDir: 0,
    baseSpeed: PLAYER_BASE_SPEED,
    turnRate: 8.8,
    growth: 0,
    xp: 0,
    rawScoreUnits: 0,
    longestLength: PLAYER_START_SEGMENTS,
    alive: true,
    boostHold: false,
    boostDrainTimer: 0,
    aiThinkIn: 0,
    boostTimer: 0,
  };
}

function createBotSnake(state: ArenaState): Snake {
  const usedNames = new Set(state.snakes.filter((snake) => snake.isBot).map((snake) => snake.name));
  const difficultyRoll = Math.random();
  const difficulty: BotDifficulty = difficultyRoll < 0.4 ? "easy" : difficultyRoll < 0.8 ? "medium" : "hard";
  const spawn = randomSpawnPoint(state.snakes);
  const heading = randomInRange(-Math.PI, Math.PI);
  const startSegments = randomInt(BOT_START_SEGMENTS_MIN, BOT_START_SEGMENTS_MAX);
  const hue = randomInt(165, 345);

  let baseSpeed = randomInRange(103, 124);
  let turnRate = randomInRange(4.1, 6.0);
  if (difficulty === "medium") {
    baseSpeed = randomInRange(112, 132);
    turnRate = randomInRange(5.0, 6.6);
  }
  if (difficulty === "hard") {
    baseSpeed = randomInRange(121, 141);
    turnRate = randomInRange(5.8, 7.4);
  }

  const id = `bot-${state.nextSnakeId}`;
  state.nextSnakeId += 1;

  return {
    id,
    name: pickBotName(usedNames),
    color: `hsl(${hue}, 85%, 60%)`,
    isBot: true,
    difficulty,
    segments: createSegments(spawn, startSegments, heading),
    dir: heading,
    targetDir: heading,
    baseSpeed: baseSpeed,
    turnRate,
    growth: 0,
    xp: 0,
    rawScoreUnits: 0,
    longestLength: startSegments,
    alive: true,
    boostHold: false,
    boostDrainTimer: 0,
    aiThinkIn: randomInRange(0.02, 0.18),
    boostTimer: 0,
  };
}

function getPlayer(state: ArenaState): Snake | null {
  return state.snakes.find((snake) => snake.id === state.playerId) || null;
}
function addSnakeGrowth(snake: Snake) {
  while (snake.growth >= 1) {
    const tail = snake.segments[snake.segments.length - 1];
    const beforeTail = snake.segments[snake.segments.length - 2] || tail;
    const dx = tail.x - beforeTail.x;
    const dy = tail.y - beforeTail.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
    snake.segments.push({
      x: tail.x + (dx / distance) * SEGMENT_SPACING,
      y: tail.y + (dy / distance) * SEGMENT_SPACING,
    });
    snake.growth -= 1;
  }
  snake.longestLength = Math.max(snake.longestLength, snake.segments.length);
}

function drainSnakeMass(state: ArenaState, snake: Snake, dt: number) {
  if (snake.segments.length <= MIN_SEGMENTS_FOR_BOOST) return;
  snake.boostDrainTimer += dt;
  while (snake.boostDrainTimer >= BOOST_MASS_DRAIN_SECONDS && snake.segments.length > MIN_SEGMENTS_FOR_BOOST) {
    snake.boostDrainTimer -= BOOST_MASS_DRAIN_SECONDS;
    const tail = snake.segments.pop();
    if (tail) {
      const dropKind: FoodKind = Math.random() < 0.88 ? "normal" : "golden";
      spawnFoodAt(
        state,
        tail.x + randomInRange(-5, 5),
        tail.y + randomInRange(-5, 5),
        dropKind,
      );
    }
  }
}

function updateSnakeMotion(state: ArenaState, snake: Snake, dt: number) {
  if (!snake.alive) return;
  if (snake.segments.length === 0) return;

  const isPlayer = snake.id === state.playerId;
  const shouldBoost = (isPlayer ? state.keyboardBoost || state.touchBoost : snake.boostTimer > 0) &&
    snake.segments.length > MIN_SEGMENTS_FOR_BOOST;
  snake.boostHold = shouldBoost;

  if (snake.boostTimer > 0) {
    snake.boostTimer = Math.max(0, snake.boostTimer - dt);
  }

  const rageMultiplier = isPlayer && state.playerRageTimer > 0 ? RAGE_SPEED_MULTIPLIER : 1;
  const speed = snake.baseSpeed * (shouldBoost ? BOOST_MULTIPLIER : 1) * rageMultiplier;
  snake.dir = rotateTowards(snake.dir, snake.targetDir, snake.turnRate * dt);
  const directionVector = vectorFromAngle(snake.dir);

  const head = snake.segments[0];
  head.x += directionVector.x * speed * dt;
  head.y += directionVector.y * speed * dt;

  if (shouldBoost) {
    drainSnakeMass(state, snake, dt);
  } else {
    snake.boostDrainTimer = 0;
  }

  for (let i = 1; i < snake.segments.length; i += 1) {
    const previous = snake.segments[i - 1];
    const current = snake.segments[i];
    const dx = previous.x - current.x;
    const dy = previous.y - current.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
    if (distance > SEGMENT_SPACING) {
      const adjust = (distance - SEGMENT_SPACING) / distance;
      current.x += dx * adjust;
      current.y += dy * adjust;
    }
  }

  addSnakeGrowth(snake);
}

function resolveFoodEats(state: ArenaState) {
  for (const snake of state.snakes) {
    if (!snake.alive) continue;
    const head = snake.segments[0];
    for (let i = state.foods.length - 1; i >= 0; i -= 1) {
      const food = state.foods[i];
      const eatRadius = HEAD_RADIUS + food.radius;
      if (distanceSquared(head, { x: food.x, y: food.y }) <= eatRadius * eatRadius) {
        const xpGain = snake.id === state.playerId && state.playerRageTimer > 0 ? food.xp * 2 : food.xp;
        snake.xp += xpGain;
        snake.rawScoreUnits += Math.floor(food.xp / 10);
        snake.growth += food.growth;

        if (snake.id === state.playerId) {
          state.playerCoinStreak += 1;
          state.fireBursts.push({ x: food.x, y: food.y, ttl: 0.48, strength: 1 + food.radius / 4 });
          if (state.playerCoinStreak >= RAGE_STREAK_THRESHOLD) {
            state.playerRageTimer = RAGE_DURATION_SECONDS;
          }
        }

        state.foods.splice(i, 1);
      }
    }
  }
}

function killSnake(state: ArenaState, snake: Snake) {
  if (!snake.alive) return;
  snake.alive = false;

  for (let index = 0; index < snake.segments.length; index += 1) {
    const segment = snake.segments[index];
    const roll = Math.random();
    const kind: FoodKind = roll < 0.04 ? "mega" : roll < 0.28 ? "golden" : "normal";
    spawnFoodAt(
      state,
      segment.x + randomInRange(-6, 6),
      segment.y + randomInRange(-6, 6),
      kind,
    );
  }

  if (snake.id === state.playerId) {
    state.gameFinished = true;
  }
}

function resolveCollisions(state: ArenaState) {
  const aliveSnakes = state.snakes.filter((snake) => snake.alive);
  const deadIds = new Set<string>();

  for (const snake of aliveSnakes) {
    const head = snake.segments[0];
    if (
      head.x < ARENA_PADDING ||
      head.y < ARENA_PADDING ||
      head.x > ARENA_WIDTH - ARENA_PADDING ||
      head.y > ARENA_HEIGHT - ARENA_PADDING
    ) {
      deadIds.add(snake.id);
      continue;
    }

    for (let i = 5; i < snake.segments.length; i += 1) {
      if (distanceSquared(head, snake.segments[i]) < (BODY_RADIUS * 1.15) * (BODY_RADIUS * 1.15)) {
        deadIds.add(snake.id);
        break;
      }
    }
  }

  for (let i = 0; i < aliveSnakes.length; i += 1) {
    const left = aliveSnakes[i];
    if (deadIds.has(left.id)) continue;

    for (let j = i + 1; j < aliveSnakes.length; j += 1) {
      const right = aliveSnakes[j];
      if (deadIds.has(right.id)) continue;

      const headDistance = distanceSquared(left.segments[0], right.segments[0]);
      if (headDistance <= (HEAD_RADIUS * 1.8) * (HEAD_RADIUS * 1.8)) {
        if (left.segments.length === right.segments.length) {
          deadIds.add(left.id);
          deadIds.add(right.id);
        } else if (left.segments.length < right.segments.length) {
          deadIds.add(left.id);
        } else {
          deadIds.add(right.id);
        }
      }
    }
  }

  for (const attacker of aliveSnakes) {
    if (deadIds.has(attacker.id)) continue;
    const head = attacker.segments[0];

    for (const defender of aliveSnakes) {
      if (attacker.id === defender.id) continue;
      if (deadIds.has(attacker.id)) break;

      for (let k = 1; k < defender.segments.length; k += 1) {
        if (distanceSquared(head, defender.segments[k]) <= (BODY_RADIUS * 1.2) * (BODY_RADIUS * 1.2)) {
          deadIds.add(attacker.id);
          break;
        }
      }
    }
  }

  if (deadIds.size === 0) return;

  for (const snakeId of deadIds) {
    const snake = state.snakes.find((entry) => entry.id === snakeId);
    if (snake) killSnake(state, snake);
  }

  state.snakes = state.snakes.filter((snake) => snake.alive || snake.id === state.playerId);
}

function findNearestFood(head: Vec2, foods: Food[]): Food | null {
  let bestFood: Food | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const food of foods) {
    const dist = distanceSquared(head, { x: food.x, y: food.y });
    if (dist < bestDistance) {
      bestDistance = dist;
      bestFood = food;
    }
  }
  return bestFood;
}

function findPrey(bot: Snake, snakes: Snake[]): Snake | null {
  let best: Snake | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of snakes) {
    if (!candidate.alive || candidate.id === bot.id) continue;
    if (candidate.segments.length >= bot.segments.length - 2) continue;
    const dist = distanceSquared(bot.segments[0], candidate.segments[0]);
    if (dist < bestDistance) {
      bestDistance = dist;
      best = candidate;
    }
  }
  return best;
}

function computeAvoidanceVector(bot: Snake, snakes: Snake[]): Vec2 {
  const head = bot.segments[0];
  let avoidX = 0;
  let avoidY = 0;
  const wallMargin = 180;

  if (head.x < wallMargin) avoidX += (wallMargin - head.x) / wallMargin;
  if (head.x > ARENA_WIDTH - wallMargin) avoidX -= (head.x - (ARENA_WIDTH - wallMargin)) / wallMargin;
  if (head.y < wallMargin) avoidY += (wallMargin - head.y) / wallMargin;
  if (head.y > ARENA_HEIGHT - wallMargin) avoidY -= (head.y - (ARENA_HEIGHT - wallMargin)) / wallMargin;

  const avoidDistance = 95;
  const avoidDistanceSq = avoidDistance * avoidDistance;

  for (const snake of snakes) {
    if (!snake.alive || snake.id === bot.id) continue;
    for (let i = 0; i < snake.segments.length; i += 2) {
      const segment = snake.segments[i];
      const dx = head.x - segment.x;
      const dy = head.y - segment.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > 0 && distSq < avoidDistanceSq) {
        const dist = Math.sqrt(distSq);
        const strength = (avoidDistance - dist) / avoidDistance;
        avoidX += (dx / dist) * strength * 1.9;
        avoidY += (dy / dist) * strength * 1.9;
      }
    }
  }

  return { x: avoidX, y: avoidY };
}
function updateBots(state: ArenaState, dt: number) {
  for (const bot of state.snakes) {
    if (!bot.isBot || !bot.alive) continue;

    bot.aiThinkIn -= dt;
    if (bot.aiThinkIn > 0) continue;

    bot.aiThinkIn = randomInRange(
      bot.difficulty === "easy" ? 0.2 : bot.difficulty === "medium" ? 0.13 : 0.09,
      bot.difficulty === "easy" ? 0.34 : bot.difficulty === "medium" ? 0.22 : 0.16,
    );

    const head = bot.segments[0];
    const foodTarget = findNearestFood(head, state.foods);
    const preyTarget = bot.difficulty === "hard" || Math.random() < 0.28 ? findPrey(bot, state.snakes) : null;
    const avoidance = computeAvoidanceVector(bot, state.snakes);

    let desiredVector = vectorFromAngle(bot.targetDir);
    if (bot.difficulty === "easy" && Math.random() < 0.45) {
      const randomAngle = bot.targetDir + randomInRange(-0.8, 0.8);
      desiredVector = vectorFromAngle(randomAngle);
    }

    if (foodTarget && bot.difficulty !== "easy") {
      const foodVector = { x: foodTarget.x - head.x, y: foodTarget.y - head.y };
      const len = Math.hypot(foodVector.x, foodVector.y) || 1;
      desiredVector = { x: foodVector.x / len, y: foodVector.y / len };
    } else if (foodTarget) {
      const foodVector = { x: foodTarget.x - head.x, y: foodTarget.y - head.y };
      const len = Math.hypot(foodVector.x, foodVector.y) || 1;
      desiredVector = {
        x: desiredVector.x * 0.55 + (foodVector.x / len) * 0.45,
        y: desiredVector.y * 0.55 + (foodVector.y / len) * 0.45,
      };
    }

    if (preyTarget) {
      const preyHead = preyTarget.segments[0];
      const preyDirection = vectorFromAngle(preyTarget.dir);
      const targetX = preyHead.x + preyDirection.x * 32;
      const targetY = preyHead.y + preyDirection.y * 32;
      const preyVector = { x: targetX - head.x, y: targetY - head.y };
      const preyLen = Math.hypot(preyVector.x, preyVector.y) || 1;
      const aggression = bot.difficulty === "hard" ? 0.74 : 0.42;
      desiredVector = {
        x: desiredVector.x * (1 - aggression) + (preyVector.x / preyLen) * aggression,
        y: desiredVector.y * (1 - aggression) + (preyVector.y / preyLen) * aggression,
      };
      if (bot.difficulty === "hard" && bot.segments.length > MIN_SEGMENTS_FOR_BOOST + 2 && Math.random() < 0.3) {
        bot.boostTimer = randomInRange(0.35, 0.9);
      }
    }

    const avoidWeight = bot.difficulty === "easy" ? 2.1 : bot.difficulty === "medium" ? 2.6 : 3.1;
    const mixVector = {
      x: desiredVector.x + avoidance.x * avoidWeight + randomInRange(-0.05, 0.05),
      y: desiredVector.y + avoidance.y * avoidWeight + randomInRange(-0.05, 0.05),
    };
    const mixLength = Math.hypot(mixVector.x, mixVector.y) || 1;
    bot.targetDir = Math.atan2(mixVector.y / mixLength, mixVector.x / mixLength);

    if (bot.difficulty === "easy" && Math.random() < 0.07) {
      bot.targetDir += randomInRange(-0.45, 0.45);
    }
  }
}

function maintainPopulation(state: ArenaState) {
  const aliveCount = state.snakes.filter((snake) => snake.alive).length;
  const availableSlots = Math.max(0, MAX_TOTAL_SNAKES - aliveCount);
  if (availableSlots <= 0) return;
  const needToMin = Math.max(0, MIN_TOTAL_SNAKES - aliveCount);
  if (needToMin <= 0) return;
  const spawnCount = Math.min(needToMin, availableSlots);
  for (let i = 0; i < spawnCount; i += 1) {
    state.snakes.push(createBotSnake(state));
  }
}

function updateArena(state: ArenaState, dt: number) {
  if (state.gameFinished) return;

  updateBots(state, dt);

  for (const snake of state.snakes) {
    updateSnakeMotion(state, snake, dt);
  }

  resolveFoodEats(state);
  resolveCollisions(state);

  const missingFood = FOOD_TARGET - state.foods.length;
  if (missingFood > 0) {
    spawnRandomFood(state, Math.min(8, missingFood));
  }

  state.botSpawnTimer -= dt;
  if (state.botSpawnTimer <= 0) {
    state.botSpawnTimer = randomInRange(0.75, 1.25);
    maintainPopulation(state);
  }

  state.playerRageTimer = Math.max(0, state.playerRageTimer - dt);
  if (state.playerRageTimer === 0) {
    state.playerCoinStreak = Math.min(state.playerCoinStreak, RAGE_STREAK_THRESHOLD - 1);
  }

  state.fireBursts = state.fireBursts
    .map((burst) => ({ ...burst, ttl: burst.ttl - dt }))
    .filter((burst) => burst.ttl > 0);
}

function worldToScreen(point: Vec2, camera: Vec2): Vec2 {
  return {
    x: point.x - camera.x,
    y: point.y - camera.y,
  };
}

function renderArena(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: ArenaState) {
  const dpr = window.devicePixelRatio || 1;
  const viewWidth = canvas.width / dpr;
  const viewHeight = canvas.height / dpr;
  const player = getPlayer(state);

  const playerHead = player?.segments[0] || { x: ARENA_WIDTH * 0.5, y: ARENA_HEIGHT * 0.5 };
  const camera = {
    x: clamp(playerHead.x - viewWidth * 0.5, 0, ARENA_WIDTH - viewWidth),
    y: clamp(playerHead.y - viewHeight * 0.5, 0, ARENA_HEIGHT - viewHeight),
  };

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(dpr, dpr);

  const bgGradient = ctx.createLinearGradient(0, 0, viewWidth, viewHeight);
  bgGradient.addColorStop(0, "rgba(2, 6, 23, 0.92)");
  bgGradient.addColorStop(1, "rgba(15, 23, 42, 0.96)");
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  ctx.strokeStyle = "rgba(148, 163, 184, 0.08)";
  ctx.lineWidth = 1;
  const gridSize = 48;
  const offsetX = camera.x % gridSize;
  const offsetY = camera.y % gridSize;
  for (let x = -offsetX; x <= viewWidth; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, viewHeight);
    ctx.stroke();
  }
  for (let y = -offsetY; y <= viewHeight; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(viewWidth, y);
    ctx.stroke();
  }

  const arenaTopLeft = worldToScreen({ x: ARENA_PADDING, y: ARENA_PADDING }, camera);
  const arenaBottomRight = worldToScreen({ x: ARENA_WIDTH - ARENA_PADDING, y: ARENA_HEIGHT - ARENA_PADDING }, camera);
  ctx.strokeStyle = "rgba(56, 189, 248, 0.28)";
  ctx.lineWidth = 2;
  ctx.strokeRect(
    arenaTopLeft.x,
    arenaTopLeft.y,
    arenaBottomRight.x - arenaTopLeft.x,
    arenaBottomRight.y - arenaTopLeft.y,
  );

  for (const food of state.foods) {
    const screen = worldToScreen({ x: food.x, y: food.y }, camera);
    if (screen.x < -25 || screen.y < -25 || screen.x > viewWidth + 25 || screen.y > viewHeight + 25) {
      continue;
    }

    ctx.beginPath();
    ctx.fillStyle = food.glow;
    ctx.arc(screen.x, screen.y, food.radius * 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = food.color;
    ctx.arc(screen.x, screen.y, food.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(120,53,15,0.82)";
    ctx.font = `${Math.max(8, food.radius * 2)}px ui-sans-serif, system-ui`;
    ctx.textAlign = "center";
    ctx.fillText("₿", screen.x, screen.y + 2);
  }

  for (const burst of state.fireBursts) {
    const screen = worldToScreen({ x: burst.x, y: burst.y }, camera);
    const alpha = burst.ttl / 0.48;
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = "rgba(251,146,60,0.9)";
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, 8 + (1 - alpha) * 24 * burst.strength, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const snakes = state.snakes.filter((snake) => snake.alive);
  for (const snake of snakes) {
    for (let i = snake.segments.length - 1; i >= 0; i -= 1) {
      const segment = snake.segments[i];
      const screen = worldToScreen(segment, camera);
      if (screen.x < -40 || screen.y < -40 || screen.x > viewWidth + 40 || screen.y > viewHeight + 40) continue;

      const isHead = i === 0;
      const radius = isHead ? HEAD_RADIUS : BODY_RADIUS;
      const isPlayer = snake.id === state.playerId;
      ctx.beginPath();
      ctx.globalAlpha = isHead ? 1 : 0.85;
      ctx.fillStyle = isPlayer
        ? isHead
          ? "#f59e0b"
          : i % 2 === 0
          ? "#fcd34d"
          : "#f59e0b"
        : snake.color;
      ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
      ctx.fill();

      if (isHead && isPlayer) {
        ctx.beginPath();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = "#fde68a";
        ctx.arc(screen.x, screen.y, radius + 4, 0, Math.PI * 2);
        ctx.fill();

        const eyesDistance = 3;
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#111827";
        ctx.beginPath();
        ctx.arc(screen.x - eyesDistance, screen.y - 1, 1.2, 0, Math.PI * 2);
        ctx.arc(screen.x + eyesDistance, screen.y - 1, 1.2, 0, Math.PI * 2);
        ctx.fill();

        if (state.playerRageTimer > 0) {
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = "#fb923c";
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, radius + 9, 0, Math.PI * 2);
          ctx.fill();
        }

        if (snake.longestLength >= WING_UNLOCK_LENGTH) {
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = "rgba(251,191,36,0.8)";
          ctx.beginPath();
          ctx.moveTo(screen.x - radius, screen.y - 1);
          ctx.lineTo(screen.x - radius - 10, screen.y - 12);
          ctx.lineTo(screen.x - radius - 2, screen.y + 6);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(screen.x + radius, screen.y - 1);
          ctx.lineTo(screen.x + radius + 10, screen.y - 12);
          ctx.lineTo(screen.x + radius + 2, screen.y + 6);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    const head = snake.segments[0];
    const namePos = worldToScreen(head, camera);
    ctx.globalAlpha = 0.92;
    ctx.font = "12px ui-sans-serif, system-ui, -apple-system";
    ctx.textAlign = "center";
    ctx.fillStyle = snake.id === state.playerId ? "#fde68a" : "rgba(226,232,240,0.95)";
    ctx.fillText(snake.name, namePos.x, namePos.y - 13);
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function buildInitialState(playerName: string): ArenaState {
  const state: ArenaState = {
    snakes: [],
    foods: [],
    nextFoodId: 1,
    nextSnakeId: 1,
    playerId: "player",
    startedAt: performance.now(),
    lastTimestamp: performance.now(),
    keyboardBoost: false,
    touchBoost: false,
    swipeStart: null,
    botSpawnTimer: 0.8,
    rafHandle: 0,
    gameFinished: false,
    gameFinishedSent: false,
    fireBursts: [],
    playerCoinStreak: 0,
    playerRageTimer: 0,
  };

  state.snakes.push(createPlayerSnake(playerName));

  const initialBots = randomInt(INITIAL_BOT_MIN, INITIAL_BOT_MAX);
  for (let i = 0; i < initialBots; i += 1) {
    state.snakes.push(createBotSnake(state));
  }

  maintainPopulation(state);
  spawnRandomFood(state, FOOD_TARGET);
  return state;
}

function applyDirectionToPlayer(state: ArenaState, angle: number) {
  const player = getPlayer(state);
  if (!player || !player.alive) return;
  player.targetDir = angle;
}

function snapshotHud(state: ArenaState): ArenaHud {
  const player = getPlayer(state);
  const xp = player?.xp || 0;
  const length = player?.segments.length || 0;
  return {
    xp,
    bix: xp / 10000,
    length,
    longestLength: player?.longestLength || length,
    boosting: !!player?.boostHold,
    rageMode: state.playerRageTimer > 0,
    streak: state.playerCoinStreak,
    leaderboard: computeLeaderboard(state),
  };
}
export function BixSnakeArenaGame({ onFinish, playerName = "Player", className }: BixSnakeArenaGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<ArenaState | null>(null);
  const onFinishRef = useRef(onFinish);
  const lastHudSyncRef = useRef<number>(0);
  const [hud, setHud] = useState<ArenaHud>({
    xp: 0,
    bix: 0,
    length: PLAYER_START_SEGMENTS,
    longestLength: PLAYER_START_SEGMENTS,
    boosting: false,
    rageMode: false,
    streak: 0,
    leaderboard: [],
  });

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const state = buildInitialState(playerName);
    stateRef.current = state;
    setHud(snapshotHud(state));

    const resizeCanvas = () => {
      const rect = host.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(320, Math.floor(rect.width));
      const height = Math.max(260, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!stateRef.current || stateRef.current.gameFinished) return;
      const key = event.key.toLowerCase();
      if (key === "arrowup" || key === "w") {
        event.preventDefault();
        applyDirectionToPlayer(stateRef.current, toRadians("up"));
      } else if (key === "arrowdown" || key === "s") {
        event.preventDefault();
        applyDirectionToPlayer(stateRef.current, toRadians("down"));
      } else if (key === "arrowleft" || key === "a") {
        event.preventDefault();
        applyDirectionToPlayer(stateRef.current, toRadians("left"));
      } else if (key === "arrowright" || key === "d") {
        event.preventDefault();
        applyDirectionToPlayer(stateRef.current, toRadians("right"));
      } else if (key === " ") {
        event.preventDefault();
        stateRef.current.keyboardBoost = true;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!stateRef.current) return;
      if (event.key === " ") {
        event.preventDefault();
        stateRef.current.keyboardBoost = false;
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp, { passive: false });

    const frame = (timestamp: number) => {
      if (!stateRef.current || !canvasRef.current) return;
      const current = stateRef.current;

      const dt = clamp((timestamp - current.lastTimestamp) / 1000, 0.001, 0.05);
      current.lastTimestamp = timestamp;

      const context = canvas.getContext("2d");
      if (!context) return;

      updateArena(current, dt);
      renderArena(context, canvas, current);

      if (timestamp - lastHudSyncRef.current >= HUD_SYNC_MS) {
        lastHudSyncRef.current = timestamp;
        setHud(snapshotHud(current));
      }

      if (current.gameFinished) {
        if (!current.gameFinishedSent) {
          current.gameFinishedSent = true;
          const player = getPlayer(current);
          const xp = player?.xp || 0;
          const rawScore = player?.rawScoreUnits || 0;
          const durationSeconds = Math.max(1, Math.round((timestamp - current.startedAt) / 1000));
          onFinishRef.current({
            rawScore,
            xp,
            bix: xp / 10000,
            longestLength: player?.longestLength || PLAYER_START_SEGMENTS,
            durationSeconds,
          });
        }
        return;
      }

      current.rafHandle = window.requestAnimationFrame(frame);
    };

    state.rafHandle = window.requestAnimationFrame(frame);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (stateRef.current?.rafHandle) {
        window.cancelAnimationFrame(stateRef.current.rafHandle);
      }
      stateRef.current = null;
    };
  }, [playerName]);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const state = stateRef.current;
    if (!state || state.gameFinished) return;
    const touch = event.touches[0];
    if (!touch) return;
    state.swipeStart = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const state = stateRef.current;
    if (!state || state.gameFinished || !state.swipeStart) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - state.swipeStart.x;
    const dy = touch.clientY - state.swipeStart.y;
    const magnitude = Math.hypot(dx, dy);
    if (magnitude >= 16) {
      applyDirectionToPlayer(state, Math.atan2(dy, dx));
    }
    state.swipeStart = null;
  };

  const setTouchBoost = (active: boolean) => {
    const state = stateRef.current;
    if (!state || state.gameFinished) return;
    state.touchBoost = active;
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/60 bg-secondary/35 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">XP</p>
          <p className="mt-1 text-2xl font-bold text-gradient-gold">{hud.xp.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-secondary/35 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">BIX</p>
          <p className="mt-1 text-2xl font-bold">{formatBix(hud.xp)}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-secondary/35 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Length</p>
          <p className="mt-1 text-2xl font-bold">{hud.length}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-secondary/35 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Boost</p>
          <p className="mt-1 text-2xl font-bold flex items-center gap-1.5">
            <Gauge className={cn("h-5 w-5", hud.boosting ? "text-amber-300" : "text-muted-foreground")} />
            {hud.boosting ? "ON" : "OFF"}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-amber-300/35 bg-amber-500/10 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-200/80">Dragon Rage</p>
          <p className="text-sm text-amber-100">{`Streak ${hud.streak}/${RAGE_STREAK_THRESHOLD} • ${hud.rageMode ? "Rage active: speed + reward boost" : "Collect coins for rage mode"}`}</p>
        </div>
        <DragonMascot mood={hud.rageMode ? "rage" : "fire"} size="sm" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_18rem] gap-4">
        <div
          ref={hostRef}
          className="relative w-full min-h-[360px] sm:min-h-[430px] rounded-2xl border border-border/70 bg-secondary/20 overflow-hidden touch-none"
          style={{ touchAction: "none" }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
          <div className="absolute top-3 left-3 rounded-lg border border-border/60 bg-background/55 backdrop-blur-sm px-3 py-2 text-xs text-muted-foreground">
            Dragon Arena: collect BIX coins, trigger fire bursts, and hit streak 10 for rage mode.
          </div>
          <div className="absolute bottom-3 right-3">
            <Button
              className="h-11 px-5 bg-gradient-gold text-primary-foreground font-semibold"
              onMouseDown={() => setTouchBoost(true)}
              onMouseUp={() => setTouchBoost(false)}
              onMouseLeave={() => setTouchBoost(false)}
              onTouchStart={() => setTouchBoost(true)}
              onTouchEnd={() => setTouchBoost(false)}
              onTouchCancel={() => setTouchBoost(false)}
            >
              <Zap className="h-4 w-4 mr-1.5" />
              Boost
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-secondary/25 p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            Arena Top Snakes
          </h3>
          <div className="space-y-2">
            {hud.leaderboard.length === 0 ? (
              <p className="text-xs text-muted-foreground">Finding active snakes...</p>
            ) : (
              hud.leaderboard.map((entry, index) => (
                <div
                  key={entry.id}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm flex items-center justify-between",
                    entry.isPlayer
                      ? "border-primary/40 bg-primary/10"
                      : "border-border/60 bg-background/35",
                  )}
                >
                  <p className="truncate pr-3">
                    {`${index + 1}. ${entry.name}`}
                    {entry.isBot ? " [BOT]" : ""}
                  </p>
                  <p className="font-semibold">{entry.xp.toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
          <div className="rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
            Desktop: Arrow keys/WASD, Space to boost.
          </div>
          <div className="rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
            Mobile: Swipe direction, hold Boost button.
          </div>
        </div>
      </div>
    </div>
  );
}
