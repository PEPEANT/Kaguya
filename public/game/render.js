import { elements } from "./dom.js";
import { FINAL_BOSS_PREP_CONFIG } from "./config/final-boss-prep.js";
import { GROUND_Y, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from "./constants.js";
import { DEFAULT_SKIN_ID, getPlayerSkinAssetKey } from "./config/skins.js";
import { isTouchDevice } from "./device.js";
import { t } from "./i18n.js";
import { state } from "./state.js";

const ctx = elements.canvas.getContext("2d");
const PLAYER_SPRITE_SOURCE_CROPS = Object.freeze({
  down: Object.freeze({ x: 259, y: 27, width: 436, height: 523 }),
  downWalk1: Object.freeze({ x: 222, y: 80, width: 1934, height: 1561 }),
  downWalk2: Object.freeze({ x: 235, y: 85, width: 2047, height: 1678 })
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start, end, ratio) {
  return start + (end - start) * ratio;
}

function toRgba(color, alpha = 1) {
  const safeColor = Array.isArray(color) && color.length >= 3 ? color : [255, 255, 255];
  return `rgba(${safeColor[0]}, ${safeColor[1]}, ${safeColor[2]}, ${clamp(alpha, 0, 1)})`;
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

function drawCoverImage(image, alpha = 1) {
  if (!image) {
    return;
  }

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

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  ctx.restore();
}

function drawBackground() {
  ctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

  const background = state.assets?.[state.roundBackgroundKey];
  const transitionFromBackground = state.assets?.[state.backgroundTransitionFromKey];
  const blendRatio = state.backgroundTransitionFromKey && state.backgroundTransitionDuration > 0
    ? clamp((state.elapsed - state.backgroundTransitionStartAt) / state.backgroundTransitionDuration, 0, 1)
    : 1;

  if (!background && !transitionFromBackground) {
    ctx.fillStyle = "#eadccf";
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    return;
  }

  if (transitionFromBackground && blendRatio < 1) {
    drawCoverImage(transitionFromBackground, 1);
    drawCoverImage(background, blendRatio);
  } else {
    drawCoverImage(background || transitionFromBackground, 1);
  }

  drawFinalBossMoonMask();

  const tint = ctx.createLinearGradient(0, 0, 0, VIRTUAL_HEIGHT);
  tint.addColorStop(0, "rgba(255, 252, 247, 0.10)");
  tint.addColorStop(1, "rgba(58, 29, 10, 0.14)");
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

  drawBackgroundParticles();
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

function drawTimeBonusToast() {
  if (state.phase !== "playing" || state.timeBonusToastTimer <= 0 || !state.timeBonusToastText) {
    return;
  }

  const duration = 1.9;
  const progress = 1 - clamp(state.timeBonusToastTimer / duration, 0, 1);
  const alpha = Math.min(1, state.timeBonusToastTimer / 0.22) * (1 - Math.max(0, progress - 0.72) / 0.28);
  const text = state.timeBonusToastText;
  const y = state.roundTransitionTimer > 0 ? 232 : 102;

  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.font = '800 24px "Do Hyeon", "Noto Sans KR", "Noto Sans JP", sans-serif';
  const textWidth = ctx.measureText(text).width;
  const width = Math.max(216, textWidth + 44);
  const height = 42;
  const x = VIRTUAL_WIDTH / 2 - width / 2;

  ctx.fillStyle = "rgba(58, 31, 19, 0.82)";
  roundRect(ctx, x, y, width, height, 18);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 240, 220, 0.26)";
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, width, height, 18);
  ctx.stroke();

  ctx.fillStyle = "#fff1c8";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, VIRTUAL_WIDTH / 2, y + height / 2 + 1);
  ctx.restore();
}

function drawSlideStunVisual() {
  if (state.phase !== "playing" || state.slideStunVisualTimer <= 0) {
    return;
  }

  const visual = state.assets?.gameOver;
  if (!visual) {
    return;
  }

  const duration = 0.7;
  const alpha = Math.min(1, state.slideStunVisualTimer / 0.12) * Math.min(1, state.slideStunVisualTimer / duration);
  const width = 210;
  const height = 132;
  const x = clamp(state.player.x - width / 2, 20, VIRTUAL_WIDTH - width - 20);
  const y = clamp(state.player.y - state.player.height - 28, 28, VIRTUAL_HEIGHT - height - 24);

  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.drawImage(visual, x, y, width, height);
  ctx.restore();
}

function drawSlideCooldownHud() {
  if (state.phase !== "playing" || isTouchDevice()) {
    return;
  }

  const remaining = Math.max(0, state.player.slideCooldownUntil - state.elapsed);
  if (remaining <= 0.01) {
    return;
  }

  const label = `${t("slide.cooldownLabel")} ${t("chat.cooldown").replace("{seconds}", remaining.toFixed(1))}`;
  const width = 156;
  const height = 36;
  const x = VIRTUAL_WIDTH - width - 24;
  const y = VIRTUAL_HEIGHT - height - 22;

  ctx.save();
  ctx.fillStyle = "rgba(38, 21, 15, 0.3)";
  roundRect(ctx, x, y, width, height, 16);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 240, 226, 0.2)";
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, width, height, 16);
  ctx.stroke();

  ctx.fillStyle = "#fff6ee";
  ctx.font = '700 18px "Do Hyeon", "Noto Sans KR", "Noto Sans JP", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + width / 2, y + height / 2 + 1);
  ctx.restore();
}

