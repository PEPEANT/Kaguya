import { loadAssets } from "./assets.js";
import { initAudio, playGameMusic, playLobbyMusic, toggleMusic } from "./audio.js";
import { exitLandscapePresentation, isPortraitTouchViewport, isTouchDevice, requestLandscapePresentation } from "./device.js";
import { elements } from "./dom.js";
import { initI18n, t } from "./i18n.js";
import { fetchRankings, handleMovementKey, startRound, updateGame } from "./logic.js";
import { renderFrame } from "./render.js";
import { normalizeName, state } from "./state.js";
import {
  hideGameResult,
  renderGuideImages,
  renderRankingList,
  setLobbyMobilePanel,
  setOrientationGateVisible,
  setRankingStatus,
  setStartButtonState,
  setTouchControlsVisible,
  showGameScreen,
  showLobbyScreen
} from "./ui.js";

let lastFrameTime = 0;
let booted = false;
let rankingPollTimer = 0;
const RANKING_POLL_INTERVAL = 5000;

function animate(currentTime) {
  if (!lastFrameTime) {
    lastFrameTime = currentTime;
  }

  const dt = Math.min((currentTime - lastFrameTime) / 1000, 0.033);
  lastFrameTime = currentTime;

  updateGame(dt);
  renderFrame();
  requestAnimationFrame(animate);
}

function syncResponsiveUi() {
  setTouchControlsVisible(isTouchDevice());
  setOrientationGateVisible(isPortraitTouchViewport());
}

function refreshRankingsInBackground() {
  if (document.hidden || elements.lobbyScreen.hidden || state.phase === "loading" || state.phase === "submitting") {
    return;
  }

  fetchRankings({ background: true });
}

function startRankingPolling() {
  if (rankingPollTimer) {
    return;
  }

  rankingPollTimer = window.setInterval(refreshRankingsInBackground, RANKING_POLL_INTERVAL);
}

function getActiveNickname() {
  return normalizeName(elements.nicknameInput.value) || state.nickname || t("lobby.defaultNickname");
}

function launchGame() {
  hideGameResult();
  setLobbyMobilePanel("none");
  showGameScreen();
  playGameMusic();
  syncResponsiveUi();
  requestLandscapePresentation(elements.gameScreen);
}

function returnToLobby() {
  state.phase = "ready";
  setLobbyMobilePanel("none");
  showLobbyScreen();
  playLobbyMusic();
  syncResponsiveUi();
  fetchRankings();
  exitLandscapePresentation();
}

function bindHoldButton(element, code) {
  const press = (event) => {
    event.preventDefault();
    handleMovementKey(code, true);
  };

  const release = (event) => {
    event.preventDefault();
    handleMovementKey(code, false);
  };

  element.addEventListener("pointerdown", press);
  element.addEventListener("pointerup", release);
  element.addEventListener("pointercancel", release);
  element.addEventListener("pointerleave", release);
}

function bindEvents() {
  window.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "KeyA", "KeyD", "KeyW", "Space"].includes(event.code)) {
      event.preventDefault();
    }

    handleMovementKey(event.code, true);
  });

  window.addEventListener("keyup", (event) => {
    handleMovementKey(event.code, false);
  });

  window.addEventListener("resize", syncResponsiveUi);
  window.addEventListener("orientationchange", syncResponsiveUi);
  document.addEventListener("visibilitychange", refreshRankingsInBackground);

  elements.startForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (state.phase === "loading" || state.phase === "submitting") {
      return;
    }

    const nickname = getActiveNickname();
    elements.nicknameInput.value = nickname;
    startRound(nickname);
    launchGame();
  });

  elements.restartButton.addEventListener("click", () => {
    if (state.phase === "submitting") {
      return;
    }

    const nickname = getActiveNickname();
    elements.nicknameInput.value = nickname;
    startRound(nickname);
    launchGame();
  });

  elements.lobbyButton.addEventListener("click", () => {
    returnToLobby();
  });

  elements.refreshRankingButton.addEventListener("click", () => {
    fetchRankings();
  });

  elements.musicToggleButton.addEventListener("click", () => {
    toggleMusic();
  });

  elements.openGuideButton.addEventListener("click", () => {
    setLobbyMobilePanel("guide");
  });

  elements.openRankingButton.addEventListener("click", () => {
    setLobbyMobilePanel("ranking");
  });

  elements.guideBackButton.addEventListener("click", () => {
    setLobbyMobilePanel("none");
  });

  elements.rankingBackButton.addEventListener("click", () => {
    setLobbyMobilePanel("none");
  });

  bindHoldButton(elements.moveLeftButton, "ArrowLeft");
  bindHoldButton(elements.moveRightButton, "ArrowRight");

  elements.jumpButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    handleMovementKey("Space", true);
  });
}

export async function boot() {
  if (booted) {
    return;
  }

  booted = true;
  initI18n();
  initAudio();
  bindEvents();
  showLobbyScreen();
  playLobbyMusic();
  hideGameResult();
  syncResponsiveUi();
  setStartButtonState({
    label: t("boot.loading.button"),
    disabled: true
  });

  window.addEventListener("langchange", () => {
    renderRankingList(state.rankings);
    if (state.phase === "loading") {
      setStartButtonState({ label: t("boot.loading.button"), disabled: true });
      return;
    }

    if (state.phase === "ready") {
      setStartButtonState({ label: t("boot.ready.button"), disabled: false });
      setRankingStatus(state.rankings.length ? t("ranking.best") : t("ranking.empty"));
      return;
    }

    if (state.phase === "error") {
      setStartButtonState({ label: t("boot.error.button"), disabled: true });
      setRankingStatus(t("boot.error.status"));
    }
  });

  try {
    state.assets = await loadAssets();
    renderGuideImages(state.assets);
    await fetchRankings();
    startRankingPolling();
    state.phase = "ready";
    setStartButtonState({
      label: t("boot.ready.button"),
      disabled: false
    });
    elements.nicknameInput.focus();
  } catch {
    state.phase = "error";
    setStartButtonState({
      label: t("boot.error.button"),
      disabled: true
    });
    setRankingStatus(t("boot.error.status"));
  }

  requestAnimationFrame(animate);
}
