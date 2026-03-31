import { elements } from "./dom.js";
import { GROUND_Y, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from "./constants.js";
import { t } from "./i18n.js";
import { state } from "./state.js";

const ctx = elements.canvas.getContext("2d");

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function drawBackground() {
  ctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

  const background = state.assets?.[state.roundBackgroundKey];

  if (!background) {
    ctx.fillStyle = "#eadccf";
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    return;
  }

  const image = background;
  const imageRatio = image.width / image.height;
  const canvasRatio = VIRTUAL_WIDTH / VIRTUAL_HEIGHT;

  let drawWidth = VIRTUAL_WIDTH;
  let drawHeight = VIRTUAL_HEIGHT;
  let offsetX = 0;
  let offsetY = 0;

  if (imageRatio > canvasRatio) {
    drawHeight = VIRTUAL_HEIGHT;
    drawWidth = drawHeight * imageRatio;
    offsetX = (VIRTUAL_WIDTH - drawWidth) / 2;
  } else {
    drawWidth = VIRTUAL_WIDTH;
    drawHeight = drawWidth / imageRatio;
    offsetY = (VIRTUAL_HEIGHT - drawHeight) / 2;
  }

  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

  const tint = ctx.createLinearGradient(0, 0, 0, VIRTUAL_HEIGHT);
  tint.addColorStop(0, "rgba(255, 252, 247, 0.10)");
  tint.addColorStop(1, "rgba(58, 29, 10, 0.14)");
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
}

function drawRoundBanner() {
  if (!state.roundLabelKey) {
    return;
  }

  ctx.save();
  ctx.fillStyle = "rgba(49, 28, 18, 0.18)";
  roundRect(ctx, VIRTUAL_WIDTH / 2 - 108, 24, 216, 54, 22);
  ctx.fill();

  ctx.fillStyle = "#fff8ef";
  ctx.font = '800 28px "Do Hyeon", "Noto Sans KR", "Noto Sans JP", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(t(state.roundLabelKey), VIRTUAL_WIDTH / 2, 59);
  ctx.restore();
}

function drawStageAccent() {
  ctx.save();
  const gradient = ctx.createLinearGradient(0, VIRTUAL_HEIGHT, 0, VIRTUAL_HEIGHT - 220);
  gradient.addColorStop(0, "rgba(255, 214, 156, 0.22)");
  gradient.addColorStop(1, "rgba(255, 214, 156, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, VIRTUAL_HEIGHT - 220, VIRTUAL_WIDTH, 220);
  ctx.restore();
}

function drawHudCard(x, y, width, height, label, value, align = "left") {
  const textX =
    align === "left"
      ? x + 20
      : align === "right"
        ? x + width - 20
        : x + width / 2;

  ctx.save();
  ctx.fillStyle = "rgba(45, 27, 18, 0.22)";
  roundRect(ctx, x, y, width, height, 26);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 246, 235, 0.88)";
  ctx.font = '700 18px "Noto Sans KR", "Noto Sans JP", sans-serif';
  ctx.textAlign = align;
  ctx.fillText(label, textX, y + 28);

  ctx.fillStyle = "#ffffff";
  ctx.font = '800 34px "Do Hyeon", "Noto Sans KR", "Noto Sans JP", sans-serif';
  ctx.fillText(value, textX, y + 62);
  ctx.restore();
}

function drawHealthBar() {
  const x = VIRTUAL_WIDTH / 2 - 120;
  const y = 98;
  const width = 240;
  const height = 18;
  const radius = height / 2;
  const ratio = clamp(state.health / Math.max(1, state.maxHealth), 0, 1);
  const isCritical = state.health <= 1;
  const badgeX = x + width + 18;
  const badgeY = y - 8;
  const badgeWidth = 72;
  const badgeHeight = 34;

  ctx.save();

  ctx.fillStyle = "rgba(45, 27, 18, 0.26)";
  roundRect(ctx, x - 10, y - 10, width + 20, height + 20, 18);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 244, 236, 0.18)";
  roundRect(ctx, x, y, width, height, radius);
  ctx.fill();

  const fillWidth = Math.max(0, width * ratio);
  if (fillWidth > 0) {
    const gradient = ctx.createLinearGradient(x, y, x + width, y);
    if (isCritical) {
      gradient.addColorStop(0, "#d93b32");
      gradient.addColorStop(0.55, "#f3584f");
      gradient.addColorStop(1, "#ff8b82");
    } else {
      gradient.addColorStop(0, "#4cc85b");
      gradient.addColorStop(0.55, "#74e06e");
      gradient.addColorStop(1, "#b6ff9d");
    }
    ctx.fillStyle = gradient;
    roundRect(ctx, x, y, fillWidth, height, Math.min(radius, fillWidth / 2));
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(255, 248, 240, 0.16)";
  ctx.lineWidth = 1;
  for (let index = 1; index < state.maxHealth; index += 1) {
    const segmentX = x + (width / state.maxHealth) * index;
    ctx.beginPath();
    ctx.moveTo(segmentX, y + 2);
    ctx.lineTo(segmentX, y + height - 2);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255, 248, 240, 0.34)";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, width, height, radius);
  ctx.stroke();

  ctx.fillStyle = "rgba(45, 27, 18, 0.32)";
  roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 16);
  ctx.fill();

  ctx.fillStyle = "#fff8ef";
  ctx.font = '800 24px "Do Hyeon", "Noto Sans KR", "Noto Sans JP", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${state.health}`, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2 + 1);

  ctx.restore();
}

