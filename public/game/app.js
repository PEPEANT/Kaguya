import { loadAssets } from "./assets.js";
import { initAudio, playGameMusic, playLobbyMusic, toggleMusic } from "./audio.js";
import {
  claimAccountMessageReward,
  ensureSeasonRewardMessage,
  equipSkin,
  fetchAccountIdentity,
  fetchAccountMessages,
  getSeasonRankingRewardAmount,
  isAccountMessageClaimEnabled,
  isAccountMessageInboxEnabled,
  isAccountRewardAutomationEnabled,
  isAccountShopEnabled,
  isAccountWalletEnabled,
  purchaseSkin,
  syncAccountIdentity,
  syncSeasonHujupayRewards,
  updateAccountNickname
} from "./account-service.js";
import { initAuth, sendPasswordResetLink, signInWithEmail, signOutCurrentUser, signUpWithEmail, updateCurrentUserNickname } from "./auth.js";
import { sendLobbyChatMessage, subscribeLobbyChat } from "./chat-service.js";
import { exitLandscapePresentation, isLandscapeTouchViewport, isPortraitTouchViewport, isTouchDevice, requestLandscapePresentation } from "./device.js";
import { elements } from "./dom.js";
import { getCurrentContentSeasonId, getCurrentRankingSeason, getRankingSeasonConfig, isPlaytestMode } from "./config/runtime.js";
import { getLang, initI18n, t } from "./i18n.js";
import { applyPlaytestState, fetchRankings, handleMovementKey, spawnPlaytestItemByKey, startRound, triggerSlide, updateGame } from "./logic.js";
import { buildGuestNickname, clearSavedNickname, getOrCreatePlayerId } from "./player-identity.js";
import { startPresenceTracking } from "./presence.js";
import { fetchSeasonProfile } from "./profile-service.js";
import { fetchAllRankingsFromProvider, checkNicknameAvailabilityFromProvider, submitScoreToProvider } from "./ranking-service.js";
import { renderFrame } from "./render.js";
import { normalizeName, state } from "./state.js";
import {
  closeAllRankingsModal,
  closeAuthModal,
  closeMessageArrivalModal,
  closeMessagesModal,
  closeProfileModal,
  closeGuideModal,
  closeSettingsModal,
  hideGameResult,
  openAuthModal,
  openAllRankingsModal,
  openGuideModal,
  openMessageArrivalModal,
  openMessagesModal,
  openProfileModal,
  openSettingsModal,
  renderAllRankingsList,
  renderGuideImages,
  renderLobbyChatMessages,
  renderMessages,
  renderProfileSeasonRecord,
  renderProfileSeasonTopRankings,
  renderProfileSummary,
  renderRankingList,
  renderSeason1Archive,
  renderShopState,
  setActiveSeasonTab,
  setAllRankingsStatus,
  setAllRankingsToggle,
  setAuthModalMode,
  setAuthStatus,
  setLobbyChatComposerState,
  setLobbyChatStatus,
  setAuthSubmitState,
  setLobbyMobilePanel,
  setMessageAlertState,
  setMessageArrivalCopy,
  setMessagesStatus,
  setMobileNavState,
  setOrientationGateState,
  setProfileStatus,
  setRankingStatus,
  setStartButtonState,
  setTouchControlsVisible,
  setTouchControlCooldowns,
  showGameScreen,
  showIntroScreen,
  showLobbyScreen
} from "./ui.js";

let lastFrameTime = 0;
let booted = false;
let rankingPollTimer = 0;
const RANKING_POLL_INTERVAL = 5000;
const ALL_RANKINGS_PREVIEW_COUNT = 10;
const AUTH_MIN_PASSWORD_LENGTH = 6;
const PROFILE_SEASON = 1;
const CURRENT_SEASON = getCurrentRankingSeason();
const PLAYTEST_ENABLED = isPlaytestMode();
const PLAYTEST_MESSAGE_SOURCE = "admin-playtest";
const PLAYTEST_STATUS_SOURCE = "game-playtest";
const PLAYTEST_BRIDGE_KEY = "__KAGUYA_PLAYTEST__";
const PLAYTEST_STATUS_INTERVAL = 300;
const LOBBY_CHAT_COOLDOWN_MS = 4_000;
const MESSAGE_SEEN_STORAGE_PREFIX = "kaguya_messages_seen_v1";
const MESSAGE_ALERTED_STORAGE_PREFIX = "kaguya_messages_alerted_v1";
const MAX_STORED_MESSAGE_IDS = 120;
const INTRO_BACKGROUND_BY_LANG = Object.freeze({
  ko: "/scene/Login_Main_kr.png",
  ja: "/scene/Login_Main_jp.png",
  en: "/scene/Login_Main_jp.png"
});
const allRankingsModalState = {
  season: CURRENT_SEASON,
  rankings: [],
  expanded: false
};
const authModalState = {
  mode: "login",
  busy: false,
  passwordVisible: false,
  confirmVisible: false,
  nicknameCheckedValue: "",
  nicknameAvailable: false
};
const profileModalState = {
  currentSeasonProfile: null,
  season1Profile: null,
  messages: [],
  editingNickname: false,
  nicknameBusy: false
};
const lobbyChatState = {
  messages: [],
  sending: false,
  cooldownUntil: 0,
  unsubscribe: null,
  cooldownTimerId: 0,
  statusTone: "info",
  statusText: ""
};
const messageNotificationState = {
  unreadCount: 0,
  pendingRewardPromptIds: []
};
let pendingRoundStartNickname = "";
let playtestStatusTimer = 0;
let introBackgroundAssetsPrimed = false;

function getIntroBackgroundSrc(lang = getLang()) {
  return INTRO_BACKGROUND_BY_LANG[lang] || INTRO_BACKGROUND_BY_LANG.ko;
}

function primeIntroBackgroundAssets() {
  if (introBackgroundAssetsPrimed || typeof Image === "undefined") {
    return;
  }

  introBackgroundAssetsPrimed = true;
  Object.values(INTRO_BACKGROUND_BY_LANG).forEach((src) => {
    const image = new Image();
    image.decoding = "async";
    image.src = src;
  });
}

function syncIntroBackground() {
  if (!elements.introBackgroundImage) {
    return;
  }

  const nextSrc = getIntroBackgroundSrc();
  if (elements.introBackgroundImage.getAttribute("src") !== nextSrc) {
    elements.introBackgroundImage.setAttribute("src", nextSrc);
  }
}

function getOrientationGateCopy(mode = "game") {
  switch (mode) {
    case "start":
      switch (getLang()) {
        case "ja":
          return {
            eyebrow: "Loading",
            title: "Rotate to Start",
            body: "Turn your device to landscape. The game will begin as soon as it is ready."
          };
        case "en":
          return {
            eyebrow: "Loading",
            title: "Rotate to Start",
            body: "Turn your device to landscape. The game will begin as soon as it is ready."
          };
        default:
          return {
            eyebrow: "Loading",
            title: "가로로 돌리면 시작돼요",
            body: "잠시 뒤 게임이 시작됩니다. 기기를 가로로 돌려주세요."
          };
      }
    case "portrait":
      switch (getLang()) {
        case "ja":
          return {
            eyebrow: "Portrait",
            title: "Use Portrait Here",
            body: "Login and lobby screens work in portrait. The game switches to landscape after you start playing."
          };
        case "en":
          return {
            eyebrow: "Portrait",
            title: "Use Portrait Here",
            body: "Login and lobby screens work in portrait. The game switches to landscape after you start playing."
          };
        default:
          return {
            eyebrow: "Portrait",
            title: "세로로 이용해주세요",
            body: "로그인과 로비 화면은 세로로 보고, 게임 시작 후에 가로로 전환돼요."
          };
      }
    default:
      switch (getLang()) {
        case "ja":
          return {
            eyebrow: "Landscape",
            title: "Rotate to Landscape",
            body: "Gameplay is available in landscape mode only."
          };
        case "en":
          return {
            eyebrow: "Landscape",
            title: "Rotate to Landscape",
            body: "Gameplay is available in landscape mode only."
          };
        default:
          return {
            eyebrow: "Landscape",
            title: "가로로 돌려주세요",
            body: "게임 플레이는 가로 모드에서만 진행됩니다."
          };
      }
  }
}

function syncMobileNavigationState() {
  if (elements.settingsModal && !elements.settingsModal.hidden) {
    setMobileNavState("settings");
    return;
  }

  if (
    (elements.profileModal && !elements.profileModal.hidden)
    || (elements.messagesModal && !elements.messagesModal.hidden)
    || (elements.authModal && !elements.authModal.hidden)
  ) {
    setMobileNavState("account");
    return;
  }

  const mobilePanel = elements.lobbyScreen?.dataset.mobilePanel || "none";
  if (mobilePanel === "shop") {
    setMobileNavState("shop");
    return;
  }

  if (mobilePanel === "ranking") {
    setMobileNavState("ranking");
    return;
  }

  setMobileNavState("home");
}

function isWaitingForLandscapeStart() {
  return Boolean(pendingRoundStartNickname);
}

function isPlaytestActive() {
  return PLAYTEST_ENABLED;
}

function getPlaytestScreen() {
  if (!elements.gameScreen.hidden) {
    return "game";
  }

  if (!elements.lobbyScreen.hidden) {
    return "lobby";
  }

  return "intro";
}

function getPlaytestStatusSnapshot() {
  return {
    phase: state.phase,
    screen: getPlaytestScreen(),
    nickname: state.nickname || getGuestNickname(),
    score: Math.max(0, Math.floor(state.score || 0)),
    round: Math.max(1, Math.floor(state.round || 1)),
    timeLeft: Math.max(0, Math.ceil(state.timeLeft || 0)),
    health: Math.max(0, Math.floor(state.health || 0)),
    maxHealth: Math.max(1, Math.floor(state.maxHealth || 1)),
    backgroundKey: state.roundBackgroundKey || "",
    contentSeasonId: getCurrentContentSeasonId(),
    playtest: true
  };
}

function postPlaytestStatus() {
  if (!isPlaytestActive() || window.parent === window) {
    return;
  }

  window.parent.postMessage({
    source: PLAYTEST_STATUS_SOURCE,
    type: "playtest:status",
    payload: getPlaytestStatusSnapshot()
  }, window.location.origin);
}

function startPlaytestStatusLoop() {
  if (!isPlaytestActive() || playtestStatusTimer) {
    return;
  }

  postPlaytestStatus();
  playtestStatusTimer = window.setInterval(postPlaytestStatus, PLAYTEST_STATUS_INTERVAL);
}

function renderActiveAllRankings() {
  const { season, rankings, expanded } = allRankingsModalState;
  const shouldShowAll = season === CURRENT_SEASON || expanded;
  const visibleRankings = shouldShowAll ? rankings : rankings.slice(0, ALL_RANKINGS_PREVIEW_COUNT);

  if (season === 1) {
    renderSeason1Archive(visibleRankings, getRankingSeasonConfig(1).period || t("ranking.season1ArchivePeriod"));
  } else {
    renderAllRankingsList(visibleRankings);
  }

  setAllRankingsToggle({
    visible: season !== CURRENT_SEASON && rankings.length > ALL_RANKINGS_PREVIEW_COUNT,
    expanded
  });
}

