import { PLAY_BOUNDS, VIRTUAL_HEIGHT, GAME_DURATION, GROUND_Y } from "./constants.js";
import { ITEM_TYPES } from "./config/items.js";
import { ROUND_DEFINITIONS } from "./config/progression.js";
import { t } from "./i18n.js";
import { fetchRankingsFromProvider, submitScoreToProvider } from "./ranking-service.js";
import { state, resetRound } from "./state.js";
import { renderRankingList, setRankingStatus, showGameResult } from "./ui.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start, end, ratio) {
  return start + (end - start) * ratio;
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function chooseWeightedItem(itemTypes) {
  const totalWeight = itemTypes.reduce((sum, itemType) => sum + itemType.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const itemType of itemTypes) {
    roll -= itemType.weight;
    if (roll <= 0) {
      return itemType;
    }
  }

  return itemTypes[itemTypes.length - 1];
}

function getRoundDefinition() {
  return ROUND_DEFINITIONS[state.round - 1] || ROUND_DEFINITIONS[0];
}

function getRoundProgressRatio() {
  const currentRound = getRoundDefinition();
  const nextRound = ROUND_DEFINITIONS[state.round] || null;
  const roundEnd = nextRound ? nextRound.startsAt : GAME_DURATION;
  return clamp((state.elapsed - currentRound.startsAt) / Math.max(1, roundEnd - currentRound.startsAt), 0, 1);
}

function chooseItemType() {
  let itemType = chooseWeightedItem(ITEM_TYPES);

  if (itemType.key === "special1") {
    const activeCount = state.items.filter((item) => item.type.key === itemType.key).length;
    const withinCooldown = state.elapsed - state.lastSpecialSpawnAt < (itemType.spawnCooldown ?? 0);

    if (activeCount >= (itemType.maxActive ?? Number.POSITIVE_INFINITY) || withinCooldown) {
      itemType = chooseWeightedItem(ITEM_TYPES.filter((candidate) => candidate.key !== itemType.key));
    }
  }

  return itemType;
}

function getNextSpawnDelay(roundDefinition, ratio) {
  return lerp(roundDefinition.spawnMax, roundDefinition.spawnMin, ratio) * randomRange(0.94, 1.08);
}

function spawnItem() {
  const itemType = chooseItemType();
  const ratio = getRoundProgressRatio();
  const roundDefinition = getRoundDefinition();
  const horizontalMargin = Math.max(itemType.radius + 10, itemType.size * 0.35);

  state.items.push({
    id: crypto.randomUUID(),
    type: itemType,
    x: randomRange(PLAY_BOUNDS.left + horizontalMargin, PLAY_BOUNDS.right - horizontalMargin),
    y: -itemType.size,
    speed: lerp(roundDefinition.speedMin, roundDefinition.speedMax, ratio) + randomRange(-roundDefinition.speedVariance, roundDefinition.speedVariance),
    drift: randomRange(roundDefinition.driftMin, roundDefinition.driftMax),
    wobble: Math.random() * Math.PI * 2,
    rotation: randomRange(-0.35, 0.35),
    spin: randomRange(-1.6, 1.6)
  });

  if (itemType.key === "special1") {
    state.lastSpecialSpawnAt = state.elapsed;
  }
}

function getPlayerHitbox() {
  const player = state.player;
  return {
    x: player.x - player.width * 0.23,
    y: player.y - player.height + 18,
    width: player.width * 0.46,
    height: player.height * 0.82
  };
}

function circleIntersectsRect(circle, rect) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.height);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

function addFloatText(text, x, y, color) {
  state.floatTexts.push({
    id: crypto.randomUUID(),
    text,
    x,
    y,
    age: 0,
    color
  });
}

