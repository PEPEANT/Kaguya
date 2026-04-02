import { GAME_DURATION, GROUND_Y } from "./constants.js";
import { getCurrentContentSeasonId } from "./config/runtime.js";

const DEFAULT_MAX_HEALTH_BY_SEASON = Object.freeze({
  s1: 6,
  s2: 5
});
const DEFAULT_PLAYER_WIDTH = 240;
const DEFAULT_PLAYER_HEIGHT = 326;

function getDefaultMaxHealth() {
  return DEFAULT_MAX_HEALTH_BY_SEASON[getCurrentContentSeasonId()] || DEFAULT_MAX_HEALTH_BY_SEASON.s1;
}

export function createPlayer() {
  return {
    x: 236,
    y: GROUND_Y,
    baseWidth: DEFAULT_PLAYER_WIDTH,
    baseHeight: DEFAULT_PLAYER_HEIGHT,
    width: DEFAULT_PLAYER_WIDTH,
    height: DEFAULT_PLAYER_HEIGHT,
    speed: 470,
    jumpPower: 980,
    gravity: 2400,
    velocityY: 0,
    onGround: true,
    isCrouching: false,
    isSliding: false,
    slideTimer: 0,
    slideCooldownUntil: Number.NEGATIVE_INFINITY,
    slideDirection: 1,
    slideRecoveryTimer: 0,
    slideImpactConsumed: false,
    facing: 1,
    walkTime: 0
  };
}

export function normalizeName(name) {
  return Array.from(String(name || "").trim().replace(/\s+/g, " ")).slice(0, 12).join("");
}

export const state = {
  phase: "loading",
  playerId: "",
  nickname: "",
  authReady: false,
  authUser: null,
  round: 1,
  roundLabelKey: "round.1.label",
  roundTransitionKey: "round.1.transition",
  roundBackgroundKey: "backgroundRound1",
  roundTransitionTimer: 0,
  timeLimit: GAME_DURATION,
  maxHealth: getDefaultMaxHealth(),
  health: getDefaultMaxHealth(),
  score: 0,
  timeLeft: GAME_DURATION,
  elapsed: 0,
  spawnTimer: 1.2,
  items: [],
  floatTexts: [],
  timeBonusToastText: "",
  timeBonusToastTimer: 0,
  slideStunTimer: 0,
  slideStunVisualTimer: 0,
  rankings: [],
  lastRank: null,
  hujupayBalance: 0,
  hujupayEarnedTotal: 0,
  equippedSkin: "skin_0",
  ownedSkins: [],
  finalBossPrepTriggered: false,
  finalBossPrepStartedAt: Number.NEGATIVE_INFINITY,
  finalBossCueIds: [],
  backgroundStageMinScore: 0,
  awardedBackgroundStageThresholds: [],
  backgroundTransitionFromKey: "",
  backgroundTransitionStartAt: Number.NEGATIVE_INFINITY,
  backgroundTransitionDuration: 0,
  backgroundFlashTimer: 0,
  backgroundFlashDuration: 0,
  backgroundFlashIntensity: 0,
  backgroundFlashColor: [255, 244, 214],
  backgroundParticles: [],
  backgroundParticleEmitters: [],
  recentDangerSpawnLanes: [],
  isNewBest: false,
  shake: 0,
  damageTimer: 0,
  yummyTimer: 0,
  resultSceneKey: "",
  resultSceneX: 0,
  resultSceneY: 0,
  lastSpecialSpawnAt: Number.NEGATIVE_INFINITY,
  lastHealSpawnAt: Number.NEGATIVE_INFINITY,
  assets: null,
  input: {
    left: false,
    right: false,
    down: false,
    jumpQueued: false,
    leftTapAt: Number.NEGATIVE_INFINITY,
    rightTapAt: Number.NEGATIVE_INFINITY
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
  const defaultMaxHealth = getDefaultMaxHealth();
  state.maxHealth = defaultMaxHealth;
  state.health = defaultMaxHealth;
  state.score = 0;
  state.timeLeft = GAME_DURATION;
  state.elapsed = 0;
  state.spawnTimer = 1.2;
  state.items = [];
  state.floatTexts = [];
  state.timeBonusToastText = "";
  state.timeBonusToastTimer = 0;
  state.slideStunTimer = 0;
  state.slideStunVisualTimer = 0;
  state.lastRank = null;
  state.finalBossPrepTriggered = false;
  state.finalBossPrepStartedAt = Number.NEGATIVE_INFINITY;
  state.finalBossCueIds = [];
  state.backgroundStageMinScore = 0;
  state.awardedBackgroundStageThresholds = [];
  state.backgroundTransitionFromKey = "";
  state.backgroundTransitionStartAt = Number.NEGATIVE_INFINITY;
  state.backgroundTransitionDuration = 0;
  state.backgroundFlashTimer = 0;
  state.backgroundFlashDuration = 0;
  state.backgroundFlashIntensity = 0;
  state.backgroundFlashColor = [255, 244, 214];
  state.backgroundParticles = [];
  state.backgroundParticleEmitters = [];
  state.recentDangerSpawnLanes = [];
  state.isNewBest = false;
  state.shake = 0;
  state.damageTimer = 0;
  state.yummyTimer = 0;
  state.resultSceneKey = "";
  state.resultSceneX = 0;
  state.resultSceneY = 0;
  state.lastSpecialSpawnAt = Number.NEGATIVE_INFINITY;
  state.lastHealSpawnAt = Number.NEGATIVE_INFINITY;
  state.input.left = false;
  state.input.right = false;
  state.input.down = false;
  state.input.jumpQueued = false;
  state.input.leftTapAt = Number.NEGATIVE_INFINITY;
  state.input.rightTapAt = Number.NEGATIVE_INFINITY;
  state.player = createPlayer();
}