async function showAllRankingsForSeason(season) {
  if (isPlaytestActive()) {
    allRankingsModalState.season = season;
    allRankingsModalState.rankings = [];
    allRankingsModalState.expanded = false;
    elements.allRankingsList.innerHTML = "";
    setAllRankingsStatus("Playtest mode: rankings are disabled.");
    setAllRankingsToggle({ visible: false, expanded: false });
    return;
  }

  setActiveSeasonTab(season);
  elements.allRankingsList.innerHTML = "";
  elements.allRankingsStatus.textContent = t("ranking.loading");
  elements.allRankingsStatus.hidden = false;
  setAllRankingsToggle({ visible: false, expanded: false });

  try {
    const { rankings } = await fetchAllRankingsFromProvider({ season });
    allRankingsModalState.season = season;
    allRankingsModalState.rankings = rankings;
    allRankingsModalState.expanded = season === CURRENT_SEASON;
    renderActiveAllRankings();
  } catch {
    setAllRankingsStatus(t("ranking.failed"));
    setAllRankingsToggle({ visible: false, expanded: false });
  }
}

function animate(currentTime) {
  if (!lastFrameTime) {
    lastFrameTime = currentTime;
  }

  const dt = Math.min((currentTime - lastFrameTime) / 1000, 0.033);
  lastFrameTime = currentTime;

  updateGame(dt);
  setTouchControlCooldowns({
    slideRemaining: state.phase === "playing"
      ? Math.max(0, state.player.slideCooldownUntil - state.elapsed)
      : 0
  });
  renderFrame();
  requestAnimationFrame(animate);
}

function syncResponsiveUi() {
  const showingGame = !elements.gameScreen.hidden;
  setTouchControlsVisible(showingGame && isTouchDevice());

  if (!isTouchDevice()) {
    setOrientationGateState({ visible: false });
    return;
  }

  if (isWaitingForLandscapeStart()) {
    if (isLandscapeTouchViewport()) {
      const nextNickname = pendingRoundStartNickname;
      pendingRoundStartNickname = "";
      startRound(nextNickname);
      launchGame();
      return;
    }

    setOrientationGateState({
      visible: true,
      ...getOrientationGateCopy("start")
    });
    return;
  }

  if (showingGame) {
    setOrientationGateState({
      visible: isPortraitTouchViewport(),
      ...getOrientationGateCopy("game")
    });
    return;
  }

  setOrientationGateState({
    visible: isLandscapeTouchViewport(),
    ...getOrientationGateCopy("portrait")
  });
}

function refreshRankingsInBackground() {
  if (isPlaytestActive()) {
    return;
  }

  if (document.hidden || elements.lobbyScreen.hidden || state.phase === "loading" || state.phase === "submitting") {
    return;
  }

  fetchRankings({ background: true });
}

function startRankingPolling() {
  if (isPlaytestActive() || rankingPollTimer) {
    return;
  }

  rankingPollTimer = window.setInterval(refreshRankingsInBackground, RANKING_POLL_INTERVAL);
}

function getGuestNickname() {
  return buildGuestNickname(state.playerId, getLang());
}

function getMemberDisplayName(user = state.authUser) {
  return normalizeName(user?.displayName || "");
}

function getProfileDisplayName(user = state.authUser) {
  return getMemberDisplayName(user) || String(user?.email || "").trim() || t("auth.guestTitle");
}

function formatNumber(value) {
  const safeValue = Math.max(0, Math.floor(Number(value) || 0));
  return new Intl.NumberFormat(getLang()).format(safeValue);
}

function getHujupaySummaryText({ totalEarned = 0, seasonEarned = 0 } = {}) {
  const totalText = formatNumber(totalEarned);
  const seasonText = formatNumber(seasonEarned);

  switch (getLang()) {
    case "ja":
      return `今シーズンのスコア報酬 ${seasonText} / 累計獲得 ${totalText}`;
    case "en":
      return `Current season rewards ${seasonText} / Lifetime earned ${totalText}`;
    default:
      return `현재 시즌 점수 보상 ${seasonText} / 누적 적립 ${totalText}`;
  }
}

function getPendingMessageCount() {
  return (profileModalState.messages || []).filter((message) => message.claimable && !message.claimed).length;
}

function getMessageStorageKey(prefix, uid = state.authUser?.uid) {
  const safeUid = String(uid || "").trim();
  return safeUid ? `${prefix}:${safeUid}` : "";
}

function readStoredMessageIds(prefix, uid = state.authUser?.uid) {
  const storageKey = getMessageStorageKey(prefix, uid);
  if (!storageKey) {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    const parsed = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(parsed)
      ? [...new Set(parsed.map((value) => String(value || "").trim()).filter(Boolean))]
      : [];
  } catch {
    return [];
  }
}

function writeStoredMessageIds(prefix, ids = [], uid = state.authUser?.uid) {
  const storageKey = getMessageStorageKey(prefix, uid);
  if (!storageKey) {
    return;
  }

  const uniqueIds = [...new Set(ids.map((value) => String(value || "").trim()).filter(Boolean))].slice(-MAX_STORED_MESSAGE_IDS);

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(uniqueIds));
  } catch {
    // Ignore storage failures on restricted browsers.
  }
}

function appendStoredMessageIds(prefix, ids = [], uid = state.authUser?.uid) {
  if (!ids.length) {
    return;
  }

  const nextIds = [...readStoredMessageIds(prefix, uid), ...ids];
  writeStoredMessageIds(prefix, nextIds, uid);
}

function getUnreadMessages(messages = []) {
  const seenIds = new Set(readStoredMessageIds(MESSAGE_SEEN_STORAGE_PREFIX));
  return messages.filter((message) => message.messageId && !seenIds.has(message.messageId));
}

function getUnalertedRewardMessages(messages = []) {
  const alertedIds = new Set(readStoredMessageIds(MESSAGE_ALERTED_STORAGE_PREFIX));
  return messages.filter((message) => (
    message.messageId
    && message.claimable
    && !message.claimed
    && !alertedIds.has(message.messageId)
  ));
}

function markMessagesSeen(messages = []) {
  const messageIds = messages
    .map((message) => String(message?.messageId || "").trim())
    .filter(Boolean);
  appendStoredMessageIds(MESSAGE_SEEN_STORAGE_PREFIX, messageIds);
}

function markRewardMessagesAlerted(messages = []) {
  const rewardMessageIds = messages
    .filter((message) => message?.claimable && !message?.claimed)
    .map((message) => String(message?.messageId || "").trim())
    .filter(Boolean);
  appendStoredMessageIds(MESSAGE_ALERTED_STORAGE_PREFIX, rewardMessageIds);
}

function resetMessageNotifications() {
  messageNotificationState.unreadCount = 0;
  messageNotificationState.pendingRewardPromptIds = [];
  setMessageAlertState(false);
}

function updateMessageNotificationState(messages = profileModalState.messages || []) {
  const unreadMessages = getUnreadMessages(messages);
  messageNotificationState.unreadCount = unreadMessages.length;
  setMessageAlertState(unreadMessages.length > 0);
}

function updateMessagesButtonLabel() {
  const pendingCount = getPendingMessageCount();
  const baseLabel = t("messages.open");
  elements.profileMessagesButton.hidden = !state.authUser?.uid || !isAccountMessageInboxEnabled();
  elements.profileMessagesButton.textContent = pendingCount > 0
    ? `${baseLabel} (${pendingCount})`
    : baseLabel;
}

function getSeasonRewardMessageTitle(seasonLabel) {
  switch (getLang()) {
    case "ja":
      return `${seasonLabel} 精算報酬`;
    case "en":
      return `${seasonLabel} Settlement Reward`;
    default:
      return `${seasonLabel} 정산 보상`;
  }
}

function getSeasonRewardMessageBody({ seasonLabel, rank, rewardAmount }) {
  const rewardText = formatNumber(rewardAmount);

  switch (getLang()) {
    case "ja":
      return `おめでとうございます。${seasonLabel}で #${rank} を達成し、HujuPay ${rewardText} を受け取れます。`;
    case "en":
      return `Congratulations. You finished #${rank} in ${seasonLabel} and can claim ${rewardText} HujuPay.`;
    default:
      return `축하합니다. ${seasonLabel}에서 #${rank}을 달성해 후쥬페이 ${rewardText}를 받을 수 있어요.`;
  }
}

function getMessagesLoadingText() {
  switch (getLang()) {
    case "ja":
      return "メッセージを確認しています。";
    case "en":
      return "Checking your messages.";
    default:
      return "메세지를 확인하고 있어요.";
  }
}

function getMessagesClaimedText(rewardAmount) {
  const rewardText = formatNumber(rewardAmount);
  if (!rewardAmount) {
    switch (getLang()) {
      case "ja":
        return "この報酬はすでに受け取り済みです。";
      case "en":
        return "This reward has already been claimed.";
      default:
        return "이미 받은 보상이에요.";
    }
  }

  switch (getLang()) {
    case "ja":
      return `HujuPay ${rewardText} を受け取りました。`;
    case "en":
      return `Claimed ${rewardText} HujuPay.`;
    default:
      return `후쥬페이 ${rewardText}를 받았어요.`;
  }
}

function getMessagesFailedText() {
  switch (getLang()) {
    case "ja":
      return "メッセージを読み込めませんでした。もう一度お試しください。";
    case "en":
      return "Could not load messages. Please try again.";
    default:
      return "메세지를 불러오지 못했어요. 다시 시도해주세요.";
  }
}

function getMessagesClaimFailedText() {
  switch (getLang()) {
    case "ja":
      return "報酬を受け取れませんでした。もう一度お試しください。";
    case "en":
      return "Could not claim the reward. Please try again.";
    default:
      return "보상을 받지 못했어요. 다시 시도해주세요.";
  }
}

function getMessageArrivalBody(count = 1) {
  const safeCount = Math.max(1, Math.floor(Number(count) || 1));

  switch (getLang()) {
    case "ja":
      return safeCount > 1
        ? `新しい報酬メッセージが ${safeCount} 件届きました。ロビーのメッセージボックスで内容を確認してください。`
        : "新しい報酬メッセージが届きました。ロビーのメッセージボックスで内容を確認してください。";
    case "en":
      return safeCount > 1
        ? `${safeCount} new reward messages have arrived. Please check the message box in the lobby.`
        : "A new reward message has arrived. Please check the message box in the lobby.";
    default:
      return safeCount > 1
        ? `새 보상 메시지 ${safeCount}개가 도착했습니다. 로비의 메시지함에서 내용을 확인해주세요.`
        : "새 보상 메시지가 도착했습니다. 로비의 메시지함에서 내용을 확인해주세요.";
  }
}

function maybeOpenLobbyRewardMessagePrompt(messages = []) {
  if (!state.authUser?.uid || elements.lobbyScreen.hidden || state.phase !== "ready") {
    return;
  }

  const pendingRewardMessages = getUnalertedRewardMessages(messages);
  if (!pendingRewardMessages.length || !elements.messageArrivalModal?.hidden) {
    return;
  }

  messageNotificationState.pendingRewardPromptIds = pendingRewardMessages
    .map((message) => message.messageId)
    .filter(Boolean);

  setMessageArrivalCopy({
    title: t("messages.arrivalTitle"),
    body: getMessageArrivalBody(pendingRewardMessages.length)
  });
  openMessageArrivalModal();
}

