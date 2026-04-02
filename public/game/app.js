import { loadAssets } from "./assets.js";
import { initAudio, playGameMusic, playLobbyMusic, toggleMusic } from "./audio.js";
import { syncAccountIdentity, updateAccountNickname } from "./account-service.js";
import { initAuth, sendPasswordResetLink, signInWithEmail, signOutCurrentUser, signUpWithEmail, updateCurrentUserNickname } from "./auth.js";
import { exitLandscapePresentation, isPortraitTouchViewport, isTouchDevice, requestLandscapePresentation } from "./device.js";
import { elements } from "./dom.js";
import { getCurrentRankingSeason, getRankingSeasonConfig } from "./config/runtime.js";
import { getLang, initI18n, t } from "./i18n.js";
import { fetchRankings, handleMovementKey, startRound, updateGame } from "./logic.js";
import { buildGuestNickname, clearSavedNickname, getOrCreatePlayerId } from "./player-identity.js";
import { startPresenceTracking } from "./presence.js";
import { fetchSeasonProfile } from "./profile-service.js";
import { fetchAllRankingsFromProvider, checkNicknameAvailabilityFromProvider } from "./ranking-service.js";
import { renderFrame } from "./render.js";
import { normalizeName, state } from "./state.js";
import {
  closeAllRankingsModal,
  closeAuthModal,
  closeProfileModal,
  hideGameResult,
  openAuthModal,
  openAllRankingsModal,
  openProfileModal,
  renderAllRankingsList,
  renderGuideImages,
  renderProfileSeasonRecord,
  renderProfileSeasonTopRankings,
  renderProfileSummary,
  renderRankingList,
  renderSeason1Archive,
  setActiveSeasonTab,
  setAllRankingsStatus,
  setAllRankingsToggle,
  setAuthModalMode,
  setAuthStatus,
  setAuthSubmitState,
  setLobbyMobilePanel,
  setOrientationGateVisible,
  setProfileStatus,
  setRankingStatus,
  setStartButtonState,
  setTouchControlsVisible,
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
const allRankingsModalState = {
  season: CURRENT_SEASON,
  rankings: [],
  expanded: false
};
const authModalState = {
  mode: "login",
  busy: false
};
const profileModalState = {
  currentSeasonProfile: null,
  season1Profile: null,
  editingNickname: false,
  nicknameBusy: false
};

function renderActiveAllRankings() {
  const { season, rankings, expanded } = allRankingsModalState;
  const visibleRankings = expanded ? rankings : rankings.slice(0, ALL_RANKINGS_PREVIEW_COUNT);

  if (season === 1) {
    renderSeason1Archive(visibleRankings, getRankingSeasonConfig(1).period || t("ranking.season1ArchivePeriod"));
  } else {
    renderAllRankingsList(visibleRankings);
  }

  setAllRankingsToggle({
    visible: rankings.length > ALL_RANKINGS_PREVIEW_COUNT,
    expanded
  });
}

async function showAllRankingsForSeason(season) {
  setActiveSeasonTab(season);
  elements.allRankingsList.innerHTML = "";
  elements.allRankingsStatus.textContent = t("ranking.loading");
  elements.allRankingsStatus.hidden = false;
  setAllRankingsToggle({ visible: false, expanded: false });

  try {
    const { rankings } = await fetchAllRankingsFromProvider({ season });
    allRankingsModalState.season = season;
    allRankingsModalState.rankings = rankings;
    allRankingsModalState.expanded = false;
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

function getGuestNickname() {
  return buildGuestNickname(state.playerId, getLang());
}

function getMemberDisplayName(user = state.authUser) {
  return normalizeName(user?.displayName || "");
}

function getProfileDisplayName(user = state.authUser) {
  return getMemberDisplayName(user) || String(user?.email || "").trim() || t("auth.guestTitle");
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
      return `すでに使われているニックネームです。${suggestion} を使ってください。`;
    case "en":
      return `That nickname is already taken. Try ${suggestion}.`;
    default:
      return `이미 사용 중인 닉네임이에요. ${suggestion} 을 써주세요.`;
  }
}

function getAutoNicknameMessage(nickname) {
  switch (getLang()) {
    case "ja":
      return `空欄だったので ${nickname} を設定しました。`;
    case "en":
      return `Nickname was empty, so ${nickname} was assigned.`;
    default:
      return `닉네임이 비어 있어서 ${nickname} 으로 정했어요.`;
  }
}

function getNicknameCheckFailedMessage() {
  switch (getLang()) {
    case "ja":
      return "ニックネーム確認に失敗しました。もう一度試してください。";
    case "en":
      return "Could not verify the nickname. Please try again.";
    default:
      return "닉네임 확인에 실패했어요. 한 번만 다시 시도해주세요.";
  }
}

function getRequestedAuthNickname() {
  return normalizeName(elements.authNicknameInput.value);
}

function getAuthNicknameRequiredMessage() {
  switch (getLang()) {
    case "ja":
      return "ニックネームを入力してください。";
    case "en":
      return "Please enter a nickname.";
    default:
      return "닉네임을 입력해주세요.";
  }
}

function getAuthNicknameTakenMessage() {
  switch (getLang()) {
    case "ja":
      return "そのニックネームはすでに使われています。別の名前を選んでください。";
    case "en":
      return "That nickname is already taken. Please choose another one.";
    default:
      return "이미 사용 중인 닉네임이에요. 다른 이름으로 정해주세요.";
  }
}

function getAuthNicknameCheckFailedMessage() {
  switch (getLang()) {
    case "ja":
      return "ニックネームの確認に失敗しました。もう一度お試しください。";
    case "en":
      return "Could not verify the nickname. Please try again.";
    default:
      return "닉네임 확인에 실패했어요. 다시 시도해주세요.";
  }
}

function getProfileNicknameSavedMessage() {
  switch (getLang()) {
    case "ja":
      return "プロフィールのニックネームを更新しました。ランキング表示は次にスコアを保存したときから反映されます。";
    case "en":
      return "Your profile nickname was updated. Ranking names will update the next time you save a score.";
    default:
      return "프로필 닉네임을 바꿨어요. 랭킹 이름은 다음 점수 저장부터 반영돼요.";
  }
}

function getProfileNicknameUnchangedMessage() {
  switch (getLang()) {
    case "ja":
      return "同じニックネームです。";
    case "en":
      return "That nickname is already your current one.";
    default:
      return "지금 쓰는 닉네임과 같아요.";
  }
}

function getSignedInIntroMessage(email) {
  switch (getLang()) {
    case "ja":
      return `${email} でログイン中です。`;
    case "en":
      return `Signed in as ${email}.`;
    default:
      return `${email} 계정으로 로그인되어 있어요.`;
  }
}

function getSignedInSummary(email) {
  switch (getLang()) {
    case "ja":
      return `${email} アカウントとこのブラウザのプレイ情報をつなぐ準備ができています。`;
    case "en":
      return `Your ${email} account is ready to stay linked with this browser's play records.`;
    default:
      return `${email} 계정과 이 브라우저의 플레이 기록을 연결할 준비가 끝났어요.`;
  }
}

function getPasswordMismatchMessage() {
  switch (getLang()) {
    case "ja":
      return "パスワード確認が一致しません。";
    case "en":
      return "Password confirmation does not match.";
    default:
      return "비밀번호 확인이 일치하지 않아요.";
  }
}

function getPasswordTooShortMessage(minLength = AUTH_MIN_PASSWORD_LENGTH) {
  switch (getLang()) {
    case "ja":
      return `パスワードは ${minLength} 文字以上で入力してください。`;
    case "en":
      return `Password must be at least ${minLength} characters long.`;
    default:
      return `비밀번호는 ${minLength}자 이상으로 입력해주세요.`;
  }
}

function getResetPasswordPromptMessage() {
  switch (getLang()) {
    case "ja":
      return "登録したメールアドレスを入力してください。";
    case "en":
      return "Enter the email address you signed up with.";
    default:
      return "가입한 이메일을 입력해주세요.";
  }
}

function getResetPasswordSentMessage(email) {
  switch (getLang()) {
    case "ja":
      return `${email} にパスワード再設定リンクを送信しました。`;
    case "en":
      return `Password reset link sent to ${email}.`;
    default:
      return `${email} 주소로 비밀번호 재설정 링크를 보냈어요.`;
  }
}

function getSignOutFailedMessage() {
  switch (getLang()) {
    case "ja":
      return "ログアウトに失敗しました。もう一度お試しください。";
    case "en":
      return "Could not sign out. Please try again.";
    default:
      return "로그아웃에 실패했어요. 다시 시도해주세요.";
  }
}

function getProfileLoadingMessage() {
  switch (getLang()) {
    case "ja":
      return "シーズン1記録を確認しています。";
    case "en":
      return "Checking your Season 1 record.";
    default:
      return "시즌1 기록을 확인하고 있어요.";
  }
}

function getProfileFailedMessage() {
  switch (getLang()) {
    case "ja":
      return "シーズン1記録を読み込めませんでした。もう一度お試しください。";
    case "en":
      return "Could not load your Season 1 record. Please try again.";
    default:
      return "시즌1 기록을 불러오지 못했어요. 다시 시도해주세요.";
  }
}

function getProfilePartialFailedMessage() {
  switch (getLang()) {
    case "ja":
      return "一部のシーズン記録を読み込めませんでした。";
    case "en":
      return "Some season records could not be loaded.";
    default:
      return "일부 시즌 기록을 불러오지 못했어요.";
  }
}

function getProfileSummaryText(linkedCount) {
  switch (getLang()) {
    case "ja":
      return `このアカウントに連携されたブラウザ記録 ${linkedCount}개を基準にシーズン1記録を探しています。`;
    case "en":
      return `Looking up Season 1 records using ${linkedCount} browser-linked identity ${linkedCount === 1 ? "key" : "keys"} on this account.`;
    default:
      return `이 계정에 연결된 브라우저 기록 ${linkedCount}개를 기준으로 시즌1 기록을 찾고 있어요.`;
  }
}

function getCurrentSeasonSummaryText(linkedCount) {
  switch (getLang()) {
    case "ja":
      return `このアカウントに連携されたブラウザ記録 ${linkedCount}개を基準に現在シーズン記録を確認しています。`;
    case "en":
      return `Checking this account's current season record using ${linkedCount} linked browser identity ${linkedCount === 1 ? "key" : "keys"}.`;
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
          return "すでに使われているメールアドレスです。";
        case "en":
          return "That email address is already in use.";
        default:
          return "이미 사용 중인 이메일이에요.";
      }
    case "auth/invalid-email":
      switch (getLang()) {
        case "ja":
          return "メールアドレスの形式を確認してください。";
        case "en":
          return "Please check the email address format.";
        default:
          return "이메일 형식을 확인해주세요.";
      }
    case "auth/user-not-found":
    case "auth/invalid-credential":
    case "auth/wrong-password":
      switch (getLang()) {
        case "ja":
          return "メールアドレスまたはパスワードが正しくありません。";
        case "en":
          return "Incorrect email address or password.";
        default:
          return "이메일이나 비밀번호가 올바르지 않아요.";
      }
    case "auth/weak-password":
      return getPasswordTooShortMessage();
    case "auth/too-many-requests":
      switch (getLang()) {
        case "ja":
          return "しばらくしてからもう一度お試しください。";
        case "en":
          return "Too many attempts. Please wait a bit and try again.";
        default:
          return "시도가 너무 많아요. 잠시 후 다시 시도해주세요.";
      }
    case "auth/network-request-failed":
      switch (getLang()) {
        case "ja":
          return "ネットワーク接続を確認してからもう一度お試しください。";
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
          return "Firebase コンソールでメール/パスワード認証を有効にしてください。";
        case "en":
          return "Enable Email/Password sign-in in Firebase Auth first.";
        default:
          return "Firebase Auth에서 이메일/비밀번호 로그인을 먼저 활성화해주세요.";
      }
    default:
      switch (getLang()) {
        case "ja":
          return "인증 처리 중 오류가 발생했습니다. 다시 시도해주세요.";
        case "en":
          return "Something went wrong during authentication. Please try again.";
        default:
          return "인증 처리 중 오류가 발생했어요. 다시 시도해주세요.";
      }
  }
}

function clearAuthValidation() {
  elements.authConfirmInput.setCustomValidity("");
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
  elements.authNicknameInput.value = "";
  elements.authPasswordInput.value = "";
  elements.authConfirmInput.value = "";
  clearAuthValidation();
}

function setAuthMode(mode = "login") {
  authModalState.mode = mode === "signup" ? "signup" : "login";
  clearAuthValidation();
  setAuthModalMode(authModalState.mode);
  setAuthSubmitState({ busy: authModalState.busy, mode: authModalState.mode });
  setAuthStatus("");
}

function openAuthDialog(mode = "login") {
  setAuthMode(mode);
  resetAuthForm({ preserveEmail: true });
  openAuthModal();
  requestAnimationFrame(() => {
    elements.authEmailInput.focus();
  });
}

function closeAuthDialog() {
  authModalState.busy = false;
  setAuthSubmitState({ busy: false, mode: authModalState.mode });
  closeAuthModal();
  resetAuthForm({ preserveEmail: false });
}

async function syncAuthenticatedAccount() {
  if (!state.authUser) {
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

  elements.accountCard.hidden = !isLoggedIn;
  elements.lobbyLoginButton.hidden = isLoggedIn;
  elements.authModeBadge.classList.toggle("account-badge--guest", !isLoggedIn);
  elements.authModeBadge.classList.toggle("account-badge--member", isLoggedIn);
  elements.authModeBadge.textContent = isLoggedIn ? t("auth.memberBadge") : t("auth.guestBadge");
  elements.authDisplayName.textContent = isLoggedIn ? displayName : (state.nickname || t("auth.guestTitle"));
  elements.authSummaryText.textContent = isLoggedIn
    ? getSignedInSummary(email || displayName)
    : "";
  elements.authSummaryText.hidden = !isLoggedIn;
  elements.authGuestActions.hidden = isLoggedIn;
  elements.profileInfoButton.hidden = !isLoggedIn;
  elements.authLogoutButton.hidden = !isLoggedIn;
  elements.introAuthActions.hidden = isLoggedIn;
  elements.introAuthHint.hidden = isLoggedIn;
  elements.introAuthState.hidden = !isLoggedIn;
  elements.introAuthState.textContent = isLoggedIn ? getSignedInIntroMessage(email || displayName) : "";
  elements.introStartButton.textContent = isLoggedIn ? t("intro.enterLobby") : t("intro.guestStart");
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

  renderProfileSummary({
    name: accountName,
    summary: currentSeasonProfile
      ? getCurrentSeasonSummaryText(currentSeasonProfile.linkedPlayerIds.length || linkedCount)
      : getProfileSummaryText(linkedCount),
    period
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
}

async function saveProfileNickname() {
  if (!state.authUser?.uid || profileModalState.nicknameBusy) {
    return;
  }

  const requestedNickname = getRequestedAuthNickname();
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
  profileModalState.editingNickname = false;
  profileModalState.nicknameBusy = false;
  renderProfileSummary({
    name: getProfileDisplayName(state.authUser) || "-",
    summary: getProfileLoadingMessage(),
    period: getRankingSeasonConfig(PROFILE_SEASON).period || t("ranking.season1ArchivePeriod")
  });
  elements.profileCurrentSeasonRecord.innerHTML = "";
  elements.profileSeason1Record.innerHTML = "";
  elements.profileSeason1TopList.innerHTML = "";
  setProfileStatus(getProfileLoadingMessage());
  openProfileModal();

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
}

function handleAuthStateChanged(user) {
  state.authReady = true;
  state.authUser = user;
  profileModalState.nicknameBusy = false;

  if (state.authUser) {
    profileModalState.editingNickname = false;
    applyNickname(getMemberDisplayName(state.authUser) || state.nickname || getGuestNickname());
    updateAuthUi();
    void syncAuthenticatedAccount();
    closeAuthDialog();
  } else {
    clearSavedNickname();
    applyNickname(getGuestNickname());
    profileModalState.editingNickname = false;
    updateAuthUi();
    profileModalState.currentSeasonProfile = null;
    profileModalState.season1Profile = null;
    closeProfileModal();
  }
}

function applyNickname(nickname) {
  const resolvedNickname = normalizeName(nickname) || getGuestNickname();
  state.nickname = resolvedNickname;
  elements.nicknameInput.value = resolvedNickname;

  if (state.authUser) {
    void syncAuthenticatedAccount();
  }
}

function launchGame() {
  hideGameResult();
  setLobbyMobilePanel("none");
  showGameScreen();
  playGameMusic();
  syncResponsiveUi();
  requestLandscapePresentation(elements.gameScreen);
}

function updateLobbyPlayerInfo() {
  elements.lobbyNicknameDisplay.textContent = state.nickname || "-";
  elements.lobbyRankDisplay.textContent = state.lastRank ? `#${state.lastRank}` : "-";
}

function returnToLobby() {
  state.phase = "ready";
  setLobbyMobilePanel("none");
  showLobbyScreen();
  updateLobbyPlayerInfo();
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
  elements.authEmailInput.addEventListener("input", clearAuthStatusIfIdle);
  elements.authNicknameInput.addEventListener("input", clearAuthStatusIfIdle);
  elements.authPasswordInput.addEventListener("input", clearAuthStatusIfIdle);
  elements.profileNicknameInput.addEventListener("input", () => {
    if (!profileModalState.nicknameBusy) {
      setProfileStatus("");
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
    } finally {
      elements.introStartButton.disabled = false;
    }
  });

  elements.introLoginButton.addEventListener("click", () => {
    openAuthDialog("login");
  });

  elements.introSignupButton.addEventListener("click", () => {
    openAuthDialog("signup");
  });

  elements.lobbyLoginButton.addEventListener("click", () => {
    openAuthDialog("login");
  });

  elements.lobbySignupButton.addEventListener("click", () => {
    openAuthDialog("signup");
  });

  elements.profileInfoButton.addEventListener("click", () => {
    void openProfileInfo();
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
  });

  elements.profileModal.addEventListener("click", (event) => {
    if (event.target === elements.profileModal) {
      closeProfileModal();
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

    if (authModalState.mode === "signup") {
      if (!requestedNickname) {
        setAuthStatus(getAuthNicknameRequiredMessage(), "error");
        elements.authNicknameInput.focus();
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
          setAuthStatus(getAuthNicknameTakenMessage(), "error");
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

    const email = elements.authEmailInput.value.trim();
    if (!email) {
      setAuthStatus(getResetPasswordPromptMessage(), "error");
      elements.authEmailInput.focus();
      return;
    }

    try {
      await sendPasswordResetLink(email);
      setAuthStatus(getResetPasswordSentMessage(email), "success");
    } catch (error) {
      setAuthStatus(getAuthErrorMessage(error), "error");
    }
  });

  elements.authLogoutButton.addEventListener("click", async () => {
    elements.authLogoutButton.disabled = true;

    try {
      await signOutCurrentUser();
    } catch (error) {
      console.warn("Failed to sign out.", error);
      elements.authSummaryText.textContent = getSignOutFailedMessage();
    } finally {
      elements.authLogoutButton.disabled = false;
    }
  });

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

    const nickname = getActiveNickname() || state.nickname;
    elements.nicknameInput.value = nickname;
    startRound(nickname);
    launchGame();
  });

  elements.restartButton.addEventListener("click", () => {
    if (state.phase === "submitting") {
      return;
    }

    const nickname = getActiveNickname() || state.nickname;
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

  elements.viewAllRankingsButton.addEventListener("click", () => {
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
  state.playerId = getOrCreatePlayerId();
  clearSavedNickname();
  applyNickname(getGuestNickname());
  startPresenceTracking({
    playerId: state.playerId,
    getNickname: () => state.nickname,
    getPhase: () => state.phase
  });
  updateAuthUi();
  setAuthMode("login");
  void initAuth(handleAuthStateChanged).catch((error) => {
    state.authReady = true;
    updateAuthUi();
    console.warn("Failed to initialize auth state.", error);
  });
  initAudio();
  bindEvents();
  showIntroScreen();
  hideGameResult();
  syncResponsiveUi();
  setStartButtonState({
    label: t("boot.loading.button"),
    disabled: true
  });

  window.addEventListener("langchange", () => {
    if (!state.authUser) {
      applyNickname(getGuestNickname());
    }
    renderRankingList(state.rankings);
    updateAuthUi();
    setAuthMode(authModalState.mode);
    if (!elements.profileModal.hidden) {
      renderProfileFromState();
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
    try {
      await fetchRankings();
    } catch {
      state.rankings = [];
      renderRankingList(state.rankings);
      setRankingStatus(t("ranking.failed"));
    }
    startRankingPolling();
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

  requestAnimationFrame(animate);
}
