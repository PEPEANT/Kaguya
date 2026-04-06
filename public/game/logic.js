import { PLAY_BOUNDS, VIRTUAL_HEIGHT, GAME_DURATION, GROUND_Y } from "./constants.js";
import { saveSeasonSummary } from "./account-service.js";
import { playBossPrepMusic, playItemSoundEffect } from "./audio.js";
import { FINAL_BOSS_PREP_CONFIG } from "./config/final-boss-prep.js";
import { ITEM_TYPES } from "./config/items.js";
import { BACKGROUND_SCORE_STAGES, ROUND_DEFINITIONS } from "./config/progression.js";
import { getRankingClosureNotice, isPlaytestMode, isRankingClosed } from "./config/runtime.js";
import { t } from "./i18n.js";
import { fetchRankingsFromProvider, submitScoreToProvider } from "./ranking-service.js";
import { state, resetRound } from "./state.js";
import { hideGameResult, renderRankingList, setRankingStatus, setTouchControlsVisible, showGameResult } from "./ui.js";

const RESULT_SCENE_DELAY_MS = 1600;
const SLIDE_DOUBLE_TAP_WINDOW = 0.26;
const SLIDE_DURATION = 0.32;
const SLIDE_COOLDOWN = 4;
const SLIDE_SPEED_MULTIPLIER = 2.15;
const SLIDE_RECOVERY_DURATION = 0.12;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start, end, ratio) {
  return start + (end - start) * ratio;
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function clampColorChannel(value) {
  return Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function chooseWeightedItem(itemTypes) {
  const totalWeight = itemTypes.reduce((sum, itemType) => sum + getEffectiveItemWeight(itemType), 0);
  let roll = Math.random() * totalWeight;

  for (const itemType of itemTypes) {
    roll -= getEffectiveItemWeight(itemType);
    if (roll <= 0) {
      return itemType;
    }
  }

  return itemTypes[itemTypes.length - 1];
}

function getRoundDefinition() {
  const roundDefinition = ROUND_DEFINITIONS[state.round - 1] || ROUND_DEFINITIONS[0];

  if (!state.finalBossPrepTriggered || !FINAL_BOSS_PREP_CONFIG.roundOverride) {
    return roundDefinition;
  }

  const prepProgress = getFinalBossPrepProgress();

  return {
    ...roundDefinition,
    speedMin: lerp(roundDefinition.speedMin, FINAL_BOSS_PREP_CONFIG.roundOverride.speedMin, prepProgress),
    speedMax: lerp(roundDefinition.speedMax, FINAL_BOSS_PREP_CONFIG.roundOverride.speedMax, prepProgress),
    speedVariance: lerp(roundDefinition.speedVariance, FINAL_BOSS_PREP_CONFIG.roundOverride.speedVariance, prepProgress),
    driftMin: lerp(roundDefinition.driftMin, FINAL_BOSS_PREP_CONFIG.roundOverride.driftMin, prepProgress),
    driftMax: lerp(roundDefinition.driftMax, FINAL_BOSS_PREP_CONFIG.roundOverride.driftMax, prepProgress),
    spawnMin: lerp(roundDefinition.spawnMin, FINAL_BOSS_PREP_CONFIG.roundOverride.spawnMin, prepProgress),
    spawnMax: lerp(roundDefinition.spawnMax, FINAL_BOSS_PREP_CONFIG.roundOverride.spawnMax, prepProgress),
    maxActiveItems: Math.round(lerp(roundDefinition.maxActiveItems, FINAL_BOSS_PREP_CONFIG.roundOverride.maxActiveItems, prepProgress)),
    backgroundKey: FINAL_BOSS_PREP_CONFIG.backgroundKey || roundDefinition.backgroundKey,
    labelKey: FINAL_BOSS_PREP_CONFIG.labelKey || roundDefinition.labelKey,
    transitionKey: FINAL_BOSS_PREP_CONFIG.transitionKey || roundDefinition.transitionKey
  };
}

function getRoundProgressRatio() {
  const currentRound = getRoundDefinition();
  const nextRound = ROUND_DEFINITIONS[state.round] || null;
  const roundEnd = nextRound ? nextRound.startsAt : GAME_DURATION;
  return clamp((state.elapsed - currentRound.startsAt) / Math.max(1, roundEnd - currentRound.startsAt), 0, 1);
}

function getFinalBossPrepProgress() {
  if (!state.finalBossPrepTriggered || !FINAL_BOSS_PREP_CONFIG.enabled) {
    return 0;
  }

  return clamp(
    (state.elapsed - state.finalBossPrepStartedAt) / Math.max(1, FINAL_BOSS_PREP_CONFIG.difficultyRampDuration || 1),
    0,
    1
  );
}

function getFinalBossPresentationProgress() {
  if (!state.finalBossPrepTriggered || !FINAL_BOSS_PREP_CONFIG.enabled || !FINAL_BOSS_PREP_CONFIG.presentation) {
    return 0;
  }

  const rampDuration = Number(FINAL_BOSS_PREP_CONFIG.presentation.rampDuration);
  if (!Number.isFinite(rampDuration) || rampDuration <= 0) {
    return 1;
  }

  return clamp(
    (state.elapsed - state.finalBossPrepStartedAt) / rampDuration,
    0,
    1
  );
}

function getFinalBossPlayerScale() {
  const targetScale = Number(FINAL_BOSS_PREP_CONFIG.presentation?.playerScale);

  if (!Number.isFinite(targetScale)) {
    return 1;
  }

  return lerp(1, clamp(targetScale, 0.55, 1), getFinalBossPresentationProgress());
}

function getFinalBossItemCollisionScale() {
  const targetScale = Number(FINAL_BOSS_PREP_CONFIG.presentation?.itemCollisionScale);

  if (!Number.isFinite(targetScale)) {
    return 1;
  }

  return lerp(1, clamp(targetScale, 0.7, 1), getFinalBossPresentationProgress());
}

function getFinalBossMovementSpeedMultiplier() {
  const targetMultiplier = Number(FINAL_BOSS_PREP_CONFIG.presentation?.movementSpeedMultiplier);

  if (!Number.isFinite(targetMultiplier)) {
    return 1;
  }

  return lerp(1, Math.max(1, targetMultiplier), getFinalBossPresentationProgress());
}

function getFinalBossEffectsConfig() {
  return FINAL_BOSS_PREP_CONFIG.effects || null;
}

function getFinalBossSpawnDistributionConfig() {
  if (!state.finalBossPrepTriggered) {
    return null;
  }

  return FINAL_BOSS_PREP_CONFIG.spawnDistribution || null;
}

function getFinalBossMusicElapsed() {
  if (!state.finalBossPrepTriggered) {
    return 0;
  }

  return Math.max(0, state.elapsed - state.finalBossPrepStartedAt);
}

function triggerBackgroundFlash(flashConfig) {
  if (!flashConfig) {
    return;
  }

  const duration = Math.max(0.08, Number(flashConfig.duration) || 0.45);
  const intensity = clamp(Number(flashConfig.intensity) || 0.65, 0.12, 1.2);

  state.backgroundFlashDuration = duration;
  state.backgroundFlashTimer = duration;
  state.backgroundFlashIntensity = intensity;

  if (Array.isArray(flashConfig.color) && flashConfig.color.length >= 3) {
    state.backgroundFlashColor = flashConfig.color.slice(0, 3).map(clampColorChannel);
  }
}

function spawnBackgroundParticles(particleConfig) {
  if (!particleConfig) {
    return;
  }

  const count = Math.max(0, Math.floor(Number(particleConfig.count) || 0));
  if (!count) {
    return;
  }

  const palette = Array.isArray(particleConfig.colors) && particleConfig.colors.length
    ? particleConfig.colors
    : [state.backgroundFlashColor];

  for (let index = 0; index < count; index += 1) {
    const color = palette[index % palette.length];
    const life = randomRange(
      Math.max(0.2, Number(particleConfig.durationMin) || 1),
      Math.max(Math.max(0.2, Number(particleConfig.durationMin) || 1), Number(particleConfig.durationMax) || 1.8)
    );
    const originX = clamp(Number(particleConfig.originX) || 0.5, 0, 1) * (PLAY_BOUNDS.right + PLAY_BOUNDS.left);
    const originY = clamp(Number(particleConfig.originY) || 0.25, 0, 1) * VIRTUAL_HEIGHT;
    const spreadX = clamp(Number(particleConfig.spreadX) || 0.2, 0, 1) * (PLAY_BOUNDS.right + PLAY_BOUNDS.left);
    const spreadY = clamp(Number(particleConfig.spreadY) || 0.1, 0, 1) * VIRTUAL_HEIGHT;
    const velocityX = randomRange(-(Number(particleConfig.speedX) || 90), Number(particleConfig.speedX) || 90);
    const velocityY = -randomRange(
      Math.max(10, Number(particleConfig.speedYMin) || 60),
      Math.max(Math.max(10, Number(particleConfig.speedYMin) || 60), Number(particleConfig.speedYMax) || 160)
    );

    state.backgroundParticles.push({
      id: crypto.randomUUID(),
      x: originX + randomRange(-spreadX, spreadX),
      y: originY + randomRange(-spreadY, spreadY),
      vx: velocityX,
      vy: velocityY,
      gravity: randomRange(120, 180),
      age: 0,
      life,
      size: randomRange(
        Math.max(2, Number(particleConfig.sizeMin) || 6),
        Math.max(Math.max(2, Number(particleConfig.sizeMin) || 6), Number(particleConfig.sizeMax) || 16)
      ),
      alpha: randomRange(0.55, 0.95),
      twinkle: Math.random() * Math.PI * 2,
      color: Array.isArray(color) && color.length >= 3
        ? color.slice(0, 3).map(clampColorChannel)
        : [255, 236, 194]
    });
  }
}

function activateBackgroundParticleEmitter(emitterConfig, cueId) {
  if (!emitterConfig || !cueId) {
    return;
  }

  const duration = Math.max(0.2, Number(emitterConfig.duration) || 0);
  const interval = Math.max(0.05, Number(emitterConfig.interval) || 0.18);

  state.backgroundParticleEmitters.push({
    id: cueId,
    endAt: getFinalBossMusicElapsed() + duration,
    interval,
    timer: 0,
    particleConfig: {
      ...emitterConfig,
      count: Math.max(1, Math.floor(Number(emitterConfig.count) || 1))
    }
  });
}

function triggerFinalBossCue(cueConfig) {
  if (!cueConfig?.id || state.finalBossCueIds.includes(cueConfig.id)) {
    return;
  }

  state.finalBossCueIds.push(cueConfig.id);
  triggerBackgroundFlash(cueConfig.flash);
  spawnBackgroundParticles(cueConfig.particles);
  activateBackgroundParticleEmitter(cueConfig.ambientParticles, cueConfig.id);
  state.shake = Math.max(state.shake, cueConfig.particles ? 0.22 : 0.16);
}

function updateFinalBossEffects(dt) {
  state.backgroundFlashTimer = Math.max(0, state.backgroundFlashTimer - dt);

  if (state.backgroundParticles.length) {
    state.backgroundParticles = state.backgroundParticles
      .map((particle) => ({
        ...particle,
        x: particle.x + particle.vx * dt,
        y: particle.y + particle.vy * dt,
        vy: particle.vy + particle.gravity * dt,
        age: particle.age + dt
      }))
      .filter((particle) => particle.age < particle.life);
  }

  if (!state.finalBossPrepTriggered) {
    return;
  }

  const musicElapsed = getFinalBossMusicElapsed();

  if (state.backgroundParticleEmitters.length) {
    const activeEmitters = [];

    for (const emitter of state.backgroundParticleEmitters) {
      if (musicElapsed >= emitter.endAt) {
        continue;
      }

      const nextEmitter = {
        ...emitter,
        timer: emitter.timer - dt
      };

      while (nextEmitter.timer <= 0) {
        spawnBackgroundParticles(nextEmitter.particleConfig);
        nextEmitter.timer += nextEmitter.interval;
      }

      activeEmitters.push(nextEmitter);
    }

    state.backgroundParticleEmitters = activeEmitters;
  }

  const cueEvents = getFinalBossEffectsConfig()?.cueEvents;
  if (!Array.isArray(cueEvents) || !cueEvents.length) {
    return;
  }
  for (const cueConfig of cueEvents) {
    const cueTime = Number(cueConfig?.time);
    if (!Number.isFinite(cueTime) || musicElapsed < cueTime) {
      continue;
    }

    triggerFinalBossCue(cueConfig);
  }
}

function updatePlayerPresentation() {
  const player = state.player;
  const baseWidth = Number(player.baseWidth || player.width || 0);
  const baseHeight = Number(player.baseHeight || player.height || 0);
  const scale = getFinalBossPlayerScale();

  if (!baseWidth || !baseHeight) {
    return;
  }

  player.width = baseWidth * scale;
  player.height = baseHeight * scale;
}

function getEffectiveItemWeight(itemType) {
  const baseWeight = Number(itemType?.weight || 0);
  const prepProgress = getFinalBossPrepProgress();

  if (!prepProgress || baseWeight <= 0) {
    return baseWeight;
  }

  if ((itemType.timeBonus ?? 0) > 0 || (itemType.heal ?? 0) > 0) {
    return baseWeight * lerp(1, 0.22, prepProgress);
  }

  if ((itemType.damage ?? 0) > 0 || (itemType.points ?? 0) < 0) {
    return baseWeight * lerp(1, 2.35, prepProgress);
  }

  if ((itemType.points ?? 0) > 0) {
    return baseWeight * lerp(1, 0.46, prepProgress);
  }

  return baseWeight;
}

function getLastSpawnAt(itemKey) {
  if (itemKey === "special1") {
    return state.lastSpecialSpawnAt;
  }

  if (itemKey === "heal1") {
    return state.lastHealSpawnAt;
  }

  return Number.NEGATIVE_INFINITY;
}

function rememberSpawn(itemKey) {
  if (itemKey === "special1") {
    state.lastSpecialSpawnAt = state.elapsed;
  }

  if (itemKey === "heal1") {
    state.lastHealSpawnAt = state.elapsed;
  }
}

function canSpawnItemType(itemType) {
  if ((itemType.minRound ?? 1) > state.round) {
    return false;
  }

  if ((itemType.minScore ?? 0) > state.score) {
    return false;
  }

  if ((itemType.maxScore ?? Number.POSITIVE_INFINITY) < state.score) {
    return false;
  }

  if (itemType.requiresMissingHealth && state.health >= state.maxHealth) {
    return false;
  }

  const activeCount = state.items.filter((item) => item.type.key === itemType.key).length;
  if (activeCount >= (itemType.maxActive ?? Number.POSITIVE_INFINITY)) {
    return false;
  }

  const withinCooldown = state.elapsed - getLastSpawnAt(itemType.key) < (itemType.spawnCooldown ?? 0);
  return !withinCooldown;
}

function chooseItemType() {
  const spawnableItemTypes = ITEM_TYPES.filter(canSpawnItemType);

  if (spawnableItemTypes.length) {
    return chooseWeightedItem(spawnableItemTypes);
  }

  return chooseWeightedItem(ITEM_TYPES.filter((itemType) => !itemType.requiresMissingHealth));
}

function isDangerItemType(itemType) {
  return (itemType?.damage ?? 0) > 0 || (itemType?.points ?? 0) < 0;
}

function getSpawnLaneCenter(minX, maxX, laneCount, laneIndex) {
  if (laneCount <= 1) {
    return (minX + maxX) / 2;
  }

  const ratio = laneIndex / Math.max(1, laneCount - 1);
  return lerp(minX, maxX, ratio);
}

function chooseBalancedDangerSpawnX(itemType, minX, maxX) {
  const spawnDistribution = getFinalBossSpawnDistributionConfig();
  if (!spawnDistribution?.balanceDangerItems || !isDangerItemType(itemType)) {
    return null;
  }

  const laneCount = clamp(Math.round(Number(spawnDistribution.laneCount) || 5), 3, 7);
  const recentMemory = clamp(Math.round(Number(spawnDistribution.recentMemory) || 4), 2, 8);
  const laneJitterRatio = clamp(Number(spawnDistribution.laneJitter) || 0.22, 0.08, 0.42);
  const recentLanes = state.recentDangerSpawnLanes.slice(-recentMemory);
  const lastRecentLane = recentLanes.length ? recentLanes[recentLanes.length - 1] : -1;
  const laneSpacing = laneCount <= 1 ? maxX - minX : (maxX - minX) / Math.max(1, laneCount - 1);
  const candidates = [];

  for (let laneIndex = 0; laneIndex < laneCount; laneIndex += 1) {
    const centerX = getSpawnLaneCenter(minX, maxX, laneCount, laneIndex);
    const recentPenalty = recentLanes.reduce((sum, recentLane, historyIndex) => {
      if (recentLane !== laneIndex) {
        return sum;
      }

      return sum + (recentLanes.length - historyIndex);
    }, 0);
    const activePenalty = state.items.reduce((sum, item) => {
      if (!isDangerItemType(item.type)) {
        return sum;
      }

      const influenceRadius = Math.max(item.type.radius * 2.1, laneSpacing * 0.72, 56);
      if (Math.abs(item.x - centerX) > influenceRadius) {
        return sum;
      }

      return sum + 1;
    }, 0);
    const score = recentPenalty * 2.4 + activePenalty * 4 + (lastRecentLane === laneIndex ? 3.4 : 0);

    candidates.push({
      laneIndex,
      centerX,
      score
    });
  }

  const lowestScore = Math.min(...candidates.map((candidate) => candidate.score));
  const bestCandidates = candidates.filter((candidate) => candidate.score <= lowestScore + 0.9);
  const chosenCandidate = bestCandidates[Math.floor(Math.random() * bestCandidates.length)] || candidates[0];
  const jitterRange = Math.max(14, laneSpacing * laneJitterRatio);
  const spawnX = clamp(chosenCandidate.centerX + randomRange(-jitterRange, jitterRange), minX, maxX);

  state.recentDangerSpawnLanes.push(chosenCandidate.laneIndex);
  if (state.recentDangerSpawnLanes.length > recentMemory) {
    state.recentDangerSpawnLanes = state.recentDangerSpawnLanes.slice(-recentMemory);
  }

  return spawnX;
}

function chooseSpawnX(itemType, horizontalMargin, requestedX) {
  const minX = PLAY_BOUNDS.left + horizontalMargin;
  const maxX = PLAY_BOUNDS.right - horizontalMargin;

  if (Number.isFinite(requestedX)) {
    return clamp(requestedX, minX, maxX);
  }

  return chooseBalancedDangerSpawnX(itemType, minX, maxX) ?? randomRange(minX, maxX);
}

function getNextSpawnDelay(roundDefinition, ratio) {
  return lerp(roundDefinition.spawnMax, roundDefinition.spawnMin, ratio) * randomRange(0.94, 1.08);
}

function createSpawnedItem(itemType, { x, y } = {}) {
  const ratio = getRoundProgressRatio();
  const roundDefinition = getRoundDefinition();
  const horizontalMargin = Math.max(itemType.radius + 10, itemType.size * 0.35);

  return {
    id: crypto.randomUUID(),
    type: itemType,
    x: chooseSpawnX(itemType, horizontalMargin, x),
    y: Number.isFinite(y) ? y : -itemType.size,
    speed: lerp(roundDefinition.speedMin, roundDefinition.speedMax, ratio) + randomRange(-roundDefinition.speedVariance, roundDefinition.speedVariance),
    drift: randomRange(roundDefinition.driftMin, roundDefinition.driftMax),
    wobble: Math.random() * Math.PI * 2,
    rotation: randomRange(-0.35, 0.35),
    spin: randomRange(-1.6, 1.6)
  };
}

function spawnItem() {
  const itemType = chooseItemType();
  state.items.push(createSpawnedItem(itemType));
  rememberSpawn(itemType.key);
}

function getPlayerHitbox() {
  const player = state.player;
  const hitboxWidth = player.width * (player.isSliding ? 0.58 : player.isCrouching ? 0.42 : 0.46);
  const hitboxHeight = player.height * (player.isSliding ? 0.42 : player.isCrouching ? 0.54 : 0.82);
  const topOffset = player.isSliding ? 116 : player.isCrouching ? 74 : 18;
  const forwardOffset = player.isSliding ? player.slideDirection * player.width * 0.08 : 0;

  return {
    x: player.x - hitboxWidth / 2 + forwardOffset,
    y: player.y - player.height + topOffset,
    width: hitboxWidth,
    height: hitboxHeight
  };
}

function circleIntersectsRect(circle, rect) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.height);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

function addFloatText(text, x, y, color, options = {}) {
  state.floatTexts.push({
    id: crypto.randomUUID(),
    text,
    x,
    y,
    age: 0,
    color,
    assetKey: typeof options.assetKey === "string" ? options.assetKey : "",
    iconSize: Math.max(0, Number(options.iconSize) || 0)
  });
}

function showTimeBonusToast({ bonusTime = 0, label = "" } = {}) {
  const safeBonusTime = Math.max(0, Math.floor(Number(bonusTime) || 0));
  if (!safeBonusTime) {
    return;
  }

  const safeLabel = String(label || "").trim();
  state.timeBonusToastText = safeLabel
    ? `${safeLabel} +${safeBonusTime}${t("hud.seconds")}`
    : `+${safeBonusTime}${t("hud.seconds")}`;
  state.timeBonusToastTimer = 1.9;
}

function canStompDangerItem(item, hitbox, itemCollisionScale, dt) {
  const stompRewardPoints = Number(item.type?.stompRewardPoints || 0);
  const player = state.player;

  if (stompRewardPoints <= 0 || player.onGround || player.isSliding || player.velocityY <= 140) {
    return false;
  }

  const itemRadius = item.type.radius * itemCollisionScale;
  const playerBottom = hitbox.y + hitbox.height;
  const previousPlayerBottom = playerBottom - player.velocityY * dt;
  const previousItemY = item.y - item.speed * dt;
  const hitboxCenterX = hitbox.x + hitbox.width / 2;
  const horizontalDistance = Math.abs(hitboxCenterX - item.x);
  const maxHorizontalDistance = hitbox.width * 0.24 + itemRadius * 0.58;
  const stompWindowTop = previousItemY - itemRadius * 0.92;
  const stompWindowBottom = item.y + itemRadius * 0.12;

  return previousPlayerBottom <= stompWindowTop
    && playerBottom <= stompWindowBottom
    && horizontalDistance <= maxHorizontalDistance;
}

function applyStompReward(item) {
  const stompRewardPoints = Math.max(0, Math.floor(Number(item.type?.stompRewardPoints) || 0));
  if (!stompRewardPoints) {
    return;
  }

  state.score += stompRewardPoints;
  activateFinalBossPrep();
  playItemSoundEffect("pickup");
  state.shake = Math.max(state.shake, 0.12);
  state.player.velocityY = -Math.max(420, Number(item.type?.stompBounceVelocity) || 540);
  state.player.onGround = false;
  addFloatText(`+${stompRewardPoints}`, item.x, item.y - item.type.size * 0.22, "#ffe7a8", {
    assetKey: "hujupayCoin",
    iconSize: 28
  });
}

function canSlideBreakDangerItem(item) {
  const slideRewardPoints = Number(item.type?.slideRewardPoints || 0);
  const player = state.player;

  return slideRewardPoints > 0
    && player.isSliding
    && !player.slideImpactConsumed
    && player.onGround;
}

function applySlideBreakReward(item) {
  const slideRewardPoints = Math.max(0, Math.floor(Number(item.type?.slideRewardPoints) || 0));
  if (!slideRewardPoints) {
    return;
  }

  state.score += slideRewardPoints;
  activateFinalBossPrep();
  playItemSoundEffect("pickup");
  state.shake = Math.max(state.shake, 0.14);
  state.player.slideImpactConsumed = true;
  addFloatText(`+${slideRewardPoints}`, item.x, item.y - item.type.size * 0.18, "#ffe7a8", {
    assetKey: "hujupayCoin",
    iconSize: 28
  });
}

function canSlideStunHeavyItem(item) {
  const slideStunDuration = Number(item.type?.slideStunDuration || 0);
  const player = state.player;

  return slideStunDuration > 0
    && player.isSliding
    && player.onGround;
}

function applySlideStun(item) {
  const slideStunDuration = Math.max(0, Number(item.type?.slideStunDuration) || 0);
  if (!slideStunDuration) {
    return;
  }

  const player = state.player;
  state.slideStunTimer = Math.max(state.slideStunTimer, slideStunDuration);
  state.slideStunVisualTimer = Math.max(state.slideStunVisualTimer, Math.min(0.7, slideStunDuration));
  state.shake = Math.max(state.shake, 0.22);
  playItemSoundEffect("damage");
  player.isSliding = false;
  player.slideTimer = 0;
  player.slideImpactConsumed = true;
  player.slideRecoveryTimer = Math.max(player.slideRecoveryTimer, slideStunDuration);
  player.velocityY = Math.min(player.velocityY, 0);
}

function activateFinalBossPrep() {
  if (state.finalBossPrepTriggered || !FINAL_BOSS_PREP_CONFIG.enabled || state.score < FINAL_BOSS_PREP_CONFIG.scoreThreshold) {
    return false;
  }

  const nextBackgroundKey = FINAL_BOSS_PREP_CONFIG.backgroundKey || state.roundBackgroundKey;
  const backgroundWillChange = nextBackgroundKey !== state.roundBackgroundKey;
  const currentTimeLeft = Math.max(0, state.timeLimit - state.elapsed);
  const minimumTimeLeft = Math.max(0, Number(FINAL_BOSS_PREP_CONFIG.minimumTimeLeft) || 0);
  const grantedBonusTime = Math.max(
    0,
    Number(FINAL_BOSS_PREP_CONFIG.bonusTime) || 0,
    minimumTimeLeft - currentTimeLeft
  );

  state.finalBossPrepTriggered = true;
  state.finalBossPrepStartedAt = state.elapsed;
  if (backgroundWillChange) {
    state.backgroundTransitionFromKey = state.roundBackgroundKey;
    state.backgroundTransitionStartAt = state.elapsed;
    state.backgroundTransitionDuration = FINAL_BOSS_PREP_CONFIG.backgroundFadeDuration || 0;
  }
  state.timeLimit += grantedBonusTime;
  state.timeLeft = Math.max(0, state.timeLimit - state.elapsed);
  state.roundLabelKey = FINAL_BOSS_PREP_CONFIG.labelKey || state.roundLabelKey;
  state.roundTransitionKey = FINAL_BOSS_PREP_CONFIG.transitionKey || state.roundTransitionKey;
  state.roundBackgroundKey = nextBackgroundKey;
  state.roundTransitionTimer = 3;
  state.spawnTimer = Math.min(state.spawnTimer, 0.58);
  state.shake = Math.max(state.shake, 0.14);
  addFloatText(t(state.roundLabelKey), PLAY_BOUNDS.left + 180, 148, "#fff4c2");
  addFloatText(`+${grantedBonusTime}${t("hud.seconds")}`, PLAY_BOUNDS.left + 190, 194, "#ffeab6");
  showTimeBonusToast({ bonusTime: grantedBonusTime, label: t(state.roundLabelKey) });
  playBossPrepMusic();
  return true;
}

function applyItemEffect(item) {
  const pointDelta = item.type.points ?? 0;
  const timeBonus = item.type.timeBonus ?? 0;
  const heal = item.type.heal ?? 0;
  const damage = item.type.damage ?? 0;
  const triggersHappyPose = pointDelta >= 32
    && timeBonus <= 0
    && heal <= 0
    && damage <= 0
    && item.type.soundKey === "pickup";

  state.score += pointDelta;
  activateFinalBossPrep();
  playItemSoundEffect(item.type.soundKey);

  if (triggersHappyPose) {
    state.yummyTimer = 0.55;
  }

  if (heal > 0) {
    state.health = Math.min(state.maxHealth, state.health + heal);
    state.shake = 0.08;
    addFloatText(`+${heal}HP`, item.x, item.y - item.type.size * 0.18, item.type.color);
    return;
  }

  if (timeBonus > 0) {
    state.timeLimit += timeBonus;
    state.timeLeft = Math.max(0, state.timeLimit - state.elapsed);
    state.shake = 0.16;
    addFloatText(`+${timeBonus}${t("hud.seconds")}`, item.x, item.y - item.type.size * 0.18, item.type.color);
    showTimeBonusToast({ bonusTime: timeBonus, label: t("item.special1") });
    return;
  }

  if (pointDelta >= 0) {
    state.shake = 0.12;
    addFloatText(`+${pointDelta}`, item.x, item.y - item.type.size * 0.18, item.type.color);
    return;
  }

  state.shake = 0.2;
  state.damageTimer = 0.65;
  state.health = Math.max(0, state.health - damage);
  addFloatText(String(pointDelta), item.x, item.y - item.type.size * 0.18, item.type.color);
  addFloatText(`-${damage}HP`, item.x, item.y + item.type.size * 0.1, "#fff5f3");
}

function getResultNoticeText() {
  if (isRankingClosed()) {
    return t("result.rankingClosed");
  }

  if (state.lastRank === 1 && state.isNewBest) {
    return t("result.newBestTop");
  }

  if (state.lastRank === 1) {
    return t("result.rankOne");
  }

  if (state.isNewBest) {
    return t("result.newBest");
  }

  return "";
}

async function persistSeasonSummary(payload) {
  if (!state.authUser?.uid || !payload?.currentEntry) {
    return null;
  }

  try {
    const summary = await saveSeasonSummary({
      uid: state.authUser.uid,
      season: payload.season,
      playerId: payload.currentEntry.playerId || state.playerId,
      nickname: payload.currentEntry.name || state.nickname,
      score: payload.currentEntry.score,
      rank: payload.rank,
      submittedAt: payload.currentEntry.submittedAt
    });

    if (summary) {
      state.hujupayBalance = Number.isFinite(summary.hujupayBalance) ? summary.hujupayBalance : state.hujupayBalance;
      state.hujupayEarnedTotal = Number.isFinite(summary.hujupayEarnedTotal) ? summary.hujupayEarnedTotal : state.hujupayEarnedTotal;
    }

    return summary;
  } catch (error) {
    console.warn("Failed to persist season summary.", error);
    return null;
  }
}

async function submitScore() {
  if (isPlaytestMode()) {
    state.lastRank = null;
    state.isNewBest = false;
    setRankingStatus("");
    return;
  }

  if (isRankingClosed()) {
    state.lastRank = null;
    state.isNewBest = false;
    setRankingStatus(getRankingClosureNotice());
    return;
  }

  const payload = await submitScoreToProvider({
    playerId: state.playerId,
    uid: state.authUser?.uid || "",
    name: state.nickname,
    score: state.score
  });

  const seasonSummary = await persistSeasonSummary(payload);
  state.rankings = Array.isArray(payload.rankings) ? payload.rankings : [];
  state.lastRank = payload.rank || null;
  state.isNewBest = Boolean(payload.accepted);
  renderRankingList(state.rankings);
  const rewardedAmount = Number.isFinite(seasonSummary?.rewardedAmount) ? seasonSummary.rewardedAmount : 0;
  const baseStatus = payload.accepted ? t("ranking.saved") : t("ranking.kept");
  const rewardStatus = rewardedAmount > 0 ? ` | ${t("wallet.title")} +${rewardedAmount}` : "";
  setRankingStatus(`${baseStatus}${rewardStatus}`);
}

export async function fetchRankings({ background = false } = {}) {
  if (isPlaytestMode()) {
    state.rankings = [];
    renderRankingList(state.rankings);
    if (!background) {
      setRankingStatus("Playtest mode: rankings are disabled.");
    }
    return;
  }

  if (!background) {
    setRankingStatus(t("ranking.loading"));
  }

  try {
    const payload = await fetchRankingsFromProvider();
    state.rankings = Array.isArray(payload.rankings) ? payload.rankings : [];
    renderRankingList(state.rankings);
    if (!background) {
      setRankingStatus(isRankingClosed() ? getRankingClosureNotice() : (state.rankings.length ? t("ranking.best") : t("ranking.empty")));
    }
  } catch {
    if (!background) {
      setRankingStatus(t("ranking.failed"));
    }
  }
}

export function startRound(name) {
  resetRound(name);
}

export function applyPlaytestState({
  score,
  elapsed,
  timeLeft,
  round,
  health,
  spawnTimer
} = {}) {
  if (Number.isFinite(score)) {
    state.score = Math.max(0, Math.floor(score));
  }

  if (Number.isFinite(elapsed)) {
    state.elapsed = Math.max(0, elapsed);
  }

  if (Number.isFinite(round)) {
    const safeRound = Math.max(1, Math.min(ROUND_DEFINITIONS.length, Math.floor(round)));
    const roundDefinition = ROUND_DEFINITIONS[safeRound - 1] || ROUND_DEFINITIONS[0];
    state.round = safeRound;
    state.elapsed = Math.max(state.elapsed, roundDefinition?.startsAt || 0);
    state.roundLabelKey = roundDefinition.labelKey;
    state.roundTransitionKey = roundDefinition.transitionKey;
    state.roundBackgroundKey = roundDefinition.backgroundKey;
  }

  if (Number.isFinite(timeLeft)) {
    state.timeLeft = Math.max(1, timeLeft);
    state.timeLimit = state.elapsed + state.timeLeft;
  } else {
    state.timeLeft = Math.max(0, state.timeLimit - state.elapsed);
  }

  if (Number.isFinite(health)) {
    state.health = clamp(Math.floor(health), 1, state.maxHealth);
  }

  if (Number.isFinite(spawnTimer)) {
    state.spawnTimer = Math.max(0.05, spawnTimer);
  }

  updateRoundState();
  activateFinalBossPrep();
  updateBackgroundStageState({ allowBonus: false, forceSync: true });
}

export function spawnPlaytestItemByKey(key, { x, y } = {}) {
  const itemType = ITEM_TYPES.find((candidate) => candidate.key === key);
  if (!itemType) {
    return false;
  }

  state.items.push(createSpawnedItem(itemType, { x, y }));
  rememberSpawn(itemType.key);
  return true;
}

export async function finishGame() {
  if (state.phase !== "playing") {
    return;
  }

  state.resultSceneX = state.player.x;
  state.resultSceneY = state.player.y;
  state.resultSceneKey = "gameOver";
  state.phase = "submitting";
  hideGameResult();
  setTouchControlsVisible(false);
  const sceneDelay = wait(RESULT_SCENE_DELAY_MS);

  try {
    await submitScore();
    if (state.isNewBest || state.lastRank === 1) {
      state.resultSceneKey = "rankOne";
    }
    await sceneDelay;
    state.phase = "finished";
    showGameResult({
      eyebrow: t("result.eyebrow"),
      title: t("result.title"),
      noticeText: getResultNoticeText(),
      score: state.score,
      rankText: state.lastRank ? `#${state.lastRank}` : "-",
      restartLabel: t("result.restart"),
      restartDisabled: false,
      lobbyDisabled: false
    });
  } catch {
    await sceneDelay;
    state.phase = "finished";
    showGameResult({
      eyebrow: t("result.eyebrow"),
      title: t("result.title"),
      noticeText: "",
      score: state.score,
      rankText: t("result.fail"),
      restartLabel: t("result.restart"),
      restartDisabled: false,
      lobbyDisabled: false
    });
  }
}

function tryStartSlide(direction = 0) {
  const player = state.player;

  if (state.phase !== "playing" || !player.onGround || player.isSliding) {
    return false;
  }

  if (state.elapsed < player.slideCooldownUntil) {
    return false;
  }

  const resolvedDirection = direction || (state.input.right ? 1 : state.input.left ? -1 : player.facing || 1);
  player.isSliding = true;
  player.slideTimer = SLIDE_DURATION;
  player.slideCooldownUntil = state.elapsed + SLIDE_COOLDOWN;
  player.slideDirection = resolvedDirection < 0 ? -1 : 1;
  player.slideRecoveryTimer = 0;
  player.slideImpactConsumed = false;
  player.facing = player.slideDirection;
  player.isCrouching = false;
  player.walkTime = 0;
  state.input.down = false;
  return true;
}

export function triggerSlide(direction = 0) {
  return tryStartSlide(direction);
}

export function handleMovementKey(code, isDown, options = {}) {
  const trackTap = options.trackTap !== false;
  const repeat = Boolean(options.repeat);

  if (code === "ArrowLeft" || code === "KeyA") {
    state.input.left = isDown;

    if (isDown && trackTap && !repeat) {
      const tappedAt = state.input.leftTapAt;
      state.input.leftTapAt = state.elapsed;
      if (state.elapsed - tappedAt <= SLIDE_DOUBLE_TAP_WINDOW) {
        tryStartSlide(-1);
      }
    }
  }

  if (code === "ArrowRight" || code === "KeyD") {
    state.input.right = isDown;

    if (isDown && trackTap && !repeat) {
      const tappedAt = state.input.rightTapAt;
      state.input.rightTapAt = state.elapsed;
      if (state.elapsed - tappedAt <= SLIDE_DOUBLE_TAP_WINDOW) {
        tryStartSlide(1);
      }
    }
  }

  if (code === "ArrowDown" || code === "KeyS") {
    state.input.down = false;
  }

  if (isDown && (code === "ArrowUp" || code === "KeyW" || code === "Space") && !state.player.isSliding) {
    state.input.jumpQueued = true;
  }
}

function updatePlayer(dt) {
  const player = state.player;
  const isSlideStunned = state.slideStunTimer > 0;
  const direction = Number(state.input.right) - Number(state.input.left);
  const speedMultiplier = getFinalBossMovementSpeedMultiplier();

  player.isCrouching = false;
  player.slideRecoveryTimer = Math.max(0, player.slideRecoveryTimer - dt);

  if (isSlideStunned) {
    player.isSliding = false;
    player.slideTimer = 0;
    player.walkTime = 0;
  } else if (player.isSliding) {
    player.x += player.slideDirection * player.speed * SLIDE_SPEED_MULTIPLIER * speedMultiplier * dt;
    player.slideTimer = Math.max(0, player.slideTimer - dt);
    player.walkTime = 0;
  } else {
    if (player.slideRecoveryTimer > 0) {
      player.walkTime = 0;
    }

    if (direction !== 0) {
      player.facing = direction;
      if (player.slideRecoveryTimer <= 0) {
        player.walkTime += dt * 10;
      }
    } else if (player.slideRecoveryTimer <= 0) {
      player.walkTime = 0;
    }

    player.x += direction * player.speed * speedMultiplier * dt;
  }

  player.x = clamp(player.x, PLAY_BOUNDS.left, PLAY_BOUNDS.right);

  if (!isSlideStunned && state.input.jumpQueued && player.onGround && !player.isSliding) {
    player.velocityY = -player.jumpPower;
    player.onGround = false;
    state.shake = 0.08;
  }

  state.input.jumpQueued = false;
  player.velocityY += player.gravity * dt;
  player.y += player.velocityY * dt;

  if (player.y >= GROUND_Y) {
    player.y = GROUND_Y;
    player.velocityY = 0;
    player.onGround = true;
  } else {
    player.isCrouching = false;
    player.isSliding = false;
    player.slideTimer = 0;
    player.slideRecoveryTimer = 0;
    player.slideImpactConsumed = false;
  }

  if (player.isSliding && player.slideTimer <= 0) {
    player.isSliding = false;
    player.slideRecoveryTimer = SLIDE_RECOVERY_DURATION;
    player.slideImpactConsumed = false;
  }
}

function updateItems(dt) {
  const ratio = getRoundProgressRatio();
  const roundDefinition = getRoundDefinition();
  const itemCollisionScale = getFinalBossItemCollisionScale();
  state.spawnTimer -= dt;

  if (state.spawnTimer <= 0) {
    if (state.items.length < roundDefinition.maxActiveItems) {
      spawnItem();
      state.spawnTimer = getNextSpawnDelay(roundDefinition, ratio);
    } else {
      state.spawnTimer = 0.12;
    }
  }

  const hitbox = getPlayerHitbox();
  const nextItems = [];

  for (const item of state.items) {
    item.y += item.speed * dt;
    item.x += Math.sin(state.elapsed * 2 + item.wobble) * item.drift * dt;
    item.rotation += item.spin * dt;

    const collided = circleIntersectsRect(
      {
        x: item.x,
        y: item.y,
        radius: item.type.radius * itemCollisionScale
      },
      hitbox
    );

    if (collided) {
      if (canStompDangerItem(item, hitbox, itemCollisionScale, dt)) {
        applyStompReward(item);
        continue;
      }

      if (canSlideStunHeavyItem(item)) {
        applySlideStun(item);
        continue;
      }

      if (canSlideBreakDangerItem(item)) {
        applySlideBreakReward(item);
        continue;
      }

      if ((item.type.damage ?? 0) > 0 && state.damageTimer > 0) {
        continue;
      }

      applyItemEffect(item);

      if (state.health <= 0) {
        state.items = nextItems;
        return;
      }

      continue;
    }

    if (item.y - item.type.size > VIRTUAL_HEIGHT + 80) {
      continue;
    }

    nextItems.push(item);
  }

  state.items = nextItems;
}

function updateRoundState() {
  if (state.finalBossPrepTriggered && FINAL_BOSS_PREP_CONFIG.roundOverride) {
    return;
  }

  let nextRound = state.round;

  for (const roundDefinition of ROUND_DEFINITIONS) {
    if (state.elapsed >= roundDefinition.startsAt) {
      nextRound = roundDefinition.round;
    }
  }

  if (nextRound !== state.round) {
    state.round = nextRound;
    const roundDefinition = getRoundDefinition();
    const nextBackgroundKey = roundDefinition.backgroundKey || state.roundBackgroundKey;
    const backgroundChanged = nextBackgroundKey !== state.roundBackgroundKey;
    const bonusTime = Math.max(0, Number(roundDefinition.bonusTime) || 0);
    state.roundLabelKey = roundDefinition.labelKey;
    state.roundTransitionKey = roundDefinition.transitionKey;
    if (!BACKGROUND_SCORE_STAGES.length) {
      state.roundBackgroundKey = roundDefinition.backgroundKey;
    }
    if (BACKGROUND_SCORE_STAGES.length && backgroundChanged) {
      state.backgroundTransitionFromKey = state.roundBackgroundKey;
      state.backgroundTransitionStartAt = state.elapsed;
      state.backgroundTransitionDuration = Math.max(0, Number(roundDefinition.transitionDuration) || 0);
      state.roundBackgroundKey = nextBackgroundKey;
    }
    state.roundTransitionTimer = 2.4;
    state.spawnTimer = Math.max(state.spawnTimer, roundDefinition.spawnMax * 0.78);
    state.shake = 0.16;
    addFloatText(t(state.roundLabelKey), PLAY_BOUNDS.left + 160, 152, "#fff7d1");
    if (bonusTime > 0) {
      state.timeLimit += bonusTime;
      state.timeLeft = Math.max(0, state.timeLimit - state.elapsed);
      addFloatText(`+${bonusTime}${t("hud.seconds")}`, PLAY_BOUNDS.left + 176, 194, "#ffe7bb");
      showTimeBonusToast({ bonusTime, label: t(state.roundLabelKey) });
    }
  }
}

function getActiveBackgroundStage() {
  if (!BACKGROUND_SCORE_STAGES.length) {
    return null;
  }

  let activeStage = null;
  for (const stage of BACKGROUND_SCORE_STAGES) {
    if (state.score >= stage.minScore) {
      activeStage = stage;
    }
  }

  return activeStage;
}

function updateBackgroundStageState({ allowBonus = true, forceSync = false } = {}) {
  if (!BACKGROUND_SCORE_STAGES.length) {
    return;
  }

  const activeStage = getActiveBackgroundStage();
  if (!activeStage) {
    return;
  }

  const currentStageMinScore = Number(state.backgroundStageMinScore || 0);
  const nextStage = forceSync || activeStage.minScore > currentStageMinScore
    ? activeStage
    : BACKGROUND_SCORE_STAGES.find((stage) => stage.minScore === currentStageMinScore) || activeStage;

  const nextStageMinScore = Number(nextStage.minScore || 0);
  const nextBackgroundKey = nextStage.backgroundKey || state.roundBackgroundKey;
  const previousBackgroundKey = state.roundBackgroundKey;
  const stageAdvanced = nextStageMinScore > currentStageMinScore;
  const backgroundChanged = nextBackgroundKey !== previousBackgroundKey;

  if (!forceSync && !stageAdvanced && !backgroundChanged) {
    return;
  }

  if (backgroundChanged) {
    state.backgroundTransitionFromKey = previousBackgroundKey;
    state.backgroundTransitionStartAt = state.elapsed;
    state.backgroundTransitionDuration = Math.max(0, Number(nextStage.transitionDuration) || 0);
  }

  state.backgroundStageMinScore = nextStageMinScore;
  state.roundBackgroundKey = nextBackgroundKey;

  if (!allowBonus || !stageAdvanced) {
    return;
  }

  const bonusTime = Math.max(0, Number(nextStage.bonusTime) || 0);
  if (!bonusTime || state.awardedBackgroundStageThresholds.includes(nextStageMinScore)) {
    return;
  }

  state.awardedBackgroundStageThresholds = [...state.awardedBackgroundStageThresholds, nextStageMinScore];
  state.timeLimit += bonusTime;
  state.timeLeft = Math.max(0, state.timeLimit - state.elapsed);
  state.shake = Math.max(state.shake, 0.12);
  addFloatText(`+${bonusTime}${t("hud.seconds")}`, PLAY_BOUNDS.left + 176, 180, "#ffe7bb");
  showTimeBonusToast({ bonusTime });
}

function updateFloatTexts(dt) {
  state.floatTexts = state.floatTexts
    .map((floatText) => ({
      ...floatText,
      y: floatText.y - 50 * dt,
      age: floatText.age + dt
    }))
    .filter((floatText) => floatText.age <= 0.9);
}

export function updateGame(dt) {
  if (state.phase !== "playing") {
    return;
  }

  state.elapsed += dt;
  state.timeLeft = Math.max(0, state.timeLimit - state.elapsed);
  state.shake = Math.max(0, state.shake - dt * 0.5);
  state.damageTimer = Math.max(0, state.damageTimer - dt);
  state.yummyTimer = Math.max(0, state.yummyTimer - dt);
  state.roundTransitionTimer = Math.max(0, state.roundTransitionTimer - dt);
  state.timeBonusToastTimer = Math.max(0, state.timeBonusToastTimer - dt);
  state.slideStunTimer = Math.max(0, state.slideStunTimer - dt);
  state.slideStunVisualTimer = Math.max(0, state.slideStunVisualTimer - dt);
  if (state.timeBonusToastTimer <= 0) {
    state.timeBonusToastText = "";
  }

  if (state.backgroundTransitionFromKey) {
    const backgroundBlendDone = state.elapsed - state.backgroundTransitionStartAt >= state.backgroundTransitionDuration;
    if (backgroundBlendDone) {
      state.backgroundTransitionFromKey = "";
      state.backgroundTransitionStartAt = Number.NEGATIVE_INFINITY;
      state.backgroundTransitionDuration = 0;
    }
  }

  updateRoundState();
  updateBackgroundStageState();
  activateFinalBossPrep();
  updateFinalBossEffects(dt);
  updatePlayerPresentation();

  updatePlayer(dt);
  updateItems(dt);
  updateFloatTexts(dt);

  if (state.health <= 0) {
    finishGame();
    return;
  }

  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    finishGame();
  }
}