function closeLobbyRewardMessagePrompt({ markAlerted = true } = {}) {
  if (markAlerted && messageNotificationState.pendingRewardPromptIds.length) {
    const promptMessages = (profileModalState.messages || []).filter((message) => messageNotificationState.pendingRewardPromptIds.includes(message.messageId));
    markRewardMessagesAlerted(promptMessages);
  }

  messageNotificationState.pendingRewardPromptIds = [];
  closeMessageArrivalModal();
}

function getLobbyChatCooldownLabel(seconds) {
  return t("chat.cooldown").replace("{seconds}", String(Math.max(0, seconds)));
}

function setLobbyChatFeedback(text = "", tone = "info") {
  lobbyChatState.statusText = text;
  lobbyChatState.statusTone = tone;
  setLobbyChatStatus(text, tone);
}

function renderLobbyChatFromState() {
  renderLobbyChatMessages(lobbyChatState.messages, {
    currentUid: state.authUser?.uid || ""
  });
}

function clearLobbyChatCooldownTimer() {
  if (lobbyChatState.cooldownTimerId) {
    window.clearTimeout(lobbyChatState.cooldownTimerId);
    lobbyChatState.cooldownTimerId = 0;
  }
}

function scheduleLobbyChatComposerRefresh() {
  clearLobbyChatCooldownTimer();

  const remainingMs = lobbyChatState.cooldownUntil - Date.now();
  if (remainingMs <= 0) {
    return;
  }

  lobbyChatState.cooldownTimerId = window.setTimeout(() => {
    syncLobbyChatComposerState();
    scheduleLobbyChatComposerRefresh();
  }, Math.min(remainingMs, 250));
}

function syncLobbyChatComposerState() {
  if (!elements.chatInput || !elements.chatSendButton) {
    return;
  }

  const isLoggedIn = Boolean(state.authUser?.uid);
  const cooldownSeconds = Math.max(0, Math.ceil((lobbyChatState.cooldownUntil - Date.now()) / 1000));
  const hasText = Boolean(String(elements.chatInput.value || "").trim());

  if (elements.chatGuestGate) {
    elements.chatGuestGate.hidden = isLoggedIn;
  }

  let placeholder = isLoggedIn ? t("chat.placeholder") : t("chat.loginPlaceholder");
  let buttonLabel = t("chat.send");
  let inputDisabled = !isLoggedIn;
  let sendDisabled = !isLoggedIn || !hasText;

  if (lobbyChatState.sending) {
    buttonLabel = t("chat.sending");
    inputDisabled = true;
    sendDisabled = true;
  } else if (cooldownSeconds > 0) {
    buttonLabel = getLobbyChatCooldownLabel(cooldownSeconds);
    sendDisabled = true;
  }

  setLobbyChatComposerState({
    inputDisabled,
    sendDisabled,
    placeholder,
    buttonLabel
  });
}

function stopLobbyChatSubscription() {
  if (typeof lobbyChatState.unsubscribe === "function") {
    lobbyChatState.unsubscribe();
  }

  lobbyChatState.unsubscribe = null;
}

function startLobbyChatSubscription() {
  if (!elements.chatMessageList) {
    return;
  }

  stopLobbyChatSubscription();
  setLobbyChatFeedback(t("chat.loading"));

  try {
    lobbyChatState.unsubscribe = subscribeLobbyChat({
      onMessages(messages) {
        lobbyChatState.messages = messages;
        renderLobbyChatFromState();
        setLobbyChatFeedback("");
      },
      onError(error) {
        console.warn("Failed to subscribe to lobby chat.", error);
        setLobbyChatFeedback(t("chat.failed"), "error");
      }
    });
  } catch (error) {
    console.warn("Lobby chat is unavailable.", error);
    setLobbyChatFeedback(t("chat.failed"), "error");
  }
}

function getActiveNickname() {
  return getMemberDisplayName() || normalizeName(state.nickname) || getGuestNickname();
}

async function isNicknameAvailable(name) {
  const payload = await checkNicknameAvailabilityFromProvider({
    playerId: state.playerId,
    name
  });

  return Boolean(payload?.available);
}


function getNicknameTakenMessage(suggestion) {
  switch (getLang()) {
    case "ja":
      return `That nickname is already taken. Try ${suggestion}.`;
    case "en":
      return `That nickname is already taken. Try ${suggestion}.`;
    default:
      return `이미 사용 중인 닉네임이에요. ${suggestion} 같은 이름을 써보세요.`;
  }
}

function getAutoNicknameMessage(nickname) {
  switch (getLang()) {
    case "ja":
      return `Nickname was empty, so ${nickname} was assigned.`;
    case "en":
      return `Nickname was empty, so ${nickname} was assigned.`;
    default:
      return `닉네임이 비어 있어서 ${nickname} 이름으로 시작했어요.`;
  }
}

function getNicknameCheckFailedMessage() {
  switch (getLang()) {
    case "ja":
      return "Could not verify the nickname. Please try again.";
    case "en":
      return "Could not verify the nickname. Please try again.";
    default:
      return "닉네임 중복확인을 하지 못했어요. 다시 시도해주세요.";
  }
}

function getRequestedAuthNickname() {
  return normalizeName(elements.authNicknameInput.value);
}

function getRequestedProfileNickname() {
  return normalizeName(elements.profileNicknameInput.value);
}

function getAuthNicknameRequiredMessage() {
  switch (getLang()) {
    case "ja":
      return "Please enter a nickname.";
    case "en":
      return "Please enter a nickname.";
    default:
      return "닉네임을 입력해주세요.";
  }
}

function getAuthNicknameTakenMessage() {
  switch (getLang()) {
    case "ja":
      return "That nickname is already taken. Please choose another one.";
    case "en":
      return "That nickname is already taken. Please choose another one.";
    default:
      return "이미 사용 중인 닉네임이에요. 다른 닉네임으로 정해주세요.";
  }
}

function getAuthNicknameCheckFailedMessage() {
  switch (getLang()) {
    case "ja":
      return "Could not verify the nickname. Please try again.";
    case "en":
      return "Could not verify the nickname. Please try again.";
    default:
      return "닉네임 확인에 실패했어요. 다시 시도해주세요.";
  }
}

function getAuthNicknameAvailableMessage() {
  switch (getLang()) {
    case "ja":
      return "That nickname is available.";
    case "en":
      return "That nickname is available.";
    default:
      return "사용 가능한 닉네임이에요.";
  }
}

function getAuthNicknameNeedsCheckMessage() {
  switch (getLang()) {
    case "ja":
      return "Please run nickname check first.";
    case "en":
      return "Please run nickname check first.";
    default:
      return "닉네임 중복확인을 먼저 해주세요.";
  }
}

function getProfileNicknameSavedMessage() {
  switch (getLang()) {
    case "ja":
      return "Your profile nickname was updated. Ranking names will update the next time you save a score.";
    case "en":
      return "Your profile nickname was updated. Ranking names will update the next time you save a score.";
    default:
      return "프로필 닉네임을 저장했어요. 랭킹 이름은 다음 점수 저장부터 반영돼요.";
  }
}

function getProfileNicknameUnchangedMessage() {
  switch (getLang()) {
    case "ja":
      return "That nickname is already your current one.";
    case "en":
      return "That nickname is already your current one.";
    default:
      return "지금 쓰는 닉네임과 같아요.";
  }
}

function getSignedInIntroMessage(email) {
  switch (getLang()) {
    case "ja":
      return `Signed in as ${email}.`;
    case "en":
      return `Signed in as ${email}.`;
    default:
      return `${email} 계정으로 로그인했어요.`;
  }
}

function getSignedInSummary(email) {
  switch (getLang()) {
    case "ja":
      return `Your ${email} account is ready to stay linked with this browser's play records.`;
    case "en":
      return `Your ${email} account is ready to stay linked with this browser's play records.`;
    default:
      return `${email} 계정과 이 브라우저 기록을 연결해서 계속 저장할 수 있어요.`;
  }
}

function getPasswordMismatchMessage() {
  switch (getLang()) {
    case "ja":
      return "Password confirmation does not match.";
    case "en":
      return "Password confirmation does not match.";
    default:
      return "비밀번호 확인이 일치하지 않아요.";
  }
}

function getPasswordTooShortMessage(minLength = AUTH_MIN_PASSWORD_LENGTH) {
  switch (getLang()) {
    case "ja":
      return `Password must be at least ${minLength} characters long.`;
    case "en":
      return `Password must be at least ${minLength} characters long.`;
    default:
      return `비밀번호는 ${minLength}자 이상으로 입력해주세요.`;
  }
}

function getResetPasswordPromptMessage() {
  switch (getLang()) {
    case "ja":
      return "Enter the email address you signed up with.";
    case "en":
      return "Enter the email address you signed up with.";
    default:
      return "가입한 이메일을 입력해주세요.";
  }
}

function getResetPasswordSentMessage(email) {
  switch (getLang()) {
    case "ja":
      return `Password reset link sent to ${email}.`;
    case "en":
      return `Password reset link sent to ${email}.`;
    default:
      return `${email} 주소로 비밀번호 재설정 링크를 보냈어요.`;
  }
}

function getSignOutFailedMessage() {
  switch (getLang()) {
    case "ja":
      return "Could not sign out. Please try again.";
    case "en":
      return "Could not sign out. Please try again.";
    default:
      return "로그아웃에 실패했어요. 다시 시도해주세요.";
  }
}

async function handleSignOut() {
  try {
    await signOutCurrentUser();
  } catch (error) {
    console.warn("Failed to sign out.", error);
    elements.authSummaryText.textContent = getSignOutFailedMessage();
  }
}

function getProfileLoadingMessage() {
  switch (getLang()) {
    case "ja":
      return "Checking your Season 0 record.";
    case "en":
      return "Checking your Season 0 record.";
    default:
      return "시즌 0 기록을 확인하고 있어요.";
  }
}

function getProfileFailedMessage() {
  switch (getLang()) {
    case "ja":
      return "Could not load your Season 0 record. Please try again.";
    case "en":
      return "Could not load your Season 0 record. Please try again.";
    default:
      return "시즌 0 기록을 불러오지 못했어요. 다시 시도해주세요.";
  }
}

function getProfilePartialFailedMessage() {
  switch (getLang()) {
    case "ja":
      return "Some season records could not be loaded.";
    case "en":
      return "Some season records could not be loaded.";
    default:
      return "일부 시즌 기록을 불러오지 못했어요.";
  }
}

function getProfileSummaryText(linkedCount) {
  const unit = linkedCount === 1 ? "key" : "keys";
  switch (getLang()) {
    case "ja":
      return `Looking up Season 0 records using ${linkedCount} browser-linked identity ${unit} on this account.`;
    case "en":
      return `Looking up Season 0 records using ${linkedCount} browser-linked identity ${unit} on this account.`;
    default:
      return `이 계정에 연결된 브라우저 기록 ${linkedCount}개를 기준으로 시즌 0 기록을 찾고 있어요.`;
  }
}

function getCurrentSeasonSummaryText(linkedCount) {
  const unit = linkedCount === 1 ? "key" : "keys";
  switch (getLang()) {
    case "ja":
      return `Checking this account's current season record using ${linkedCount} linked browser identity ${unit}.`;
    case "en":
      return `Checking this account's current season record using ${linkedCount} linked browser identity ${unit}.`;
    default:
      return `이 계정에 연결된 브라우저 기록 ${linkedCount}개를 기준으로 현재 시즌 기록을 확인하고 있어요.`;
  }
}