function drawTopHud() {
  drawHudCard(24, 24, 196, 84, t("hud.score"), String(state.score));
  drawHudCard(VIRTUAL_WIDTH - 220, 24, 196, 84, t("hud.time"), `${state.timeLeft.toFixed(1)}${t("hud.seconds")}`, "right");
  drawHealthBar();
}

function getPlayerSprite() {
  if (!state.assets) {
    return null;
  }

  if (state.damageTimer > 0) {
    return state.assets.damage;
  }

  if (!state.player.onGround) {
    return state.assets.jump;
  }

  if (state.input.left || state.input.right) {
    return Math.floor(state.player.walkTime) % 2 === 0 ? state.assets.walk1 : state.assets.walk2;
  }

  return state.assets.idle;
}

function drawPlayer() {
  const player = state.player;
  const sprite = getPlayerSprite();

  ctx.save();
  ctx.fillStyle = "rgba(35, 18, 14, 0.18)";
  ctx.beginPath();
  ctx.ellipse(player.x, GROUND_Y + 10, 78, 17, 0, 0, Math.PI * 2);
  ctx.fill();

  if (sprite) {
    const drawX = player.x - player.width / 2;
    const drawY = player.y - player.height;
    ctx.translate(player.x, 0);
    ctx.scale(player.facing, 1);
    ctx.translate(-player.x, 0);
    ctx.drawImage(sprite, drawX, drawY, player.width, player.height);
  }

  ctx.restore();
}

function drawItems() {
  if (!state.assets) {
    return;
  }

  for (const item of state.items) {
    const sprite = state.assets[item.type.key];
    const shadowScale = clamp((item.y + item.type.size) / VIRTUAL_HEIGHT, 0.15, 0.9);

    ctx.save();
    ctx.fillStyle = `rgba(30, 16, 11, ${0.08 + shadowScale * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(
      item.x,
      GROUND_Y + 15,
      item.type.radius * shadowScale,
      item.type.radius * 0.28 * shadowScale,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();

    if (!sprite) {
      continue;
    }

    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rotation);

    if (item.type.sourceCrop) {
      const { x, y, width, height } = item.type.sourceCrop;
      ctx.drawImage(sprite, x, y, width, height, -item.type.size / 2, -item.type.size / 2, item.type.size, item.type.size);
    } else {
      ctx.drawImage(sprite, -item.type.size / 2, -item.type.size / 2, item.type.size, item.type.size);
    }

    ctx.restore();
  }
}

function drawFloatTexts() {
  for (const floatText of state.floatTexts) {
    const alpha = 1 - floatText.age / 0.9;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '700 34px "Do Hyeon", "Noto Sans KR", "Noto Sans JP", sans-serif';
    ctx.textAlign = "center";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(85, 34, 0, 0.35)";
    ctx.strokeText(floatText.text, floatText.x, floatText.y);
    ctx.fillStyle = floatText.color;
    ctx.fillText(floatText.text, floatText.x, floatText.y);
    ctx.restore();
  }
}

function drawGameOverScene() {
  if (state.phase !== "finished" && state.phase !== "submitting") {
    return;
  }

  const resultScene = state.lastRank === 1 && state.assets?.rankOne ? state.assets.rankOne : state.assets?.gameOver;
  if (!resultScene) {
    return;
  }

  ctx.save();
  ctx.fillStyle = "rgba(20, 10, 4, 0.26)";
  ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

  const maxWidth = 640;
  const maxHeight = 420;
  const imageRatio = resultScene.width / resultScene.height;
  let drawWidth = maxWidth;
  let drawHeight = drawWidth / imageRatio;

  if (drawHeight > maxHeight) {
    drawHeight = maxHeight;
    drawWidth = drawHeight * imageRatio;
  }

  const x = (VIRTUAL_WIDTH - drawWidth) / 2;
  const y = VIRTUAL_HEIGHT - drawHeight - 20;

  ctx.globalAlpha = 0.95;
  ctx.drawImage(resultScene, x, y, drawWidth, drawHeight);
  ctx.restore();
}

function drawRoundTransition() {
  if (state.roundTransitionTimer <= 0 || state.phase !== "playing") {
    return;
  }

  const alpha = Math.min(1, state.roundTransitionTimer / 1.4);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(255, 248, 228, 0.9)";
  roundRect(ctx, VIRTUAL_WIDTH / 2 - 198, 112, 396, 88, 28);
  ctx.fill();

  ctx.fillStyle = "#9f551f";
  ctx.font = '800 22px "Noto Sans KR", "Noto Sans JP", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(t(state.roundTransitionKey), VIRTUAL_WIDTH / 2, 148);

  ctx.fillStyle = "#3d2317";
  ctx.font = '800 42px "Do Hyeon", "Noto Sans KR", "Noto Sans JP", sans-serif';
  ctx.fillText(t(state.roundLabelKey), VIRTUAL_WIDTH / 2, 182);
  ctx.restore();
}

export function renderFrame() {
  drawBackground();

  const shaking = state.phase === "playing" || state.phase === "submitting";
  const shakeX = shaking ? (Math.random() - 0.5) * state.shake * 24 : 0;
  const shakeY = shaking ? (Math.random() - 0.5) * state.shake * 24 : 0;

  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawStageAccent();
  drawItems();
  drawPlayer();
  drawFloatTexts();
  drawGameOverScene();
  ctx.restore();
  drawTopHud();
  drawRoundBanner();
  drawRoundTransition();
}
