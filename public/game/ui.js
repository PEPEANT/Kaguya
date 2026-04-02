import { elements } from "./dom.js";
import { getProcessedAssetBaseUrl } from "./config/runtime.js";
import { DEFAULT_SKIN_ID, SHOP_SKINS, getShopSkinDescription, getShopSkinLabel } from "./config/skins.js";
import { getLang, t } from "./i18n.js";

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

export function setOrientationGateState({
  visible = false,
  eyebrow = t("orientation.eyebrow"),
  title = t("orientation.title"),
  body = t("orientation.body")
} = {}) {
  elements.orientationGate.hidden = !visible;
  if (!visible) {
    return;
  }

  elements.orientationEyebrow.textContent = eyebrow;
  elements.orientationTitle.textContent = title;
  elements.orientationBody.textContent = body;
}

export function setLobbyMobilePanel(panelName = "none") {
  elements.lobbyScreen.dataset.mobilePanel = panelName;
}

export function openGuideModal() {
  if (elements.guideModal) {
    elements.guideModal.hidden = false;
  }
}

export function closeGuideModal() {
  if (elements.guideModal) {
    elements.guideModal.hidden = true;
  }
}

function getProcessedAssetUrl(filePath) {
  const baseUrl = getProcessedAssetBaseUrl();
  return baseUrl ? `${baseUrl}/${filePath}` : `/${filePath}`;
}

function createWalletIcon() {
  const coinIcon = document.createElement("img");
  coinIcon.src = getProcessedAssetUrl("item/Fuju.png");
  coinIcon.alt = "";
  coinIcon.className = "wallet-coin-icon-sm";
  coinIcon.setAttribute("aria-hidden", "true");
  return coinIcon;
}

function createShopSkinCard({ skin, owned, isEquipped, lang }) {
  const card = document.createElement("article");
  card.className = `shop-skin-card${owned ? "" : " shop-skin-card--locked"}`;

  const preview = document.createElement("div");
  preview.className = `shop-skin-preview${owned ? "" : " shop-skin-preview--locked"}`;

  if (skin.previewFile) {
    const image = document.createElement("img");
    image.src = getProcessedAssetUrl(skin.previewFile);
    image.alt = "";
    image.className = "shop-skin-img";
    preview.append(image);
  }

  if (!owned) {
    const lock = document.createElement("span");
    lock.className = "shop-lock-icon";
    lock.textContent = "🔒";
    preview.append(lock);
  }

  const info = document.createElement("div");
  info.className = "shop-skin-info";

  const title = document.createElement("strong");
  title.textContent = getShopSkinLabel(skin, lang);

  const description = document.createElement("p");
  description.textContent = getShopSkinDescription(skin, lang);

  info.append(title, description);

  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("shop-action-btn");
  button.dataset.skinId = skin.id;

  if (!skin.supported) {
    button.classList.add("shop-action-btn--buy");
    button.disabled = true;
    button.textContent = getShopSkinDescription(skin, lang);
  } else if (!owned && skin.purchasable) {
    button.classList.add("shop-action-btn--buy");
    button.dataset.skinPrice = String(skin.price || 0);
    const priceText = document.createElement("span");
    priceText.textContent = Number(skin.price || 0).toLocaleString("ko-KR");
    button.append(createWalletIcon(), priceText);
  } else {
    button.classList.add(isEquipped ? "shop-action-btn--equipped" : "shop-action-btn--equip");
    button.disabled = isEquipped;
    button.textContent = isEquipped ? t("shop.equipped") : t("shop.equip");
  }

  card.append(preview, info, button);
  return card;
}