function getAuthErrorMessage(error) {
  const code = String(error?.code || "").trim();

  switch (code) {
    case "auth/email-already-in-use":
      switch (getLang()) {
        case "ja":
          return "That email address is already in use.";
        case "en":
          return "That email address is already in use.";
        default:
          return "이미 사용 중인 이메일이에요.";
      }
    case "auth/invalid-email":
      switch (getLang()) {
        case "ja":
          return "Please check the email address format.";
        case "en":
          return "Please check the email address format.";
        default:
          return "이메일 형식을 다시 확인해주세요.";
      }
    case "auth/user-not-found":
    case "auth/invalid-credential":
    case "auth/wrong-password":
      switch (getLang()) {
        case "ja":
          return "Incorrect email address or password.";
        case "en":
          return "Incorrect email address or password.";
        default:
          return "이메일 또는 비밀번호가 올바르지 않아요.";
      }
    case "auth/weak-password":
      return getPasswordTooShortMessage();
    case "auth/too-many-requests":
      switch (getLang()) {
        case "ja":
          return "Too many attempts. Please wait a bit and try again.";
        case "en":
          return "Too many attempts. Please wait a bit and try again.";
        default:
          return "시도가 너무 많아요. 잠시 후 다시 시도해주세요.";
      }
    case "auth/network-request-failed":
      switch (getLang()) {
        case "ja":
          return "Please check your network connection and try again.";
        case "en":
          return "Please check your network connection and try again.";
        default:
          return "네트워크 연결을 확인한 뒤 다시 시도해주세요.";
      }
    case "auth/missing-email":
      return getResetPasswordPromptMessage();
    case "auth/operation-not-allowed":
      switch (getLang()) {
        case "ja":
          return "Enable Email/Password sign-in in Firebase Auth first.";
        case "en":
          return "Enable Email/Password sign-in in Firebase Auth first.";
        default:
          return "Firebase Auth에서 이메일/비밀번호 로그인을 먼저 켜주세요.";
      }
    default:
      switch (getLang()) {
        case "ja":
          return "Something went wrong during authentication. Please try again.";
        case "en":
          return "Something went wrong during authentication. Please try again.";
        default:
          return "인증 처리 중 오류가 발생했어요. 다시 시도해주세요.";
      }
  }
}

function getResetAuthErrorMessage(error) {
  const code = String(error?.code || "").trim();

  switch (code) {
    case "auth/invalid-email":
      return getAuthErrorMessage(error);
    case "auth/user-not-found":
      switch (getLang()) {
        case "ja":
          return "No account was found for that email address.";
        case "en":
          return "No account was found for that email address.";
        default:
          return "가입된 계정을 찾지 못했어요. 이메일을 다시 확인해주세요.";
      }
    case "auth/too-many-requests":
    case "auth/network-request-failed":
    case "auth/operation-not-allowed":
    case "auth/missing-email":
      return getAuthErrorMessage(error);
    default:
      switch (getLang()) {
        case "ja":
          return "Could not send the reset link. Please try again.";
        case "en":
          return "Could not send the reset link. Please try again.";
        default:
          return "재설정 링크를 보내지 못했어요. 다시 시도해주세요.";
      }
  }
}

function clearAuthValidation() {
  elements.authConfirmInput.setCustomValidity("");
}

function setPasswordVisibility(target, visible) {
  const isVisible = Boolean(visible);
  const input = target === "confirm" ? elements.authConfirmInput : elements.authPasswordInput;
  const button = target === "confirm" ? elements.authConfirmToggleButton : elements.authPasswordToggleButton;

  input.type = isVisible ? "text" : "password";
  button.dataset.visible = String(isVisible);
  button.setAttribute("aria-label", isVisible ? t("auth.hidePassword") : t("auth.showPassword"));
}

function resetAuthVisibility() {
  authModalState.passwordVisible = false;
  authModalState.confirmVisible = false;
  setPasswordVisibility("password", false);
  setPasswordVisibility("confirm", false);
}

function setAuthNicknameStatus(text = "", tone = "info") {
  elements.authNicknameStatus.textContent = text;
  elements.authNicknameStatus.hidden = !text;

  if (!text) {
    delete elements.authNicknameStatus.dataset.tone;
    return;
  }

  elements.authNicknameStatus.dataset.tone = tone;
}

function resetAuthNicknameCheck() {
  authModalState.nicknameCheckedValue = "";
  authModalState.nicknameAvailable = false;
  setAuthNicknameStatus("");
}

async function runAuthNicknameCheck() {
  const requestedNickname = getRequestedAuthNickname();

  if (!requestedNickname) {
    setAuthNicknameStatus(getAuthNicknameRequiredMessage(), "error");
    elements.authNicknameInput.focus();
    return false;
  }

  try {
    const isAvailable = await isNicknameAvailable(requestedNickname);

    authModalState.nicknameCheckedValue = requestedNickname;
    authModalState.nicknameAvailable = isAvailable;

    if (!isAvailable) {
      setAuthNicknameStatus(getAuthNicknameTakenMessage(), "error");
      elements.authNicknameInput.focus();
      return false;
    }

    setAuthNicknameStatus(getAuthNicknameAvailableMessage(), "success");
    return true;
  } catch {
    resetAuthNicknameCheck();
    setAuthNicknameStatus(getAuthNicknameCheckFailedMessage(), "error");
    return false;
  }
}

function syncEmailDomainSelect() {
  const email = String(elements.authEmailInput.value || "").trim().toLowerCase();
  const [, domain = ""] = email.split("@");

  if (domain && [...elements.authEmailDomainSelect.options].some((option) => option.value === domain)) {
    elements.authEmailDomainSelect.value = domain;
    return;
  }

  elements.authEmailDomainSelect.value = "";
}

function applySelectedEmailDomain() {
  const domain = String(elements.authEmailDomainSelect.value || "").trim().toLowerCase();
  if (!domain) {
    return;
  }

  const currentEmail = String(elements.authEmailInput.value || "").trim();
  const [localPart = ""] = currentEmail.split("@");

  if (localPart) {
    elements.authEmailInput.value = `${localPart}@${domain}`;
    elements.authEmailInput.focus();
    return;
  }

  elements.authEmailInput.value = `@${domain}`;
  elements.authEmailInput.focus();
  elements.authEmailInput.setSelectionRange(0, 0);
}

function clearAuthStatusIfIdle() {
  if (!authModalState.busy) {
    setAuthStatus("");
  }
}

function resetAuthForm({ preserveEmail = true } = {}) {
  const currentEmail = preserveEmail ? elements.authEmailInput.value.trim() : "";
  elements.authForm.reset();
  elements.authEmailInput.value = currentEmail;
  syncEmailDomainSelect();
  elements.authNicknameInput.value = "";
  elements.authPasswordInput.value = "";
  elements.authConfirmInput.value = "";
  clearAuthValidation();
  resetAuthVisibility();
  resetAuthNicknameCheck();
}

function setAuthMode(mode = "login") {
  authModalState.mode = ["login", "signup", "reset"].includes(mode) ? mode : "login";
  clearAuthValidation();
  resetAuthNicknameCheck();
  setAuthModalMode(authModalState.mode);
  setAuthSubmitState({ busy: authModalState.busy, mode: authModalState.mode });
  setAuthStatus("");
}

function openAuthDialog(mode = "login") {
  setAuthMode(mode);
  resetAuthForm({ preserveEmail: true });
  closeLobbyRewardMessagePrompt({ markAlerted: false });
  closeMessagesModal();
  closeSettingsModal();
  openAuthModal();
  syncMobileNavigationState();
  requestAnimationFrame(() => {
    elements.authEmailInput.focus();
  });
}

function closeAuthDialog() {
  authModalState.busy = false;
  setAuthSubmitState({ busy: false, mode: authModalState.mode });
  closeAuthModal();
  resetAuthForm({ preserveEmail: false });
  syncMobileNavigationState();
}

function openSettingsDialog() {
  closeLobbyRewardMessagePrompt({ markAlerted: false });
  closeAuthDialog();
  closeMessagesModal();
  closeProfileModal();
  openSettingsModal();
  syncMobileNavigationState();
}

function closeSettingsDialog() {
  closeSettingsModal();
  syncMobileNavigationState();
}

function closeLobbyOverlays() {
  closeAuthDialog();
  closeLobbyRewardMessagePrompt({ markAlerted: false });
  closeMessagesModal();
  closeProfileModal();
  closeSettingsModal();
}

async function syncAuthenticatedAccount() {
  if (isPlaytestActive() || !state.authUser) {
    return;
  }

  try {
    const linkResult = await syncAccountIdentity({
      user: state.authUser,
      playerId: state.playerId,
      nickname: state.nickname || getMemberDisplayName(state.authUser)
    });

    if (linkResult?.status === "conflict") {
      console.warn("Identity link conflict detected for current playerId.");
    }
  } catch (error) {
    console.warn("Failed to sync account identity.", error);
  }
}

function setProfileNicknameBusy(busy) {
  profileModalState.nicknameBusy = busy;
  elements.profileNicknameInput.disabled = busy;
  elements.profileNicknameSaveButton.disabled = busy;
  elements.profileNicknameCancelButton.disabled = busy;
  elements.profileNicknameEditButton.disabled = busy;
}

function setProfileNicknameEditing(editing, { focus = false } = {}) {
  profileModalState.editingNickname = Boolean(editing);
  elements.profileNicknameEditButton.hidden = profileModalState.editingNickname;
  elements.profileNicknameForm.hidden = !profileModalState.editingNickname;
  elements.profileNicknameInput.value = getMemberDisplayName(state.authUser) || state.nickname || "";
  setProfileNicknameBusy(profileModalState.nicknameBusy);

  if (profileModalState.editingNickname && focus) {
    requestAnimationFrame(() => {
      elements.profileNicknameInput.focus();
      elements.profileNicknameInput.select();
    });
  }
}

function updateAuthUi() {
  const isLoggedIn = Boolean(state.authUser?.uid);
  const displayName = getProfileDisplayName();
  const email = state.authUser?.email || "";
  const authActionLabel = isLoggedIn ? t("auth.logout") : t("auth.login");
  const mobileAccountLabel = isLoggedIn ? t("mobileNav.info") : t("mobileNav.login");

  elements.accountCard.hidden = true;
  elements.authModeBadge.classList.toggle("account-badge--guest", !isLoggedIn);
  elements.authModeBadge.classList.toggle("account-badge--member", isLoggedIn);
  elements.authModeBadge.textContent = isLoggedIn ? t("auth.memberBadge") : t("auth.guestBadge");
  elements.authDisplayName.textContent = isLoggedIn ? displayName : (state.nickname || t("auth.guestTitle"));
  elements.authSummaryText.textContent = isLoggedIn
    ? getSignedInSummary(email || displayName)
    : "";
  elements.authSummaryText.hidden = !isLoggedIn;
  elements.profileInfoButton.hidden = !isLoggedIn;
  elements.mobileShopButton.hidden = false;
  elements.introLoginButton.textContent = authActionLabel;
  elements.lobbyLoginButton.textContent = authActionLabel;
  elements.mobileAccountButton.textContent = mobileAccountLabel;
  elements.introAuthState.hidden = true;
  elements.introAuthState.textContent = isLoggedIn ? getSignedInIntroMessage(email || displayName) : "";
  elements.introStartButton.textContent = t("intro.guestStart");
  updateMessagesButtonLabel();
  syncLobbyChatComposerState();
  renderLobbyChatFromState();
}

