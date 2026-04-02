import { elements } from "./dom.js";
import { t } from "./i18n.js";

export function showIntroScreen() {
  elements.body.classList.remove("view-game", "view-lobby");
  elements.body.classList.add("view-intro");
  elements.introScreen.hidden = false;
  elements.lobbyScreen.hidden = true;
  elements.gameScreen.hidden = true;
}

export function showLobbyScreen() {
  elements.body.classList.remove("view-game", "view-intro");
  elements.body.classList.add("view-lobby");
  elements.introScreen.hidden = true;
  elements.lobbyScreen.hidden = false;
  elements.gameScreen.hidden = true;
  elements.lobbyScreen.dataset.mobilePanel = "none";
}

export function showGameScreen() {
  elements.body.classList.remove("view-lobby", "view-intro");
  elements.body.classList.add("view-game");
  elements.introScreen.hidden = true;
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
  elements.mobileControls.hidden = true;
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
  elements.rankingStatus.hidden = !text;
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

export function openAllRankingsModal() {
  elements.allRankingsModal.hidden = false;
  elements.allRankingsList.innerHTML = "";
  elements.allRankingsStatus.textContent = t("ranking.loading");
  elements.allRankingsStatus.hidden = false;
  elements.allRankingsFooter.hidden = true;
}

export function openAuthModal() {
  elements.authModal.hidden = false;
}

export function closeAuthModal() {
  elements.authModal.hidden = true;
  setAuthStatus("");
}

export function setAuthModalMode(mode = "login") {
  const isSignup = mode === "signup";

  elements.authLoginTab.classList.toggle("auth-tab--active", !isSignup);
  elements.authSignupTab.classList.toggle("auth-tab--active", isSignup);
  elements.authModalTitle.textContent = isSignup ? t("auth.signupTitle") : t("auth.loginTitle");
  elements.authSubmitButton.textContent = isSignup ? t("auth.signupSubmit") : t("auth.loginSubmit");
  elements.authNicknameField.hidden = !isSignup;
  elements.authNicknameInput.required = isSignup;
  elements.authConfirmField.hidden = !isSignup;
  elements.authConfirmInput.required = isSignup;
  elements.authResetPasswordButton.hidden = isSignup;
  elements.authNicknameInput.autocomplete = isSignup ? "nickname" : "off";
  elements.authPasswordInput.autocomplete = isSignup ? "new-password" : "current-password";
  elements.authConfirmInput.autocomplete = isSignup ? "new-password" : "off";
}

export function setAuthStatus(text = "", tone = "info") {
  elements.authStatus.textContent = text;
  elements.authStatus.hidden = !text;

  if (!text) {
    delete elements.authStatus.dataset.tone;
    return;
  }

  elements.authStatus.dataset.tone = tone;
}

export function setAuthSubmitState({ busy, mode = "login" }) {
  const isSignup = mode === "signup";
  const labelKey = busy
    ? (isSignup ? "auth.signingUp" : "auth.loggingIn")
    : (isSignup ? "auth.signupSubmit" : "auth.loginSubmit");

  elements.authEmailInput.disabled = busy;
  elements.authNicknameInput.disabled = busy;
  elements.authPasswordInput.disabled = busy;
  elements.authConfirmInput.disabled = busy;
  elements.authSubmitButton.disabled = busy;
  elements.authResetPasswordButton.disabled = busy;
  elements.authSubmitButton.textContent = t(labelKey);
}

export function openProfileModal() {
  elements.profileModal.hidden = false;
}

export function closeProfileModal() {
  elements.profileModal.hidden = true;
  setProfileStatus("");
}

export function setProfileStatus(text = "", tone = "info") {
  elements.profileStatus.textContent = text;
  elements.profileStatus.hidden = !text;

  if (!text) {
    delete elements.profileStatus.dataset.tone;
    return;
  }

  elements.profileStatus.dataset.tone = tone;
}

export function renderProfileSummary({ name = "-", summary = "-", period = "" } = {}) {
  elements.profileAccountName.textContent = name;
  elements.profileAccountSummary.textContent = summary;
  elements.profileSeason1Period.textContent = period;
}

function renderProfileRecordPlaceholder(container, text) {
  container.innerHTML = "";

  const empty = document.createElement("div");
  empty.className = "profile-record-card profile-record-card--empty";
  empty.textContent = text;
  container.append(empty);
}

export function renderProfileSeasonRecord(
  record,
  {
    container = elements.profileSeason1Record,
    emptyText = t("profile.noRecord")
  } = {}
) {
  container.innerHTML = "";

  if (!record) {
    renderProfileRecordPlaceholder(container, emptyText);
    return;
  }

  const card = document.createElement("article");
  card.className = "profile-record-card";

  const header = document.createElement("div");
  header.className = "profile-record-head";

  const badge = document.createElement("span");
  badge.className = "profile-record-rank";
  badge.textContent = `#${record.rank}`;

  const nickname = document.createElement("strong");
  nickname.className = "profile-record-name";
  nickname.textContent = record.name;

  header.append(badge, nickname);

  const stats = document.createElement("div");
  stats.className = "profile-record-stats";

  const scoreStat = document.createElement("div");
  scoreStat.className = "profile-record-stat";
  const scoreLabel = document.createElement("span");
  scoreLabel.textContent = t("profile.recordScore");
  const scoreValue = document.createElement("strong");
  scoreValue.textContent = `${record.score}${t("ranking.pts")}`;
  scoreStat.append(scoreLabel, scoreValue);

  const rankStat = document.createElement("div");
  rankStat.className = "profile-record-stat";
  const rankLabel = document.createElement("span");
  rankLabel.textContent = t("profile.recordRank");
  const rankValue = document.createElement("strong");
  rankValue.textContent = `#${record.rank}`;
  rankStat.append(rankLabel, rankValue);

  stats.append(scoreStat, rankStat);
  card.append(header, stats);
  container.append(card);
}

export function renderProfileSeasonTopRankings(
  rankings = [],
  {
    listElement = elements.profileSeason1TopList,
    emptyText = t("ranking.norecords")
  } = {}
) {
  listElement.innerHTML = "";

  if (!rankings.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "ranking-empty";
    emptyItem.textContent = emptyText;
    listElement.append(emptyItem);
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
    listElement.append(item);
  });
}