export function renderShopState({ balance = 0, isGuest = true, equippedSkin = "skin_0", ownedSkins = [] } = {}) {
  if (elements.shopBalanceDisplay) {
    elements.shopBalanceDisplay.textContent = balance.toLocaleString("ko-KR");
  }

  if (elements.shopGuestGate) {
    elements.shopGuestGate.hidden = true;
  }

  if (elements.shopSkinList) {
    elements.shopSkinList.hidden = false;
  }

  if (false && !isGuest) {
    const allOwned = ["skin_0", ...ownedSkins];

    // skin_0 (기본)
    if (elements.equipSkin0Button) {
      const isEquipped = equippedSkin === "skin_0";
      elements.equipSkin0Button.textContent = isEquipped ? t("shop.equipped") : t("shop.equip");
      elements.equipSkin0Button.className = `shop-action-btn ${isEquipped ? "shop-action-btn--equipped" : "shop-action-btn--equip"}`;
      elements.equipSkin0Button.disabled = isEquipped;
      elements.equipSkin0Button.dataset.skinId = "skin_0";
    }

    // skin_b
    if (elements.buySkinBButton) {
      const owned = allOwned.includes("skin_b");
      const isEquipped = equippedSkin === "skin_b";
      const card = document.getElementById("shopSkinBCard");
      if (owned) {
        card?.classList.remove("shop-skin-card--locked");
        elements.buySkinBButton.textContent = isEquipped ? t("shop.equipped") : t("shop.equip");
        elements.buySkinBButton.className = `shop-action-btn ${isEquipped ? "shop-action-btn--equipped" : "shop-action-btn--equip"}`;
        elements.buySkinBButton.disabled = isEquipped;
        elements.buySkinBButton.dataset.skinId = "skin_b";
        delete elements.buySkinBButton.dataset.skinPrice;
      } else {
        card?.classList.add("shop-skin-card--locked");
      }
    }

    // skin_c
    if (elements.buySkinCButton) {
      const owned = allOwned.includes("skin_c");
      const isEquipped = equippedSkin === "skin_c";
      const card = document.getElementById("shopSkinCCard");
      if (owned) {
        card?.classList.remove("shop-skin-card--locked");
        elements.buySkinCButton.textContent = isEquipped ? t("shop.equipped") : t("shop.equip");
        elements.buySkinCButton.className = `shop-action-btn ${isEquipped ? "shop-action-btn--equipped" : "shop-action-btn--equip"}`;
        elements.buySkinCButton.disabled = isEquipped;
        elements.buySkinCButton.dataset.skinId = "skin_c";
        delete elements.buySkinCButton.dataset.skinPrice;
      } else {
        card?.classList.add("shop-skin-card--locked");
      }
    }
  }

  const markComingSoon = (button, cardId) => {
    if (!button) {
      return;
    }

    const card = document.getElementById(cardId);
    const preview = card?.querySelector(".shop-skin-preview");

    card?.classList.add("shop-skin-card--locked");
    preview?.classList.add("shop-skin-preview--locked");
    button.className = "shop-action-btn shop-action-btn--buy";
    button.disabled = true;
    delete button.dataset.skinPrice;
    button.textContent = "준비중";
  };

  markComingSoon(elements.equipSkin0Button, "shopSkin0Card");
  markComingSoon(elements.buySkinBButton, "shopSkinBCard");
  markComingSoon(elements.buySkinCButton, "shopSkinCCard");
}