async function refreshAccountWallet() {
  if (!state.authUser?.uid || !isAccountWalletEnabled()) {
    state.hujupayBalance = 0;
    state.hujupayEarnedTotal = 0;
    state.equippedSkin = "skin_0";
    state.ownedSkins = [];
    updateLobbyPlayerInfo();
    return;
  }

  const activeUid = state.authUser.uid;

  try {
    if (isAccountRewardAutomationEnabled()) {
      await syncSeasonHujupayRewards({ uid: activeUid, season: CURRENT_SEASON });
    }
    const identity = await fetchAccountIdentity({ uid: activeUid });

    if (state.authUser?.uid !== activeUid) {
      return;
    }

    state.hujupayBalance = identity.hujupayBalance || 0;
    state.hujupayEarnedTotal = identity.hujupayEarnedTotal || 0;
    state.equippedSkin = identity.equippedSkin || "skin_0";
    state.ownedSkins = Array.isArray(identity.ownedSkins) ? identity.ownedSkins : [];
  } catch (error) {
    console.warn("Failed to refresh HujuPay wallet.", error);
  }

  updateLobbyPlayerInfo();
}

function refreshShopState() {
  const isGuest = !state.authUser?.uid || !isAccountShopEnabled();
  renderShopState({
    balance: isAccountShopEnabled() ? (state.hujupayBalance || 0) : 0,
    isGuest,
    equippedSkin: state.equippedSkin || "skin_0",
    ownedSkins: state.ownedSkins || []
  });
}

async function handleLobbyChatSubmit() {
  if (!elements.chatInput) {
    return;
  }

  if (!state.authUser?.uid) {
    setLobbyChatFeedback(t("chat.loginRequired"), "error");
    openAuthDialog("login");
    return;
  }

  const text = String(elements.chatInput.value || "").trim();
  if (!text || lobbyChatState.sending || lobbyChatState.cooldownUntil > Date.now()) {
    syncLobbyChatComposerState();
    return;
  }

  lobbyChatState.sending = true;
  syncLobbyChatComposerState();

  try {
    await sendLobbyChatMessage({
      uid: state.authUser.uid,
      nickname: getActiveNickname(),
      text
    });
    elements.chatInput.value = "";
    lobbyChatState.cooldownUntil = Date.now() + LOBBY_CHAT_COOLDOWN_MS;
    setLobbyChatFeedback("");
  } catch (error) {
    console.warn("Failed to send lobby chat message.", error);
    setLobbyChatFeedback(t("chat.failed"), "error");
  } finally {
    lobbyChatState.sending = false;
    syncLobbyChatComposerState();
    scheduleLobbyChatComposerRefresh();
  }
}

function collectLinkedPlayerIds(accountIdentity = null) {
  return [...new Set(
    [
      state.playerId,
      accountIdentity?.firstLinkedPlayerId,
      accountIdentity?.lastSeenPlayerId,
      ...(Array.isArray(accountIdentity?.linkedPlayerIds) ? accountIdentity.linkedPlayerIds : [])
    ]
      .map((playerId) => String(playerId || "").trim())
      .filter(Boolean)
  )];
}

async function syncRankingNicknameForSeason({ season, user, nickname, linkedPlayerIds }) {
  if (!user?.uid || !nickname || !linkedPlayerIds.length) {
    return false;
  }

  const { rankings = [] } = await fetchAllRankingsFromProvider({ season });
  const existingEntry = rankings.find((entry) => linkedPlayerIds.includes(String(entry?.playerId || "").trim()));

  if (!existingEntry?.playerId || !Number.isFinite(Number(existingEntry.score))) {
    return false;
  }

  const existingNickname = normalizeName(existingEntry.nicknameSnapshot || existingEntry.name);
  const existingUid = String(existingEntry.uid || "").trim();
  if (existingNickname === nickname && existingUid === user.uid) {
    return false;
  }

  const result = await submitScoreToProvider({
    season,
    playerId: existingEntry.playerId,
    uid: user.uid,
    name: nickname,
    score: existingEntry.score
  });

  if (season === CURRENT_SEASON && Array.isArray(result?.rankings)) {
    state.rankings = result.rankings;
    renderRankingList(state.rankings);
    setRankingStatus(state.rankings.length ? t("ranking.best") : t("ranking.empty"));
  }

  return true;
}

async function syncAuthenticatedRankingNicknames({ user = state.authUser, nickname = "" } = {}) {
  if (isPlaytestActive() || !user?.uid) {
    return false;
  }

  const safeNickname = normalizeName(nickname || getMemberDisplayName(user) || state.nickname);
  if (!safeNickname) {
    return false;
  }

  const accountIdentity = await fetchAccountIdentity({ uid: user.uid });
  const linkedPlayerIds = collectLinkedPlayerIds(accountIdentity);
  if (!linkedPlayerIds.length) {
    return false;
  }

  const seasonsToSync = [...new Set([CURRENT_SEASON, PROFILE_SEASON])];
  const results = await Promise.allSettled(
    seasonsToSync.map((season) => syncRankingNicknameForSeason({
      season,
      user,
      nickname: safeNickname,
      linkedPlayerIds
    }))
  );

  return results.some((result) => result.status === "fulfilled" && result.value);
}

async function handleShopButtonClick(btn) {
  if (!isAccountShopEnabled()) {
    return;
  }

  const skinId = btn.dataset.skinId;
  const price = btn.dataset.skinPrice ? Number(btn.dataset.skinPrice) : null;
  const uid = state.authUser?.uid;

  if (!skinId || !uid) return;

  // 구매
  if (price !== null) {
    if ((state.hujupayBalance || 0) < price) {
      alert(t("shop.notEnough"));
      return;
    }
    if (!confirm(t("shop.buyConfirm"))) return;

    btn.disabled = true;
    try {
      const result = await purchaseSkin({ uid, skinId, price });
      state.hujupayBalance = result.newBalance;
      state.ownedSkins = result.ownedSkins;
      updateLobbyPlayerInfo();
      refreshShopState();
    } catch {
      alert(t("shop.error"));
      btn.disabled = false;
    }
    return;
  }

  // 장착
  btn.disabled = true;
  try {
    await equipSkin({ uid, skinId });
    state.equippedSkin = skinId;
    refreshShopState();
  } catch {
    alert(t("shop.error"));
    btn.disabled = false;
  }
}

function renderProfileFromState() {
  const currentSeasonProfile = profileModalState.currentSeasonProfile;
  const season1Profile = profileModalState.season1Profile;
  const period = getRankingSeasonConfig(PROFILE_SEASON).period || t("ranking.season1ArchivePeriod");
  const accountName = getProfileDisplayName(state.authUser) || "-";
  const summaryCounts = [
    currentSeasonProfile?.linkedPlayerIds?.length || 0,
    season1Profile?.linkedPlayerIds?.length || 0
  ].filter(Boolean);
  const linkedCount = summaryCounts.length ? Math.max(...summaryCounts) : 1;
  const walletEnabled = isAccountWalletEnabled();
  const walletBalance = walletEnabled ? (currentSeasonProfile?.identity?.hujupayBalance ?? state.hujupayBalance) : 0;
  const walletTotalEarned = walletEnabled ? (currentSeasonProfile?.identity?.hujupayEarnedTotal ?? state.hujupayEarnedTotal) : 0;
  const seasonEarned = walletEnabled ? (currentSeasonProfile?.seasonSummary?.hujupayEarned ?? 0) : 0;

  renderProfileSummary({
    name: accountName,
    summary: "",
    period,
    walletBalance: formatNumber(walletBalance),
    walletSummary: walletEnabled ? getHujupaySummaryText({
      totalEarned: walletTotalEarned,
      seasonEarned
    }) : ""
  });
  renderProfileSeasonRecord(currentSeasonProfile?.record || null, {
    container: elements.profileCurrentSeasonRecord,
    emptyText: currentSeasonProfile?.unavailable
      ? t("profile.unavailable")
      : t("profile.currentSeasonNoRecord")
  });
  renderProfileSeasonRecord(season1Profile?.record || null, {
    container: elements.profileSeason1Record,
    emptyText: season1Profile?.unavailable
      ? t("profile.unavailable")
      : t("profile.noRecord")
  });
  renderProfileSeasonTopRankings(season1Profile?.topRankings || [], {
    listElement: elements.profileSeason1TopList,
    emptyText: season1Profile?.unavailable
      ? t("profile.unavailable")
      : t("ranking.norecords")
  });
  setProfileNicknameEditing(profileModalState.editingNickname);
  updateMessagesButtonLabel();
}

function applyNicknameToProfileRankingState(nickname) {
  const safeNickname = normalizeName(nickname);
  if (!safeNickname) {
    return;
  }

  [profileModalState.currentSeasonProfile, profileModalState.season1Profile].forEach((seasonProfile) => {
    if (seasonProfile?.record) {
      seasonProfile.record.name = safeNickname;
      seasonProfile.record.nicknameSnapshot = safeNickname;
    }

    if (Array.isArray(seasonProfile?.topRankings)) {
      seasonProfile.topRankings = seasonProfile.topRankings.map((entry) => {
        if (String(entry?.playerId || "").trim() !== state.playerId) {
          return entry;
        }

        return {
          ...entry,
          name: safeNickname,
          nicknameSnapshot: safeNickname
        };
      });
    }
  });
}

async function syncSeasonRewardInbox() {
  if (!state.authUser?.uid || !isAccountRewardAutomationEnabled()) {
    return;
  }

  let seasonProfile = profileModalState.season1Profile;

  if (!seasonProfile || seasonProfile.unavailable) {
    try {
      seasonProfile = await fetchSeasonProfile({
        user: state.authUser,
        currentPlayerId: state.playerId,
        season: PROFILE_SEASON
      });
      profileModalState.season1Profile = seasonProfile;
    } catch (error) {
      console.warn("Failed to sync season reward inbox.", error);
      return;
    }
  }

  const rewardRank = seasonProfile?.record?.rank;
  const rewardAmount = getSeasonRankingRewardAmount(rewardRank);
  if (!rewardAmount) {
    return;
  }

  const seasonConfig = getRankingSeasonConfig(PROFILE_SEASON);
  await ensureSeasonRewardMessage({
    uid: state.authUser.uid,
    season: PROFILE_SEASON,
    seasonLabel: seasonConfig.displayName,
    rank: rewardRank,
    rewardAmount,
    title: getSeasonRewardMessageTitle(seasonConfig.displayName),
    body: getSeasonRewardMessageBody({
      seasonLabel: seasonConfig.displayName,
      rank: rewardRank,
      rewardAmount
    })
  });
}