export function setActiveSeasonTab(season) {
  elements.seasonTab1.classList.toggle("season-tab--active", season === 1);
  elements.seasonTab2.classList.toggle("season-tab--active", season === 2);
}

function appendSeasonArchiveBanner(periodText = t("ranking.season1ArchivePeriod")) {
  const wrapper = document.createElement("li");
  wrapper.className = "season-archive";

  const trophy = document.createElement("div");
  trophy.className = "season-archive-trophy";
  trophy.textContent = "🏆";

  const title = document.createElement("div");
  title.className = "season-archive-title";
  title.textContent = t("ranking.season1ArchiveTitle");

  const period = document.createElement("div");
  period.className = "season-archive-period";
  period.textContent = periodText;

  const body = document.createElement("div");
  body.className = "season-archive-body";
  body.textContent = t("ranking.season1ArchiveBody");

  wrapper.append(trophy, title, period, body);
  elements.allRankingsList.append(wrapper);
}

export function closeAllRankingsModal() {
  elements.allRankingsModal.hidden = true;
  elements.allRankingsFooter.hidden = true;
}

export function renderSeason1Archive(rankings = [], period = t("ranking.season1ArchivePeriod")) {
  renderAllRankingsList(rankings, {
    archived: true,
    period
  });
}

export function renderAllRankingsList(rankings, { archived = false, period = t("ranking.season1ArchivePeriod") } = {}) {
  elements.allRankingsList.innerHTML = "";
  elements.allRankingsStatus.hidden = true;

  if (archived) {
    appendSeasonArchiveBanner(period);
  }

  if (!rankings.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "ranking-empty";
    emptyItem.textContent = t("ranking.norecords");
    elements.allRankingsList.append(emptyItem);
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
    elements.allRankingsList.append(item);
  });
}

export function setAllRankingsStatus(text) {
  elements.allRankingsStatus.textContent = text;
  elements.allRankingsStatus.hidden = !text;
}

export function setAllRankingsToggle({ visible, expanded }) {
  elements.allRankingsFooter.hidden = !visible;
  elements.toggleAllRankingsButton.textContent = expanded
    ? t("ranking.collapseAll")
    : t("ranking.expandAll");
}

export function renderRankingList(rankings) {
  elements.rankingList.innerHTML = "";
  elements.rankingStatus.hidden = true;

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