function getPlayerSpriteSelection() {
  if (!state.assets) {
    return null;
  }

  const equippedSkin = state.equippedSkin || DEFAULT_SKIN_ID;
  const crouchSpriteKey = getPlayerSkinAssetKey(equippedSkin, "down");
  const crouchSprite = state.assets[crouchSpriteKey]
    || state.assets.down
    || state.assets[getPlayerSkinAssetKey(equippedSkin, "idle")]
    || state.assets.idle;
  const slideSprite = state.assets.slide || crouchSprite;

  if (state.damageTimer > 0) {
    const damageKey = getPlayerSkinAssetKey(equippedSkin, "damage");
    return {
      key: damageKey,
      image: state.assets[damageKey] || state.assets.damage
    };
  }

  if (state.player.isSliding) {
    return {
      key: state.assets.slide ? "slide" : crouchSpriteKey,
      image: slideSprite
    };
  }

  if (state.player.slideRecoveryTimer > 0) {
    return {
      key: state.assets.slide ? "slide" : crouchSpriteKey,
      image: slideSprite
    };
  }

  if (state.yummyTimer > 0) {
    const idleKey = getPlayerSkinAssetKey(equippedSkin, "idle");
    return {
      key: state.assets.happy ? "happy" : idleKey,
      image: state.assets.happy
        || state.assets[idleKey]
        || state.assets.idle
    };
  }

  if (state.player.isCrouching) {
    if (state.input.left || state.input.right) {
      const crouchWalkKey = Math.floor(state.player.walkTime) % 2 === 0 ? "downWalk1" : "downWalk2";
      return {
        key: state.assets[crouchWalkKey] ? crouchWalkKey : crouchSpriteKey,
        image: state.assets[crouchWalkKey] || crouchSprite
      };
    }

    return {
      key: crouchSpriteKey,
      image: crouchSprite
    };
  }

  if (!state.player.onGround) {
    const jumpKey = getPlayerSkinAssetKey(equippedSkin, "jump");
    return {
      key: jumpKey,
      image: state.assets[jumpKey] || state.assets.jump
    };
  }

  if (state.input.left || state.input.right) {
    const walkKey = Math.floor(state.player.walkTime) % 2 === 0 ? "walk1" : "walk2";
    const resolvedWalkKey = getPlayerSkinAssetKey(equippedSkin, walkKey);
    return {
      key: resolvedWalkKey,
      image: state.assets[resolvedWalkKey] || state.assets[walkKey]
    };
  }

  const idleKey = getPlayerSkinAssetKey(equippedSkin, "idle");
  return {
    key: idleKey,
    image: state.assets[idleKey] || state.assets.idle
  };
}

function getPlayerSpriteCrop(spriteKey) {
  return PLAYER_SPRITE_SOURCE_CROPS[spriteKey] || null;
}

