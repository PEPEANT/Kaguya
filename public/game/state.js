import { GAME_DURATION, GROUND_Y } from "./constants.js";

const DEFAULT_MAX_HEALTH = 6;

export function createPlayer() {
  return {
    x: 236,
    y: GROUND_Y,
    width: 240,
    height: 326,
    speed: 470,
    jumpPower: 980,
    gravity: 2400,
    velocityY: 0,
    onGround: true,
    facing: 1,
    walkTime: 0
  };
}

export function normalizeName(name) {
  return Array.from(String(name || "").trim().replace(/\s+/g, " ")).slice(0, 12).join("");
}

export const state = {
  phase: "loading",
  nickname: "",
  round: 1,
  roundLabelKey: "round.1.label",
  roundTransitionKey: "round.1.transition",
  roundBackgroundKey: "backgroundRound1",
  roundTransitionTimer: 0,
  timeLimit: GAME_DURATION,
  maxHealth: DEFAULT_MAX_HEALTH,
  health: DEFAULT_MAX_HEALTH,
  score: 0,
  timeLeft: GAME_DURATION,
  elapsed: 0,
  spawnTimer: 1.2,
  items: [],
  floatTexts: [],
  rankings: [],
  lastRank: null,
  isNewBest: false,
  shake: 0,
  damageTimer: 0,
  lastSpecialSpawnAt: Number.NEGATIVE_INFINITY,
  assets: null,
  input: {
    left: false,
    right: false,
    jumpQueued: false
  },
  player: createPlayer()
};

export function resetRound(name) {
  state.phase = "playing";
  state.nickname = name;
  state.round = 1;
  state.roundLabelKey = "round.1.label";
  state.roundTransitionKey = "round.1.transition";
  state.roundBackgroundKey = "backgroundRound1";
  state.roundTransitionTimer = 1.8;
  state.timeLimit = GAME_DURATION;
  state.maxHealth = DEFAULT_MAX_HEALTH;
  state.health = DEFAULT_MAX_HEALTH;
  state.score = 0;
  state.timeLeft = GAME_DURATION;
  state.elapsed = 0;
  state.spawnTimer = 1.2;
  state.items = [];
  state.floatTexts = [];
  state.lastRank = null;
  state.isNewBest = false;
  state.shake = 0;
  state.damageTimer = 0;
  state.lastSpecialSpawnAt = Number.NEGATIVE_INFINITY;
  state.input.left = false;
  state.input.right = false;
  state.input.jumpQueued = false;
  state.player = createPlayer();
}