export function setMobileNavState(activeKey = "home") {
  const navButtons = [
    elements.mobileHomeButton,
    elements.mobileShopButton,
    elements.mobileRankingButton,
    elements.mobileAccountButton,
    elements.mobileSettingsButton
  ].filter(Boolean);

  navButtons.forEach((button) => {
    const isActive = button.dataset.mobileNav === activeKey;
    button.classList.toggle("mobile-nav-button--active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
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
  const isReset = mode === "reset";

  elements.authLoginTab.classList.toggle("auth-tab--active", mode === "login");
  elements.authSignupTab.classList.toggle("auth-tab--active", isSignup);
  elements.authModalTitle.textContent = isReset
    ? t("auth.resetTitle")
    : (isSignup ? t("auth.signupTitle") : t("auth.loginTitle"));
  elements.authSubmitButton.textContent = isReset
    ? t("auth.resetSubmit")
    : (isSignup ? t("auth.signupSubmit") : t("auth.loginSubmit"));
  elements.authNicknameField.hidden = !isSignup;
  elements.authNicknameInput.required = isSignup;
  elements.authPasswordField.hidden = isReset;
  elements.authPasswordInput.required = !isReset;
  elements.authConfirmField.hidden = !isSignup;
  elements.authConfirmInput.required = isSignup;
  elements.authResetPasswordButton.hidden = mode !== "login";
  elements.authHelp.hidden = !isSignup;
  elements.authSwitchRow.dataset.mode = mode;
  elements.authNicknameInput.autocomplete = isSignup ? "nickname" : "off";
  elements.authPasswordInput.autocomplete = isSignup ? "new-password" : "current-password";
  elements.authConfirmInput.autocomplete = isSignup ? "new-password" : "off";
  elements.authModeSwitchButton.textContent = isReset
    ? t("auth.switchToLoginAction")
    : (isSignup ? t("auth.switchToLoginAction") : t("auth.switchToSignupAction"));
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
  const isReset = mode === "reset";
  const labelKey = busy
    ? (isReset ? "auth.resetSending" : (isSignup ? "auth.signingUp" : "auth.loggingIn"))
    : (isReset ? "auth.resetSubmit" : (isSignup ? "auth.signupSubmit" : "auth.loginSubmit"));

  elements.authEmailInput.disabled = busy;
  elements.authEmailDomainSelect.disabled = busy;
  elements.authNicknameInput.disabled = busy;
  elements.authNicknameCheckButton.disabled = busy;
  elements.authPasswordInput.disabled = busy;
  elements.authConfirmInput.disabled = busy;
  elements.authPasswordToggleButton.disabled = busy;
  elements.authConfirmToggleButton.disabled = busy;
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

export function openMessagesModal() {
  elements.messagesModal.hidden = false;
}

export function closeMessagesModal() {
  elements.messagesModal.hidden = true;
  setMessagesStatus("");
}

export function openMessageArrivalModal() {
  if (elements.messageArrivalModal) {
    elements.messageArrivalModal.hidden = false;
  }
}

export function closeMessageArrivalModal() {
  if (elements.messageArrivalModal) {
    elements.messageArrivalModal.hidden = true;
  }
}

export function setMessageArrivalCopy({
  title = t("messages.arrivalTitle"),
  body = ""
} = {}) {
  if (elements.messageArrivalTitle) {
    elements.messageArrivalTitle.textContent = title;
  }

  if (elements.messageArrivalBody) {
    elements.messageArrivalBody.textContent = body;
  }
}

export function setMessageAlertState(visible = false) {
  [elements.profileMessagesButton, elements.profileInfoButton, elements.mobileAccountButton]
    .filter(Boolean)
    .forEach((element) => {
      element.classList.add("message-alert-target");
      element.classList.toggle("has-alert", Boolean(visible));
    });
}

export function openSettingsModal() {
  elements.settingsModal.hidden = false;
}

export function closeSettingsModal() {
  elements.settingsModal.hidden = true;
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

export function setMessagesStatus(text = "", tone = "info") {
  elements.messagesStatus.textContent = text;
  elements.messagesStatus.hidden = !text;

  if (!text) {
    delete elements.messagesStatus.dataset.tone;
    return;
  }

  elements.messagesStatus.dataset.tone = tone;
}

function getChatLocale() {
  switch (getLang()) {
    case "ja":
      return "ja-JP";
    case "en":
      return "en-US";
    default:
      return "ko-KR";
  }
}

function formatChatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "----.--.-- --:--";
  }

  const parts = new Intl.DateTimeFormat(getChatLocale(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);

  const readPart = (type) => parts.find((part) => part.type === type)?.value ?? "";
  const year = readPart("year");
  const month = readPart("month");
  const day = readPart("day");
  const hour = readPart("hour");
  const minute = readPart("minute");

  return `${year}.${month}.${day} ${hour}:${minute}`;
}

export function setLobbyChatStatus(text = "", tone = "info") {
  if (!elements.chatStatus) {
    return;
  }

  elements.chatStatus.textContent = text;
  elements.chatStatus.hidden = !text;

  if (!text) {
    delete elements.chatStatus.dataset.tone;
    return;
  }

  elements.chatStatus.dataset.tone = tone;
}

export function setLobbyChatComposerState({
  inputDisabled = false,
  sendDisabled = false,
  placeholder = t("chat.placeholder"),
  buttonLabel = t("chat.send")
} = {}) {
  if (elements.chatInput) {
    elements.chatInput.disabled = inputDisabled;
    elements.chatInput.placeholder = placeholder;
  }

  if (elements.chatSendButton) {
    elements.chatSendButton.disabled = sendDisabled;
    elements.chatSendButton.textContent = buttonLabel;
  }
}

export function renderLobbyChatMessages(messages = [], { currentUid = "" } = {}) {
  if (!elements.chatMessageList) {
    return;
  }

  elements.chatMessageList.innerHTML = "";

  if (!messages.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "chat-message-empty";
    emptyItem.textContent = t("chat.empty");
    elements.chatMessageList.append(emptyItem);
    return;
  }

  messages.forEach((message) => {
    const item = document.createElement("li");
    item.className = `chat-message-card${currentUid && message.uid === currentUid ? " chat-message-card--own" : ""}`;

    const head = document.createElement("div");
    head.className = "chat-message-head";

    const name = document.createElement("strong");
    name.className = "chat-message-name";
    name.textContent = message.nicknameSnapshot || t("lobby.defaultNickname");

    const time = document.createElement("span");
    time.className = "chat-message-time";
    time.textContent = formatChatTime(message.createdAt);

    const body = document.createElement("p");
    body.className = "chat-message-text";
    body.textContent = message.text;

    head.append(name, time);
    item.append(head, body);
    elements.chatMessageList.append(item);
  });

  elements.chatMessageList.scrollTop = elements.chatMessageList.scrollHeight;
}

export function renderProfileSummary({
  name = "-",
  summary = "",
  period = "",
  walletBalance = "0",
  walletSummary = t("wallet.profileHint")
} = {}) {
  elements.profileAccountName.textContent = name;
  elements.profileAccountSummary.textContent = summary;
  elements.profileAccountSummary.hidden = !summary;
  elements.profileSeason1Period.textContent = period;
  elements.profileHujupayBalance.textContent = walletBalance;
  elements.profileHujupaySummary.textContent = walletSummary;
}

export function renderMessages(messages = []) {
  elements.messagesList.innerHTML = "";

  if (!messages.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "message-empty";
    emptyItem.textContent = t("messages.empty");
    elements.messagesList.append(emptyItem);
    return;
  }

  messages.forEach((message) => {
    const rewardAmount = Number(message.rewardAmount) || 0;
    const hasReward = rewardAmount > 0 && String(message.rewardCurrency || "").toLowerCase() === "hujupay";
    const item = document.createElement("li");
    item.className = "message-card";

    const head = document.createElement("div");
    head.className = "message-card-head";

    const titleWrap = document.createElement("div");
    titleWrap.className = "message-card-copy";

    const title = document.createElement("strong");
    title.className = "message-card-title";
    title.textContent = message.title || t("messages.title");

    const meta = document.createElement("span");
    meta.className = "message-card-meta";
    const metaParts = [];
    if (message.seasonLabel) {
      metaParts.push(message.seasonLabel);
    }
    if (message.rank) {
      metaParts.push(`#${message.rank}`);
    }
    meta.textContent = metaParts.join(" / ");

    titleWrap.append(title, meta);
    head.append(titleWrap);

    if (hasReward) {
      const reward = document.createElement("span");
      reward.className = "message-card-reward";
      reward.textContent = `+${new Intl.NumberFormat().format(rewardAmount)} ${t("wallet.title")}`;
      head.append(reward);
    }

    const body = document.createElement("p");
    body.className = "message-card-body";
    body.textContent = message.body;

    item.append(head, body);

    if (message.claimable) {
      const actions = document.createElement("div");
      actions.className = "message-card-actions";

      const claimButton = document.createElement("button");
      claimButton.type = "button";
      claimButton.className = message.claimed ? "ghost-button message-claim-button" : "solid-button message-claim-button";
      claimButton.dataset.messageId = message.messageId;
      claimButton.disabled = message.claimed || !message.claimable;
      claimButton.textContent = message.claimed ? t("messages.claimed") : t("messages.claim");

      actions.append(claimButton);
      item.append(actions);
    }

    elements.messagesList.append(item);
  });
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

  const left = document.createElement("div");
  left.className = "season-archive-left";

  const trophy = document.createElement("span");
  trophy.className = "season-archive-trophy";
  trophy.textContent = "🏆";

  const title = document.createElement("span");
  title.className = "season-archive-title";
  title.textContent = t("ranking.season1ArchiveTitle");

  left.append(trophy, title);

  const period = document.createElement("div");
  period.className = "season-archive-period";
  period.textContent = periodText;

  wrapper.append(left, period);
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