async function refreshMessagesInbox({ showLoading = false, triggerLobbyPrompt = false } = {}) {
  if (!state.authUser?.uid || !isAccountMessageInboxEnabled()) {
    profileModalState.messages = [];
    renderMessages([]);
    setMessagesStatus("");
    updateMessagesButtonLabel();
    resetMessageNotifications();
    return [];
  }

  if (showLoading) {
    setMessagesStatus(getMessagesLoadingText());
  }

  try {
    await syncSeasonRewardInbox();
    const messages = await fetchAccountMessages({ uid: state.authUser.uid });
    profileModalState.messages = messages;
    renderMessages(messages);
    setMessagesStatus("");
    updateMessageNotificationState(messages);
    if (triggerLobbyPrompt) {
      maybeOpenLobbyRewardMessagePrompt(messages);
    }
    updateMessagesButtonLabel();
    return messages;
  } catch (error) {
    console.warn("Failed to refresh messages inbox.", error);
    profileModalState.messages = [];
    renderMessages([]);
    setMessagesStatus(getMessagesFailedText(), "error");
    resetMessageNotifications();
    updateMessagesButtonLabel();
    return [];
  }
}

async function openMessagesInbox() {
  if (!isAccountMessageInboxEnabled()) {
    return;
  }

  if (!state.authUser?.uid) {
    openAuthDialog("login");
    return;
  }

  closeLobbyRewardMessagePrompt({ markAlerted: true });
  openMessagesModal();
  syncMobileNavigationState();
  renderMessages(profileModalState.messages || []);
  const messages = await refreshMessagesInbox({ showLoading: true });
  markMessagesSeen(messages);
  markRewardMessagesAlerted(messages);
  updateMessageNotificationState(messages);
  updateMessagesButtonLabel();
}

async function claimMessageById(messageId) {
  if (!state.authUser?.uid || !messageId || !isAccountMessageClaimEnabled()) {
    return;
  }

  const button = elements.messagesList.querySelector(`[data-message-id="${messageId}"]`);
  if (button) {
    button.disabled = true;
    button.textContent = t("messages.claiming");
  }

  try {
    const result = await claimAccountMessageReward({
      uid: state.authUser.uid,
      messageId
    });

    state.hujupayBalance = result.hujupayBalance ?? state.hujupayBalance;
    state.hujupayEarnedTotal = result.hujupayEarnedTotal ?? state.hujupayEarnedTotal;
    updateLobbyPlayerInfo();

    if (!profileModalState.currentSeasonProfile) {
      profileModalState.currentSeasonProfile = {};
    }

    if (!profileModalState.currentSeasonProfile.identity) {
      profileModalState.currentSeasonProfile.identity = {};
    }

    profileModalState.currentSeasonProfile.identity.hujupayBalance = state.hujupayBalance;
    profileModalState.currentSeasonProfile.identity.hujupayEarnedTotal = state.hujupayEarnedTotal;
    renderProfileFromState();

    await refreshMessagesInbox();
    setMessagesStatus(getMessagesClaimedText(result.awardedAmount || 0), "success");
  } catch (error) {
    console.warn("Failed to claim message reward.", error);
    setMessagesStatus(getMessagesClaimFailedText(), "error");
    await refreshMessagesInbox();
  }
}

async function saveProfileNickname() {
  if (isPlaytestActive()) {
    setProfileStatus("Playtest mode does not save account changes.", "error");
    return;
  }

  if (!state.authUser?.uid || profileModalState.nicknameBusy) {
    return;
  }

  const requestedNickname = getRequestedProfileNickname();
  const currentNickname = getMemberDisplayName(state.authUser);

  if (!requestedNickname) {
    setProfileStatus(getAuthNicknameRequiredMessage(), "error");
    elements.profileNicknameInput.focus();
    return;
  }

  if (requestedNickname === currentNickname) {
    setProfileStatus(getProfileNicknameUnchangedMessage());
    setProfileNicknameEditing(false);
    return;
  }

  setProfileNicknameBusy(true);

  try {
    const isAvailable = await isNicknameAvailable(requestedNickname);

    if (!isAvailable) {
      setProfileStatus(getAuthNicknameTakenMessage(), "error");
      elements.profileNicknameInput.focus();
      return;
    }

    const updatedUser = await updateCurrentUserNickname(requestedNickname);
    await updateAccountNickname({
      uid: updatedUser.uid,
      nickname: requestedNickname
    });

    state.authUser = updatedUser;
    applyNickname(requestedNickname);
    await syncAuthenticatedRankingNicknames({
      user: updatedUser,
      nickname: requestedNickname
    });
    await refreshCurrentSeasonRank();
    applyNicknameToProfileRankingState(requestedNickname);
    updateAuthUi();
    setProfileNicknameEditing(false);
    renderProfileFromState();
    setProfileStatus(getProfileNicknameSavedMessage(), "success");
  } catch (error) {
    console.warn("Failed to update nickname.", error);
    setProfileStatus(
      error?.code ? getAuthErrorMessage(error) : getAuthNicknameCheckFailedMessage(),
      "error"
    );
  } finally {
    setProfileNicknameBusy(false);
  }
}

async function openProfileInfo() {
  if (!state.authUser) {
    openAuthDialog("login");
    return;
  }

  profileModalState.currentSeasonProfile = null;
  profileModalState.season1Profile = null;
  profileModalState.messages = [];
  profileModalState.editingNickname = false;
  profileModalState.nicknameBusy = false;
  renderProfileSummary({
    name: getProfileDisplayName(state.authUser) || "-",
    summary: "",
    period: getRankingSeasonConfig(PROFILE_SEASON).period || t("ranking.season1ArchivePeriod"),
    walletBalance: formatNumber(state.hujupayBalance),
    walletSummary: getHujupaySummaryText({
      totalEarned: state.hujupayEarnedTotal,
      seasonEarned: 0
    })
  });
  elements.profileCurrentSeasonRecord.innerHTML = "";
  elements.profileSeason1Record.innerHTML = "";
  elements.profileSeason1TopList.innerHTML = "";
  renderMessages([]);
  setProfileStatus(getProfileLoadingMessage());
  closeSettingsDialog();
  openProfileModal();
  syncMobileNavigationState();

  const [currentSeasonResult, season1Result] = await Promise.allSettled([
    fetchSeasonProfile({
      user: state.authUser,
      currentPlayerId: state.playerId,
      season: CURRENT_SEASON
    }),
    fetchSeasonProfile({
      user: state.authUser,
      currentPlayerId: state.playerId,
      season: PROFILE_SEASON
    })
  ]);

  if (currentSeasonResult.status === "fulfilled") {
    profileModalState.currentSeasonProfile = currentSeasonResult.value;
    state.hujupayBalance = currentSeasonResult.value?.identity?.hujupayBalance ?? state.hujupayBalance;
    state.hujupayEarnedTotal = currentSeasonResult.value?.identity?.hujupayEarnedTotal ?? state.hujupayEarnedTotal;
  } else {
    console.warn("Failed to load current season profile.", currentSeasonResult.reason);
    profileModalState.currentSeasonProfile = { unavailable: true, linkedPlayerIds: [], record: null, topRankings: [] };
  }

  if (season1Result.status === "fulfilled") {
    profileModalState.season1Profile = season1Result.value;
  } else {
    console.warn("Failed to load season 1 profile.", season1Result.reason);
    profileModalState.season1Profile = { unavailable: true, linkedPlayerIds: [], record: null, topRankings: [] };
  }

  if (currentSeasonResult.status === "rejected" && season1Result.status === "rejected") {
    setProfileStatus(getProfileFailedMessage(), "error");
  } else if (currentSeasonResult.status === "rejected" || season1Result.status === "rejected") {
    setProfileStatus(getProfilePartialFailedMessage(), "error");
  } else {
    setProfileStatus("");
  }

  renderProfileFromState();
  void refreshMessagesInbox();
}

function handleAuthStateChanged(user) {
  state.authReady = true;
  state.authUser = user;
  profileModalState.nicknameBusy = false;
  setLobbyChatFeedback("");

  if (state.authUser) {
    profileModalState.editingNickname = false;
    profileModalState.messages = [];
    applyNickname(getMemberDisplayName(state.authUser) || state.nickname || getGuestNickname());
    updateAuthUi();
    void (async () => {
      await syncAuthenticatedAccount();
      await syncAuthenticatedRankingNicknames({ user: state.authUser });
      await refreshCurrentSeasonRank();
    })().catch((error) => {
      console.warn("Failed to sync authenticated ranking metadata.", error);
    });
    void refreshAccountWallet();
    void refreshMessagesInbox({ triggerLobbyPrompt: true });
    closeAuthDialog();
  } else {
    clearSavedNickname();
    applyNickname(getGuestNickname());
    profileModalState.editingNickname = false;
    state.lastRank = null;
    state.hujupayBalance = 0;
    state.hujupayEarnedTotal = 0;
    updateAuthUi();
    profileModalState.currentSeasonProfile = null;
    profileModalState.season1Profile = null;
    profileModalState.messages = [];
    resetMessageNotifications();
    closeLobbyRewardMessagePrompt({ markAlerted: false });
    closeMessagesModal();
    closeProfileModal();
    closeSettingsDialog();
    if (elements.chatInput) {
      elements.chatInput.value = "";
    }
  }

  renderLobbyChatFromState();
  syncLobbyChatComposerState();
  syncMobileNavigationState();
  postPlaytestStatus();
}

function applyNickname(nickname) {
  const resolvedNickname = normalizeName(nickname) || getGuestNickname();
  state.nickname = resolvedNickname;
  elements.nicknameInput.value = resolvedNickname;

  if (state.authUser) {
    void syncAuthenticatedAccount();
  }

  updateLobbyPlayerInfo();
  postPlaytestStatus();
}

function enterPlaytestLobby() {
  pendingRoundStartNickname = "";
  state.phase = "ready";
  setLobbyMobilePanel("none");
  closeLobbyRewardMessagePrompt({ markAlerted: false });
  showLobbyScreen();
  updateLobbyPlayerInfo();
  syncMobileNavigationState();
  syncResponsiveUi();
  postPlaytestStatus();
}

function ensurePlaytestRoundStarted({ nickname = getActiveNickname() } = {}) {
  const resolvedNickname = normalizeName(nickname) || getActiveNickname() || getGuestNickname();

  if (state.phase !== "playing" && state.phase !== "submitting") {
    pendingRoundStartNickname = "";
    startRound(resolvedNickname);
    launchGame();
  }

  return resolvedNickname;
}

function applyPlaytestAdjustments({ scoreDelta = 0, timeDelta = 0, healthDelta = 0 } = {}) {
  const nextScore = Math.max(0, Math.floor((state.score || 0) + Number(scoreDelta || 0)));
  const nextTime = Math.max(1, Math.ceil((state.timeLeft || 0) + Number(timeDelta || 0)));
  const nextHealth = Math.max(1, Math.min(state.maxHealth || 1, Math.floor((state.health || 0) + Number(healthDelta || 0))));

  applyPlaytestState({
    score: nextScore,
    timeLeft: nextTime,
    health: nextHealth
  });
  postPlaytestStatus();
}