function drawPlayer() {
  if (state.resultSceneKey && (state.phase === "finished" || state.phase === "submitting")) {
    return;
  }

  const player = state.player;
  const spriteSelection = getPlayerSpriteSelection();
  const sprite = spriteSelection?.image || null;
  const spriteCrop = getPlayerSpriteCrop(spriteSelection?.key);
  const isSliding = player.isSliding;
  const isSlideRecovery = player.slideRecoveryTimer > 0;
  const useSlidePose = isSliding || isSlideRecovery;

  ctx.save();
  ctx.fillStyle = "rgba(35, 18, 14, 0.18)";
  ctx.beginPath();
  ctx.ellipse(player.x, GROUND_Y + 10, useSlidePose ? 92 : 78, useSlidePose ? 19 : 17, 0, 0, Math.PI * 2);
  ctx.fill();

  if (sprite) {
    const crouchHeight = player.height * 0.64;
    const crouchWidth = spriteCrop
      ? clamp(crouchHeight * (spriteCrop.width / spriteCrop.height), player.width * 0.68, player.width * 1.06)
      : player.width * 0.68;
    const slideHeight = player.height * 0.44;
    const slideWidth = clamp(slideHeight * (sprite.width / sprite.height), player.width * 0.94, player.width * 1.78);
    const drawWidth = useSlidePose ? slideWidth : player.isCrouching ? crouchWidth : player.width;
    const drawHeight = useSlidePose ? slideHeight : player.isCrouching ? crouchHeight : player.height;
    const drawX = player.x - drawWidth / 2 + (useSlidePose ? player.slideDirection * 18 : 0);
    const drawY = player.y - drawHeight + (useSlidePose ? 26 : 0);
    ctx.translate(player.x, 0);
    ctx.scale(player.facing, 1);
    ctx.translate(-player.x, 0);
    if (player.isCrouching && spriteCrop) {
      ctx.drawImage(
        sprite,
        spriteCrop.x,
        spriteCrop.y,
        spriteCrop.width,
        spriteCrop.height,
        drawX,
        drawY,
        drawWidth,
        drawHeight
      );
    } else {
      ctx.drawImage(sprite, drawX, drawY, drawWidth, drawHeight);
    }
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
    const rewardIcon = floatText.assetKey ? state.assets?.[floatText.assetKey] : null;
    const iconSize = Math.max(24, Number(floatText.iconSize) || 0);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '700 34px "Do Hyeon", "Noto Sans KR", "Noto Sans JP", sans-serif';
    ctx.textAlign = "center";
    ctx.lineWidth = 6;

    if (rewardIcon) {
      ctx.drawImage(rewardIcon, floatText.x - iconSize / 2, floatText.y - iconSize - 18, iconSize, iconSize);
    }

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

  const sceneKey = state.resultSceneKey || "gameOver";
  const resultScene = state.assets?.[sceneKey];
  if (!resultScene) {
    return;
  }

  ctx.save();
  ctx.fillStyle = "rgba(20, 10, 4, 0.26)";
  ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

  const isRankScene = sceneKey === "rankOne";
  const maxWidth = isRankScene ? 360 : 420;
  const maxHeight = isRankScene ? 480 : 240;
  const imageRatio = resultScene.width / resultScene.height;
  let drawWidth = maxWidth;
  let drawHeight = drawWidth / imageRatio;

  if (drawHeight > maxHeight) {
    drawHeight = maxHeight;
    drawWidth = drawHeight * imageRatio;
  }

  const anchorX = clamp(state.resultSceneX || state.player.x, drawWidth * 0.35, VIRTUAL_WIDTH - drawWidth * 0.35);
  const anchorY = state.resultSceneY || state.player.y || GROUND_Y;

  const centeredY = anchorY - state.player.height * 0.35;
  const alignedY = anchorY - drawHeight + 32;
  const rawX = anchorX - drawWidth / 2;
  const rawY = isRankScene ? alignedY : centeredY - drawHeight / 2 + 28;
  const x = clamp(rawX, 18, VIRTUAL_WIDTH - drawWidth - 18);
  const y = clamp(rawY, 22, VIRTUAL_HEIGHT - drawHeight - 16);

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

function getFinalBossEffectsConfig() {
  return FINAL_BOSS_PREP_CONFIG.effects || null;
}

function drawFinalBossMoonMask() {
  if (state.phase !== "playing" || !state.finalBossPrepTriggered) {
    return;
  }

  const moonMask = getFinalBossEffectsConfig()?.moonMask;
  if (!moonMask) {
    return;
  }

  const centerX = clamp(Number(moonMask.centerX) || 0.06, 0, 1) * VIRTUAL_WIDTH;
  const centerY = clamp(Number(moonMask.centerY) || 0.1, 0, 1) * VIRTUAL_HEIGHT;
  const radius = clamp(Number(moonMask.radius) || 0.2, 0.05, 0.4) * VIRTUAL_WIDTH;

  ctx.save();

  const band = ctx.createLinearGradient(0, 0, 0, VIRTUAL_HEIGHT * 0.38);
  band.addColorStop(0, toRgba(moonMask.bandColor, 0.46));
  band.addColorStop(0.6, toRgba(moonMask.bandColor, 0.2));
  band.addColorStop(1, toRgba(moonMask.bandColor, 0));
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT * 0.42);

  const veil = ctx.createRadialGradient(centerX, centerY, radius * 0.14, centerX, centerY, radius);
  veil.addColorStop(0, toRgba(moonMask.color, 0.95));
  veil.addColorStop(0.42, toRgba(moonMask.color, 0.82));
  veil.addColorStop(0.8, toRgba(moonMask.color, 0.22));
  veil.addColorStop(1, toRgba(moonMask.color, 0));
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

  const glow = ctx.createRadialGradient(centerX + radius * 0.34, centerY + radius * 0.06, radius * 0.08, centerX + radius * 0.34, centerY + radius * 0.06, radius * 1.05);
  glow.addColorStop(0, toRgba(moonMask.highlightColor, 0.18));
  glow.addColorStop(1, toRgba(moonMask.highlightColor, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT * 0.52);

  ctx.restore();
}

function drawBackgroundParticles() {
  if (state.phase !== "playing" || !state.backgroundParticles.length) {
    return;
  }

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (const particle of state.backgroundParticles) {
    const progress = clamp(particle.age / Math.max(0.001, particle.life), 0, 1);
    const alpha = particle.alpha * (1 - progress) * (0.78 + Math.sin(particle.twinkle + state.elapsed * 8) * 0.22);
    if (alpha <= 0.01) {
      continue;
    }

    const radius = particle.size * (0.5 + progress * 0.85);
    const glow = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, radius);
    glow.addColorStop(0, toRgba(particle.color, alpha));
    glow.addColorStop(0.4, toRgba(particle.color, alpha * 0.52));
    glow.addColorStop(1, toRgba(particle.color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = toRgba(particle.color, alpha * 0.78);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(particle.x - radius * 1.25, particle.y);
    ctx.lineTo(particle.x + radius * 1.25, particle.y);
    ctx.moveTo(particle.x, particle.y - radius * 1.25);
    ctx.lineTo(particle.x, particle.y + radius * 1.25);
    ctx.stroke();
  }

  ctx.restore();
}

function drawScreenFlash() {
  if (state.phase !== "playing" || state.backgroundFlashTimer <= 0 || state.backgroundFlashDuration <= 0) {
    return;
  }

  const progress = 1 - state.backgroundFlashTimer / state.backgroundFlashDuration;
  const alpha = state.backgroundFlashIntensity * Math.pow(1 - progress, 1.35);
  if (alpha <= 0.01) {
    return;
  }

  ctx.save();
  ctx.fillStyle = toRgba(state.backgroundFlashColor, alpha * 0.28);
  ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

  const burst = ctx.createRadialGradient(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT * 0.3, 0, VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT * 0.3, VIRTUAL_HEIGHT * 0.88);
  burst.addColorStop(0, toRgba(state.backgroundFlashColor, alpha * 0.92));
  burst.addColorStop(0.38, toRgba(state.backgroundFlashColor, alpha * 0.34));
  burst.addColorStop(1, toRgba(state.backgroundFlashColor, 0));
  ctx.fillStyle = burst;
  ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
  ctx.restore();
}

function getFinalBossViewportScale() {
  if (!state.finalBossPrepTriggered || !FINAL_BOSS_PREP_CONFIG.enabled || !FINAL_BOSS_PREP_CONFIG.presentation) {
    return 1;
  }

  const targetScale = Number(FINAL_BOSS_PREP_CONFIG.presentation.worldScale);
  if (!Number.isFinite(targetScale)) {
    return 1;
  }

  const rampDuration = Number(FINAL_BOSS_PREP_CONFIG.presentation.rampDuration);
  const progress = !Number.isFinite(rampDuration) || rampDuration <= 0
    ? 1
    : clamp((state.elapsed - state.finalBossPrepStartedAt) / rampDuration, 0, 1);

  return lerp(1, clamp(targetScale, 0.75, 1), progress);
}

export function renderFrame() {
  drawBackground();

  const shaking = state.phase === "playing";
  const shakeX = shaking ? (Math.random() - 0.5) * state.shake * 24 : 0;
  const shakeY = shaking ? (Math.random() - 0.5) * state.shake * 24 : 0;

  ctx.save();
  ctx.translate(shakeX, shakeY);
  const viewportScale = getFinalBossViewportScale();
  if (viewportScale !== 1) {
    ctx.translate(VIRTUAL_WIDTH / 2, GROUND_Y);
    ctx.scale(viewportScale, viewportScale);
    ctx.translate(-VIRTUAL_WIDTH / 2, -GROUND_Y);
  }
  drawStageAccent();
  drawItems();
  drawPlayer();
  drawFloatTexts();
  drawGameOverScene();
  ctx.restore();

  if (state.phase === "playing") {
    drawTopHud();
    drawRoundBanner();
    drawRoundTransition();
    drawTimeBonusToast();
    drawSlideStunVisual();
  }

  drawScreenFlash();
  drawSlideCooldownHud();
}