function applyItemEffect(item) {
  const pointDelta = item.type.points ?? 0;
  const timeBonus = item.type.timeBonus ?? 0;
  const damage = item.type.damage ?? 0;
  state.score += pointDelta;

  if (timeBonus > 0) {
    state.timeLimit += timeBonus;
    state.timeLeft = Math.max(0, state.timeLimit - state.elapsed);
    state.shake = 0.16;
    addFloatText(`+${timeBonus}${t("hud.seconds")}`, item.x, item.y - item.type.size * 0.18, item.type.color);
    return;
  }

  if (pointDelta >= 0) {
    state.shake = 0.12;
    addFloatText(`+${pointDelta}`, item.x, item.y - item.type.size * 0.18, item.type.color);
    return;
  }

  state.shake = 0.2;
  state.damageTimer = 0.55;
  state.health = Math.max(0, state.health - damage);
  addFloatText(String(pointDelta), item.x, item.y - item.type.size * 0.18, item.type.color);
  addFloatText(`-${damage}HP`, item.x, item.y + item.type.size * 0.1, "#fff5f3");
}

function getResultNoticeText() {
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

async function submitScore() {
  const payload = await submitScoreToProvider({
    name: state.nickname,
    score: state.score
  });

  state.rankings = Array.isArray(payload.rankings) ? payload.rankings : [];
  state.lastRank = payload.rank || null;
  state.isNewBest = Boolean(payload.accepted);
  renderRankingList(state.rankings);
  setRankingStatus(payload.accepted ? t("ranking.saved") : t("ranking.kept"));
}

export async function fetchRankings({ background = false } = {}) {
  if (!background) {
    setRankingStatus(t("ranking.loading"));
  }

  try {
    const payload = await fetchRankingsFromProvider();
    state.rankings = Array.isArray(payload.rankings) ? payload.rankings : [];
    renderRankingList(state.rankings);
    if (!background) {
      setRankingStatus(state.rankings.length ? t("ranking.best") : t("ranking.empty"));
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

export async function finishGame() {
  if (state.phase !== "playing") {
    return;
  }

  state.phase = "submitting";
  showGameResult({
    eyebrow: t("result.eyebrow"),
    title: t("result.saving"),
    noticeText: "",
    score: state.score,
    rankText: "...",
    restartLabel: t("result.saving"),
    restartDisabled: true,
    lobbyDisabled: true
  });

  try {
    await submitScore();
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

export function handleMovementKey(code, isDown) {
  if (code === "ArrowLeft" || code === "KeyA") {
    state.input.left = isDown;
  }

  if (code === "ArrowRight" || code === "KeyD") {
    state.input.right = isDown;
  }

  if (isDown && (code === "ArrowUp" || code === "KeyW" || code === "Space")) {
    state.input.jumpQueued = true;
  }
}

function updatePlayer(dt) {
  const player = state.player;
  const direction = Number(state.input.right) - Number(state.input.left);

  if (direction !== 0) {
    player.facing = direction;
    player.walkTime += dt * 10;
  } else {
    player.walkTime = 0;
  }

  player.x += direction * player.speed * dt;
  player.x = clamp(player.x, PLAY_BOUNDS.left, PLAY_BOUNDS.right);

  if (state.input.jumpQueued && player.onGround) {
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
  }
}

function updateItems(dt) {
  const ratio = getRoundProgressRatio();
  const roundDefinition = getRoundDefinition();
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
        radius: item.type.radius
      },
      hitbox
    );

    if (collided) {
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
  let nextRound = state.round;

  for (const roundDefinition of ROUND_DEFINITIONS) {
    if (state.elapsed >= roundDefinition.startsAt) {
      nextRound = roundDefinition.round;
    }
  }

  if (nextRound !== state.round) {
    state.round = nextRound;
    const roundDefinition = getRoundDefinition();
    state.roundLabelKey = roundDefinition.labelKey;
    state.roundTransitionKey = roundDefinition.transitionKey;
    state.roundBackgroundKey = roundDefinition.backgroundKey;
    state.roundTransitionTimer = 2.4;
    state.spawnTimer = Math.max(state.spawnTimer, roundDefinition.spawnMax * 0.78);
    state.shake = 0.16;
    addFloatText(t(state.roundLabelKey), PLAY_BOUNDS.left + 160, 152, "#fff7d1");
  }
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
  state.roundTransitionTimer = Math.max(0, state.roundTransitionTimer - dt);

  updateRoundState();

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