function handlePlaytestMessage(event) {
  if (!isPlaytestActive() || event.origin !== window.location.origin) {
    return;
  }

  const message = event.data;
  if (!message || message.source !== PLAYTEST_MESSAGE_SOURCE) {
    return;
  }

  switch (message.type) {
    case "playtest:status-request":
      postPlaytestStatus();
      return;
    case "playtest:go-lobby":
      enterPlaytestLobby();
      return;
    case "playtest:start":
      ensurePlaytestRoundStarted({ nickname: message.payload?.nickname });
      postPlaytestStatus();
      return;
    case "playtest:preset":
      ensurePlaytestRoundStarted({ nickname: message.payload?.nickname });
      applyPlaytestState({
        score: message.payload?.score,
        round: message.payload?.round,
        timeLeft: message.payload?.timeLeft,
        health: message.payload?.health,
        spawnTimer: message.payload?.spawnTimer
      });
      postPlaytestStatus();
      return;
    case "playtest:adjust":
      ensurePlaytestRoundStarted({ nickname: message.payload?.nickname });
      applyPlaytestAdjustments(message.payload || {});
      return;
    case "playtest:spawn":
      ensurePlaytestRoundStarted({ nickname: message.payload?.nickname });
      spawnPlaytestItemByKey(message.payload?.key, {
        x: Number.isFinite(message.payload?.x) ? message.payload.x : state.player.x,
        y: Number.isFinite(message.payload?.y) ? message.payload.y : -40
      });
      postPlaytestStatus();
      return;
    default:
      return;
  }
}

function installPlaytestBridge() {
  if (!isPlaytestActive()) {
    return;
  }

  window[PLAYTEST_BRIDGE_KEY] = {
    getStatus() {
      return getPlaytestStatusSnapshot();
    },
    goLobby() {
      enterPlaytestLobby();
      return getPlaytestStatusSnapshot();
    },
    start(payload = {}) {
      ensurePlaytestRoundStarted({ nickname: payload.nickname });
      postPlaytestStatus();
      return getPlaytestStatusSnapshot();
    },
    preset(payload = {}) {
      ensurePlaytestRoundStarted({ nickname: payload.nickname });
      applyPlaytestState({
        score: payload.score,
        round: payload.round,
        timeLeft: payload.timeLeft,
        health: payload.health,
        spawnTimer: payload.spawnTimer
      });
      postPlaytestStatus();
      return getPlaytestStatusSnapshot();
    },
    adjust(payload = {}) {
      ensurePlaytestRoundStarted({ nickname: payload.nickname });
      applyPlaytestAdjustments(payload);
      return getPlaytestStatusSnapshot();
    },
    spawn(payload = {}) {
      ensurePlaytestRoundStarted({ nickname: payload.nickname });
      const spawned = spawnPlaytestItemByKey(payload.key, {
        x: Number.isFinite(payload.x) ? payload.x : state.player.x,
        y: Number.isFinite(payload.y) ? payload.y : -40
      });
      postPlaytestStatus();
      return {
        spawned,
        status: getPlaytestStatusSnapshot()
      };
    }
  };
}

function launchGame() {
  hideGameResult();
  setLobbyMobilePanel("none");
  syncMobileNavigationState();
  showGameScreen();
  playGameMusic();
  syncResponsiveUi();
  postPlaytestStatus();
  window.setTimeout(() => {
    syncResponsiveUi();
    void requestLandscapePresentation(elements.gameScreen);
    postPlaytestStatus();
  }, 180);
}

function updateLobbyPlayerInfo() {
  const displayName = getActiveNickname() || state.nickname || "-";
  const rankText = state.lastRank ? `#${state.lastRank}` : "-";

  elements.lobbyNicknameDisplay.textContent = displayName;
  elements.lobbyRankDisplay.textContent = rankText;
  elements.hujupayCard.hidden = !state.authUser?.uid || !isAccountWalletEnabled();
  elements.hujupayBalanceDisplay.textContent = formatNumber(state.hujupayBalance);
  elements.rankingSelfName.textContent = displayName;
  elements.rankingSelfRank.textContent = rankText;
  postPlaytestStatus();
}

async function refreshCurrentSeasonRank() {
  if (!state.authUser?.uid) {
    updateLobbyPlayerInfo();
    return;
  }

  const activeUid = state.authUser.uid;

  try {
    const profile = await fetchSeasonProfile({
      user: state.authUser,
      currentPlayerId: state.playerId,
      season: CURRENT_SEASON
    });

    if (state.authUser?.uid !== activeUid) {
      return;
    }

    state.lastRank = profile?.record?.rank || null;
  } catch (error) {
    console.warn("Failed to refresh current season rank.", error);
  }

  updateLobbyPlayerInfo();
}

function queueRoundStart(nickname) {
  if (isTouchDevice() && isPortraitTouchViewport()) {
    pendingRoundStartNickname = nickname;
    setOrientationGateState({
      visible: true,
      ...getOrientationGateCopy("start")
    });
    void requestLandscapePresentation(document.documentElement);
    return;
  }

  pendingRoundStartNickname = "";
  startRound(nickname);
  launchGame();
}

function returnToLobby() {
  state.phase = "ready";
  setLobbyMobilePanel("none");
  showLobbyScreen();
  updateLobbyPlayerInfo();
  syncMobileNavigationState();
  playLobbyMusic();
  syncResponsiveUi();
  void refreshMessagesInbox({ triggerLobbyPrompt: true });
  if (!isPlaytestActive()) {
    fetchRankings();
  }
  exitLandscapePresentation();
  postPlaytestStatus();
}

function bindHoldButton(element, code) {
  if (!element) {
    return;
  }

  const press = (event) => {
    event.preventDefault();
    handleMovementKey(code, true, { trackTap: false });
  };

  const release = (event) => {
    event.preventDefault();
    handleMovementKey(code, false, { trackTap: false });
  };

  element.addEventListener("pointerdown", press);
  element.addEventListener("pointerup", release);
  element.addEventListener("pointercancel", release);
  element.addEventListener("pointerleave", release);
}

function bindTapButton(element, handler) {
  if (!element || typeof handler !== "function") {
    return;
  }

  element.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    handler();
  });
}

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName;
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}

