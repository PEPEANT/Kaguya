import { elements } from "./dom.js";
import { t } from "./i18n.js";

export function showLobbyScreen() {
  elements.body.classList.remove("view-game");
  elements.body.classList.add("view-lobby");
  elements.lobbyScreen.hidden = false;
  elements.gameScreen.hidden = true;
  elements.lobbyScreen.dataset.mobilePanel = "none";
}

export function showGameScreen() {
  elements.body.classList.remove("view-lobby");
  elements.body.classList.add("view-game");
  elements.lobbyScreen.hidden = true;
  elements.gameScreen.hidden = false;
}

export function setStartButtonState({ label, disabled }) {
  elements.startButton.textContent = label;
  elements.startButton.disabled = disabled;
}

export function showGameResult({
  eyebrow = t("result.eyebrow"),
  title = t("result.title"),
  noticeText = "",
  score = 0,
  rankText = "-",
  restartLabel = t("result.restart"),
  restartDisabled = false,
  lobbyDisabled = false
}) {
  elements.overlay.hidden = false;
  elements.overlayEyebrow.textContent = eyebrow;
  elements.overlayTitle.textContent = title;
  elements.resultNotice.textContent = noticeText;
  elements.resultNotice.hidden = !noticeText;
  elements.finalScoreValue.textContent = String(score);
  elements.finalRankValue.textContent = rankText;
  elements.restartButton.textContent = restartLabel;
  elements.restartButton.disabled = restartDisabled;
  elements.lobbyButton.disabled = lobbyDisabled;
}

export function hideGameResult() {
  elements.overlay.hidden = true;
  elements.resultNotice.textContent = "";
  elements.resultNotice.hidden = true;
}

export function setRankingStatus(text) {
  elements.rankingStatus.textContent = text;
}

export function renderGuideImages(assets) {
  elements.guideImages.forEach((imageElement) => {
    const key = imageElement.dataset.guideItem;
    const asset = assets[key];

    if (!asset) {
      return;
    }

    imageElement.src = asset.currentSrc || asset.src;
  });
}

export function setTouchControlsVisible(visible) {
  elements.mobileControls.hidden = !visible;
}

export function setOrientationGateVisible(visible) {
  elements.orientationGate.hidden = !visible;
}

export function setLobbyMobilePanel(panelName = "none") {
  elements.lobbyScreen.dataset.mobilePanel = panelName;
}

export function renderRankingList(rankings) {
  elements.rankingList.innerHTML = "";

  if (!rankings.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "ranking-empty";
    emptyItem.textContent = t("ranking.norecords");
    elements.rankingList.append(emptyItem);
    return;
  }

  rankings.forEach((entry, index) => {
    const item = document.createElement("li");
    item.className = "ranking-item";

    const rank = document.createElement("div");
    rank.className = `ranking-rank ${index < 3 ? `rank-top-${index + 1}` : ""}`.trim();
    rank.textContent = String(index + 1);

    const name = document.createElement("div");
    name.className = "ranking-name";
    name.textContent = entry.name;

    const score = document.createElement("div");
    score.className = "ranking-score";
    score.textContent = `${entry.score}${t("ranking.pts")}`;

    item.append(rank, name, score);
    elements.rankingList.append(item);
  });
}