function bindEvents() {
  elements.authEmailInput.addEventListener("input", () => {
    syncEmailDomainSelect();
    clearAuthStatusIfIdle();
  });
  elements.authEmailDomainSelect.addEventListener("change", () => {
    applySelectedEmailDomain();
    clearAuthStatusIfIdle();
  });
  elements.authNicknameInput.addEventListener("input", () => {
    resetAuthNicknameCheck();
    clearAuthStatusIfIdle();
  });
  elements.authPasswordInput.addEventListener("input", clearAuthStatusIfIdle);
  elements.profileNicknameInput.addEventListener("input", () => {
    if (!profileModalState.nicknameBusy) {
      setProfileStatus("");
    }
  });
  elements.chatInput?.addEventListener("input", () => {
    setLobbyChatFeedback("");
    syncLobbyChatComposerState();
  });
  elements.chatInput?.addEventListener("focus", () => {
    if (!state.authUser?.uid) {
      setLobbyChatFeedback(t("chat.loginRequired"), "error");
      openAuthDialog("login");
    }
  });
  elements.authConfirmInput.addEventListener("input", () => {
    clearAuthValidation();
    clearAuthStatusIfIdle();
  });

  elements.introForm.addEventListener("submit", (event) => {
    event.preventDefault();

    elements.introStartButton.disabled = true;
    try {
      applyNickname(getActiveNickname());
      showLobbyScreen();
      updateLobbyPlayerInfo();
      playLobbyMusic();
      syncResponsiveUi();
      void refreshMessagesInbox({ triggerLobbyPrompt: true });
    } finally {
      elements.introStartButton.disabled = false;
    }
  });

  elements.introLoginButton.addEventListener("click", () => {
    if (state.authUser?.uid) {
      void handleSignOut();
      return;
    }

    openAuthDialog("login");
  });

  elements.lobbyLoginButton.addEventListener("click", () => {
    if (state.authUser?.uid) {
      void handleSignOut();
      return;
    }

    openAuthDialog("login");
  });

  elements.profileInfoButton.addEventListener("click", () => {
    void openProfileInfo();
  });

  elements.profileMessagesButton.addEventListener("click", () => {
    void openMessagesInbox();
  });

  elements.chatLoginButton?.addEventListener("click", () => {
    openAuthDialog("login");
  });

  elements.chatForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await handleLobbyChatSubmit();
  });

  elements.profileNicknameEditButton.addEventListener("click", () => {
    setProfileStatus("");
    setProfileNicknameEditing(true, { focus: true });
  });

  elements.profileNicknameCancelButton.addEventListener("click", () => {
    setProfileStatus("");
    setProfileNicknameEditing(false);
  });

  elements.profileNicknameForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveProfileNickname();
  });

  elements.profileLogoutButton.addEventListener("click", () => {
    void handleSignOut();
  });

  elements.closeAuthModalButton.addEventListener("click", () => {
    closeAuthDialog();
  });

  elements.authModal.addEventListener("click", (event) => {
    if (event.target === elements.authModal) {
      closeAuthDialog();
    }
  });

  elements.closeProfileModalButton.addEventListener("click", () => {
    closeProfileModal();
    syncMobileNavigationState();
  });

  elements.profileModal.addEventListener("click", (event) => {
    if (event.target === elements.profileModal) {
      closeProfileModal();
      syncMobileNavigationState();
    }
  });

  elements.closeMessagesModalButton.addEventListener("click", () => {
    closeMessagesModal();
    syncMobileNavigationState();
  });

  elements.messagesModal.addEventListener("click", (event) => {
    if (event.target === elements.messagesModal) {
      closeMessagesModal();
      syncMobileNavigationState();
    }
  });

  elements.messageArrivalConfirmButton?.addEventListener("click", () => {
    closeLobbyRewardMessagePrompt({ markAlerted: true });
    void openMessagesInbox();
  });

  elements.messageArrivalCloseButton?.addEventListener("click", () => {
    closeLobbyRewardMessagePrompt({ markAlerted: true });
  });

  elements.messageArrivalModal?.addEventListener("click", (event) => {
    if (event.target === elements.messageArrivalModal) {
      closeLobbyRewardMessagePrompt({ markAlerted: true });
    }
  });

  elements.messagesList.addEventListener("click", (event) => {
    const button = event.target instanceof HTMLElement
      ? event.target.closest("[data-message-id]")
      : null;

    if (!button) {
      return;
    }

    const messageId = button.dataset.messageId || "";
    void claimMessageById(messageId);
  });

  elements.closeSettingsModalButton.addEventListener("click", () => {
    closeSettingsDialog();
  });

  elements.settingsModal.addEventListener("click", (event) => {
    if (event.target === elements.settingsModal) {
      closeSettingsDialog();
    }
  });

  elements.authLoginTab.addEventListener("click", () => {
    if (authModalState.mode === "login") {
      return;
    }

    setAuthMode("login");
  });

  elements.authSignupTab.addEventListener("click", () => {
    if (authModalState.mode === "signup") {
      return;
    }

    setAuthMode("signup");
  });

  elements.authModeSwitchButton.addEventListener("click", () => {
    setAuthMode(authModalState.mode === "signup" ? "login" : (authModalState.mode === "reset" ? "login" : "signup"));
  });

  elements.authNicknameCheckButton.addEventListener("click", async () => {
    if (authModalState.busy || authModalState.mode !== "signup") {
      return;
    }

    await runAuthNicknameCheck();
  });

  elements.authPasswordToggleButton.addEventListener("click", () => {
    authModalState.passwordVisible = !authModalState.passwordVisible;
    setPasswordVisibility("password", authModalState.passwordVisible);
  });

  elements.authConfirmToggleButton.addEventListener("click", () => {
    authModalState.confirmVisible = !authModalState.confirmVisible;
    setPasswordVisibility("confirm", authModalState.confirmVisible);
  });

  elements.authForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (authModalState.busy) {
      return;
    }

    const email = elements.authEmailInput.value.trim();
    const requestedNickname = getRequestedAuthNickname();
    const password = elements.authPasswordInput.value;
    const confirmPassword = elements.authConfirmInput.value;

    clearAuthValidation();
    setAuthStatus("");

    if (authModalState.mode === "reset") {
      if (!email) {
        setAuthStatus(getResetPasswordPromptMessage(), "error");
        elements.authEmailInput.focus();
        return;
      }

      authModalState.busy = true;
      setAuthSubmitState({ busy: true, mode: authModalState.mode });

      try {
        await sendPasswordResetLink(email);
        setAuthStatus(getResetPasswordSentMessage(email), "success");
      } catch (error) {
        setAuthStatus(getResetAuthErrorMessage(error), "error");
      } finally {
        authModalState.busy = false;
        setAuthSubmitState({ busy: false, mode: authModalState.mode });
      }
      return;
    }

    if (authModalState.mode === "signup") {
      if (!requestedNickname) {
        setAuthStatus(getAuthNicknameRequiredMessage(), "error");
        elements.authNicknameInput.focus();
        return;
      }

      if (!authModalState.nicknameAvailable || authModalState.nicknameCheckedValue !== requestedNickname) {
        setAuthNicknameStatus(getAuthNicknameNeedsCheckMessage(), "error");
        elements.authNicknameCheckButton.focus();
        return;
      }

      if (password.length < AUTH_MIN_PASSWORD_LENGTH) {
        setAuthStatus(getPasswordTooShortMessage(), "error");
        return;
      }

      if (password !== confirmPassword) {
        const mismatchMessage = getPasswordMismatchMessage();
        elements.authConfirmInput.setCustomValidity(mismatchMessage);
        elements.authConfirmInput.reportValidity();
        setAuthStatus(mismatchMessage, "error");
        return;
      }

      try {
        const isAvailable = await isNicknameAvailable(requestedNickname);

        if (!isAvailable) {
          authModalState.nicknameAvailable = false;
          setAuthStatus(getAuthNicknameTakenMessage(), "error");
          setAuthNicknameStatus(getAuthNicknameTakenMessage(), "error");
          elements.authNicknameInput.focus();
          return;
        }
      } catch {
        setAuthStatus(getAuthNicknameCheckFailedMessage(), "error");
        return;
      }
    }

    authModalState.busy = true;
    setAuthSubmitState({ busy: true, mode: authModalState.mode });

    try {
      if (authModalState.mode === "signup") {
        await signUpWithEmail({
          email,
          password,
          nickname: requestedNickname
        });
      } else {
        await signInWithEmail({ email, password });
      }

      await syncAuthenticatedAccount();
      closeAuthDialog();
    } catch (error) {
      setAuthStatus(getAuthErrorMessage(error), "error");
    } finally {
      authModalState.busy = false;
      setAuthSubmitState({ busy: false, mode: authModalState.mode });
    }
  });

  elements.authResetPasswordButton.addEventListener("click", async () => {
    if (authModalState.busy) {
      return;
    }

    setAuthMode("reset");
    elements.authPasswordInput.value = "";
    elements.authConfirmInput.value = "";
    elements.authEmailInput.focus();
  });

  window.addEventListener("keydown", (event) => {
    if (isTypingTarget(event.target)) {
      return;
    }

    if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "KeyA", "KeyD", "KeyS", "KeyW", "Space"].includes(event.code)) {
      event.preventDefault();
    }

    handleMovementKey(event.code, true, { repeat: event.repeat });
  });

  window.addEventListener("keyup", (event) => {
    if (isTypingTarget(event.target)) {
      return;
    }

    handleMovementKey(event.code, false);
  });

  window.addEventListener("resize", syncResponsiveUi);
  window.addEventListener("orientationchange", syncResponsiveUi);
  if (isPlaytestActive()) {
    window.addEventListener("message", handlePlaytestMessage);
  }
  document.addEventListener("visibilitychange", refreshRankingsInBackground);

  elements.startForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (state.phase === "loading" || state.phase === "submitting") {
      return;
    }

    const nickname = getActiveNickname() || state.nickname;
    elements.nicknameInput.value = nickname;
    queueRoundStart(nickname);
  });

  elements.restartButton.addEventListener("click", () => {
    if (state.phase === "submitting") {
      return;
    }

    const nickname = getActiveNickname() || state.nickname;
    elements.nicknameInput.value = nickname;
    queueRoundStart(nickname);
  });

  elements.lobbyButton.addEventListener("click", () => {
    returnToLobby();
  });

  elements.refreshRankingButton.addEventListener("click", () => {
    if (isPlaytestActive()) {
      setRankingStatus("Playtest mode: rankings are disabled.");
      return;
    }

    fetchRankings();
  });

  elements.viewAllRankingsButton.addEventListener("click", () => {
    if (isPlaytestActive()) {
      openAllRankingsModal();
      void showAllRankingsForSeason(CURRENT_SEASON);
      return;
    }

    openAllRankingsModal();
    void showAllRankingsForSeason(CURRENT_SEASON);
  });

  elements.rankingViewAllBottomButton?.addEventListener("click", () => {
    if (isPlaytestActive()) {
      openAllRankingsModal();
      void showAllRankingsForSeason(CURRENT_SEASON);
      return;
    }

    openAllRankingsModal();
    void showAllRankingsForSeason(CURRENT_SEASON);
  });

  elements.closeAllRankingsButton.addEventListener("click", () => {
    closeAllRankingsModal();
  });

  elements.allRankingsModal.addEventListener("click", (event) => {
    if (event.target === elements.allRankingsModal) {
      closeAllRankingsModal();
    }
  });

  elements.seasonTab2.addEventListener("click", async () => {
    if (elements.seasonTab2.classList.contains("season-tab--active")) {
      return;
    }

    await showAllRankingsForSeason(2);
  });

  elements.seasonTab1.addEventListener("click", async () => {
    if (elements.seasonTab1.classList.contains("season-tab--active")) {
      return;
    }

    await showAllRankingsForSeason(1);
  });

  elements.toggleAllRankingsButton.addEventListener("click", () => {
    allRankingsModalState.expanded = !allRankingsModalState.expanded;
    renderActiveAllRankings();
  });

  elements.musicToggleButton.addEventListener("click", () => {
    toggleMusic();
  });

  elements.settingsMusicToggleButton.addEventListener("click", () => {
    toggleMusic();
  });

  elements.openGuideButton.addEventListener("click", () => {
    openGuideModal();
  });

  elements.heroGuideButton?.addEventListener("click", () => {
    openGuideModal();
  });

  elements.closeGuideModalButton?.addEventListener("click", () => {
    closeGuideModal();
  });

  elements.guideModal?.addEventListener("click", (event) => {
    if (event.target === elements.guideModal) {
      closeGuideModal();
    }
  });

  elements.openRankingButton.addEventListener("click", () => {
    setLobbyMobilePanel("ranking");
    syncMobileNavigationState();
  });

  elements.mobileHomeButton.addEventListener("click", () => {
    closeLobbyOverlays();
    setLobbyMobilePanel("none");
    syncMobileNavigationState();
  });

  elements.mobileShopButton?.addEventListener("click", () => {
    closeLobbyOverlays();
    setLobbyMobilePanel("shop");
    syncLobbyChatComposerState();
    syncMobileNavigationState();
  });

  elements.mobileRankingButton.addEventListener("click", () => {
    closeLobbyOverlays();
    setLobbyMobilePanel("ranking");
    syncMobileNavigationState();
  });

  elements.mobileAccountButton.addEventListener("click", () => {
    closeLobbyOverlays();
    void openProfileInfo();
  });

  elements.mobileSettingsButton.addEventListener("click", () => {
    closeLobbyOverlays();
    setLobbyMobilePanel("none");
    openSettingsDialog();
  });

  elements.shopBackButton?.addEventListener("click", () => {
    setLobbyMobilePanel("none");
    syncMobileNavigationState();
  });

  elements.rankingBackButton.addEventListener("click", () => {
    setLobbyMobilePanel("none");
    syncMobileNavigationState();
  });

  // 상점 구매/장착 버튼
  [elements.equipSkin0Button, elements.buySkinBButton, elements.buySkinCButton].forEach((btn) => {
    btn?.addEventListener("click", () => void handleShopButtonClick(btn));
  });

  bindHoldButton(elements.moveLeftButton, "ArrowLeft");
  bindHoldButton(elements.moveRightButton, "ArrowRight");
  bindTapButton(elements.duckButton, () => {
    triggerSlide();
  });

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
  primeIntroBackgroundAssets();
  syncIntroBackground();
  state.playerId = getOrCreatePlayerId();
  clearSavedNickname();
  applyNickname(getGuestNickname());
  if (!isPlaytestActive()) {
    startPresenceTracking({
      playerId: state.playerId,
      getNickname: () => state.nickname,
      getPhase: () => state.phase
    });
  }
  updateAuthUi();
  syncMobileNavigationState();
  setAuthMode("login");
  startLobbyChatSubscription();
  syncLobbyChatComposerState();
  void initAuth(handleAuthStateChanged).catch((error) => {
    state.authReady = true;
    updateAuthUi();
    console.warn("Failed to initialize auth state.", error);
  });
  initAudio();
  bindEvents();
  installPlaytestBridge();
  if (isPlaytestActive()) {
    showLobbyScreen();
    updateLobbyPlayerInfo();
    setRankingStatus("Playtest mode: rankings are disabled.");
    renderRankingList([]);
  } else {
    showIntroScreen();
  }
  hideGameResult();
  syncResponsiveUi();
  setStartButtonState({
    label: t("boot.loading.button"),
    disabled: true
  });

  window.addEventListener("langchange", () => {
    syncIntroBackground();
    if (!state.authUser) {
      applyNickname(getGuestNickname());
    }
    renderRankingList(state.rankings);
    renderLobbyChatFromState();
    updateAuthUi();
    if (lobbyChatState.statusText) {
      setLobbyChatStatus(lobbyChatState.statusText, lobbyChatState.statusTone);
    }
    syncLobbyChatComposerState();
    syncResponsiveUi();
    setAuthMode(authModalState.mode);
    if (!elements.profileModal.hidden) {
      renderProfileFromState();
    }
    if (!elements.messagesModal.hidden) {
      renderMessages(profileModalState.messages || []);
      updateMessagesButtonLabel();
    }
    if (!elements.allRankingsModal.hidden) {
      renderActiveAllRankings();
    }

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
    if (!isPlaytestActive()) {
      try {
        await fetchRankings();
      } catch {
        state.rankings = [];
        renderRankingList(state.rankings);
        setRankingStatus(t("ranking.failed"));
      }
      startRankingPolling();
    } else {
      state.rankings = [];
      renderRankingList(state.rankings);
      setRankingStatus("Playtest mode: rankings are disabled.");
    }
    state.phase = "ready";
    setStartButtonState({
      label: t("boot.ready.button"),
      disabled: false
    });
  } catch {
    state.phase = "error";
    setStartButtonState({
      label: t("boot.error.button"),
      disabled: true
    });
    setRankingStatus(t("boot.error.status"));
  }

  startPlaytestStatusLoop();
  requestAnimationFrame(animate);
}
