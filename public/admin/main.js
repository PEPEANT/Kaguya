import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { collection, doc, getDoc, getDocs, getFirestore, orderBy, query, where } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { getCurrentAuthIdToken, initAuth } from "../game/auth.js";
import {
  getAdminAccessConfig,
  getAvailableRankingSeasons,
  getCurrentRankingSeason,
  getFirebaseRuntimeConfig,
  getRankingSeasonCollection,
  getRankingSeasonConfig
} from "../game/config/runtime.js";

const PRESENCE_COLLECTION = "presence";
const SESSION_COLLECTION = "presenceSessions";
const ACTIVE_WINDOW_MS = 35_000;
const REFRESH_INTERVAL_MS = 10_000;
const ANALYTICS_WINDOW_DAYS = 30;
const CURRENT_SEASON = getCurrentRankingSeason();
const CURRENT_RANKING_COLLECTION = getRankingSeasonCollection(CURRENT_SEASON);
const CURRENT_SEASON_META = getRankingSeasonConfig(CURRENT_SEASON);
const RANKING_SEASONS = getAvailableRankingSeasons().sort((left, right) => right.id - left.id);
const DEFAULT_APP_SERVER_ORIGIN = "http://localhost:3000";

const PERIOD_DEFINITIONS = [
  { key: "daily", label: "오늘", days: 1, dayOffset: 0 },
  { key: "weekly", label: "최근 7일", days: 7, dayOffset: 6 },
  { key: "monthly", label: "최근 30일", days: 30, dayOffset: 29 }
];

const PHASE_LABELS = {
  ready: "대기",
  loading: "로딩",
  playing: "플레이 중",
  submitting: "제출 중",
  error: "오류"
};

const elements = {
  refreshButton: document.getElementById("refreshButton"),
  activeCount: document.getElementById("activeCount"),
  rankingCount: document.getElementById("rankingCount"),
  lastUpdated: document.getElementById("lastUpdated"),
  presenceStatus: document.getElementById("presenceStatus"),
  rankingStatus: document.getElementById("rankingStatus"),
  trendChartStatus: document.getElementById("trendChartStatus"),
  dailyUnique: document.getElementById("dailyUnique"),
  dailyVisitsMeta: document.getElementById("dailyVisitsMeta"),
  weeklyUnique: document.getElementById("weeklyUnique"),
  weeklyVisitsMeta: document.getElementById("weeklyVisitsMeta"),
  monthlyUnique: document.getElementById("monthlyUnique"),
  monthlyVisitsMeta: document.getElementById("monthlyVisitsMeta"),
  presenceTableBody: document.getElementById("presenceTableBody"),
  rankingTableBody: document.getElementById("rankingTableBody"),
  trendChart: document.getElementById("trendChart"),
  chartTooltip: document.getElementById("chartTooltip"),
  seasonPayoutSeason: document.getElementById("seasonPayoutSeason"),
  seasonPayoutLimit: document.getElementById("seasonPayoutLimit"),
  seasonPayoutPlayerId: document.getElementById("seasonPayoutPlayerId"),
  seasonPayoutTargetUid: document.getElementById("seasonPayoutTargetUid"),
  seasonPayoutPreviewButton: document.getElementById("seasonPayoutPreviewButton"),
  seasonPayoutApplyButton: document.getElementById("seasonPayoutApplyButton"),
  seasonPayoutStatus: document.getElementById("seasonPayoutStatus"),
  seasonPayoutResult: document.getElementById("seasonPayoutResult"),
  playerSelectionClearButton: document.getElementById("playerSelectionClearButton"),
  selectedPlayerSummary: document.getElementById("selectedPlayerSummary"),
  walletAdjustDelta: document.getElementById("walletAdjustDelta"),
  walletAdjustReason: document.getElementById("walletAdjustReason"),
  walletAdjustTitle: document.getElementById("walletAdjustTitle"),
  walletAdjustBody: document.getElementById("walletAdjustBody"),
  walletAdjustPreviewMeta: document.getElementById("walletAdjustPreviewMeta"),
  walletAdjustPreviewTitle: document.getElementById("walletAdjustPreviewTitle"),
  walletAdjustPreviewBody: document.getElementById("walletAdjustPreviewBody"),
  walletAdjustApplyButton: document.getElementById("walletAdjustApplyButton"),
  sendMessageId: document.getElementById("sendMessageId"),
  sendMessageTitle: document.getElementById("sendMessageTitle"),
  sendMessageBody: document.getElementById("sendMessageBody"),
  sendMessagePreviewMeta: document.getElementById("sendMessagePreviewMeta"),
  sendMessagePreviewTitle: document.getElementById("sendMessagePreviewTitle"),
  sendMessagePreviewBody: document.getElementById("sendMessagePreviewBody"),
  sendMessageApplyButton: document.getElementById("sendMessageApplyButton"),
  deleteMessageId: document.getElementById("deleteMessageId"),
  deleteMessageApplyButton: document.getElementById("deleteMessageApplyButton"),
  playerActionStatus: document.getElementById("playerActionStatus")
};

const adminAccessConfig = getAdminAccessConfig();
const adminState = {
  rankings: [],
  activePresence: [],
  recentSessions: [],
  trendDailyStats: [],
  selectedManualTarget: null,
  seasonRankingsCache: new Map(),
  playerModal: null
};

let barHitAreas = [];

function readTrimmedValue(element) {
  return String(element?.value || "").trim();
}

function readWholeNumber(element, fallback = 0) {
  const value = Math.floor(Number(element?.value));
  return Number.isFinite(value) ? value : fallback;
}

function isLoopbackHostname(hostname = "") {
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(String(hostname || "").trim().toLowerCase());
}

function hasInjectedAppConfig() {
  return typeof window.__APP_CONFIG__ === "object" && window.__APP_CONFIG__ !== null;
}

function getAdminApiUrl() {
  if (hasInjectedAppConfig()) {
    return new URL("/api/admin/action", window.location.origin).toString();
  }

  if (isLoopbackHostname(window.location.hostname)) {
    return new URL("/api/admin/action", DEFAULT_APP_SERVER_ORIGIN).toString();
  }

  return new URL("/api/admin/action", window.location.origin).toString();
}

function setInlineStatus(element, text, tone = "info") {
  if (!element) {
    return;
  }

  element.textContent = formatText(text, "");
  element.dataset.tone = tone;
}

function setResultBox(element, value) {
  if (!element) {
    return;
  }

  element.textContent = typeof value === "string"
    ? value
    : JSON.stringify(value, null, 2);
}

function populateSeasonSelect() {
  if (!elements.seasonPayoutSeason) {
    return;
  }

  elements.seasonPayoutSeason.innerHTML = RANKING_SEASONS.map((seasonConfig) => `
    <option value="${seasonConfig.id}">
      ${escapeHtml(seasonConfig.displayName)}${seasonConfig.period ? ` (${escapeHtml(seasonConfig.period)})` : ""}
    </option>
  `).join("");
  elements.seasonPayoutSeason.value = String(CURRENT_SEASON);
}

function prefillAdminTargets({ uid = "", playerId = "" } = {}) {
  if (uid) {
    [elements.seasonPayoutTargetUid]
      .forEach((element) => {
        if (element) {
          element.value = uid;
        }
      });
  }

  if (playerId && elements.seasonPayoutPlayerId) {
    elements.seasonPayoutPlayerId.value = playerId;
  }
}

function getManualTargetValue(target = {}) {
  return formatText(target.uid, "") || formatText(target.primaryPlayerId, "") || formatText(target.playerId, "");
}

function getRequiredManualTargetValue() {
  const targetValue = getManualTargetValue(adminState.selectedManualTarget || {});
  if (!targetValue) {
    throw new Error("먼저 랭킹 표에서 플레이어를 선택해주세요.");
  }

  return targetValue;
}

function renderSelectedManualTarget() {
  if (!elements.selectedPlayerSummary) {
    return;
  }

  const target = adminState.selectedManualTarget;
  if (!target) {
    elements.selectedPlayerSummary.className = "player-selection-summary player-selection-summary--empty";
    elements.selectedPlayerSummary.innerHTML = "선택된 플레이어 없음";
    return;
  }

  const playerIdSummary = [target.primaryPlayerId, ...(Array.isArray(target.playerIds) ? target.playerIds : [])]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index);
  const sourceSummary = [target.isOnline ? "현재 접속 추정" : "", formatText(target.sourceLabel, "")]
    .filter(Boolean)
    .join(" / ");
  const activitySummary = formatText(
    target.lastSeenAt ? formatAgo(target.lastSeenAt) : formatDateTime(target.lastLoginAt),
    "정보 없음"
  );

  elements.selectedPlayerSummary.className = "player-selection-summary";
  elements.selectedPlayerSummary.innerHTML = `
    <span class="player-selection-title">${escapeHtml(formatText(target.nickname, "선택된 플레이어"))}</span>
    <span class="player-selection-meta">${escapeHtml(formatText(getManualTargetValue(target), "-"))}</span>
    <span class="player-selection-meta">${escapeHtml(formatList(playerIdSummary))}</span>
    <span class="player-selection-meta">${escapeHtml(activitySummary)} / ${escapeHtml(formatText(sourceSummary, "랭킹/접속 선택"))}</span>
  `;
}

function setSelectedManualTarget(target = {}, { prefill = true } = {}) {
  const nextTarget = {
    uid: String(target.uid || "").trim(),
    nickname: formatText(target.nickname || target.name, ""),
    primaryPlayerId: String(target.primaryPlayerId || target.playerId || "").trim(),
    playerId: String(target.playerId || target.primaryPlayerId || "").trim(),
    playerIds: Array.isArray(target.playerIds)
      ? target.playerIds.map((value) => String(value || "").trim()).filter(Boolean)
      : [String(target.playerId || target.primaryPlayerId || "").trim()].filter(Boolean),
    lastSeenAt: String(target.lastSeenAt || target.lastSeen || "").trim(),
    lastLoginAt: String(target.lastLoginAt || "").trim(),
    isOnline: Boolean(target.isOnline),
    sourceLabel: String(target.sourceLabel || "").trim()
  };

  adminState.selectedManualTarget = nextTarget;
  renderSelectedManualTarget();
  renderManualMessagePreviews();
}

function clearSelectedManualTarget() {
  adminState.selectedManualTarget = null;
  renderSelectedManualTarget();
  renderManualMessagePreviews();
}

async function runAdminActionRequest(action, payload) {
  const idToken = await getCurrentAuthIdToken();
  let response;

  try {
    response = await fetch(getAdminApiUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({ action, payload })
    });
  } catch {
    throw new Error("관리자 API에 연결하지 못했습니다. 앱 서버(localhost:3000)를 실행했는지 확인해주세요.");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(formatText(data.error, `관리자 요청 실패 (${response.status})`));
  }

  return data.result;
}

function getSelectedPayoutSeason() {
  const selectedSeason = Number.parseInt(readTrimmedValue(elements.seasonPayoutSeason), 10);
  return Number.isInteger(selectedSeason) && selectedSeason >= 1 ? selectedSeason : CURRENT_SEASON;
}

function getSelectedPayoutSeasonLabel() {
  return getRankingSeasonConfig(getSelectedPayoutSeason()).displayName;
}

function hasFirebaseConfig(config) {
  return Boolean(config?.apiKey && config?.projectId && config?.appId);
}

function getDb() {
  const config = getFirebaseRuntimeConfig();
  if (!hasFirebaseConfig(config)) {
    throw new Error("Firebase config missing");
  }

  const app = getApps().length ? getApp() : initializeApp(config);
  return getFirestore(app);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeName(name) {
  return Array.from(String(name || "").trim().replace(/\s+/g, " ")).slice(0, 12).join("");
}

function canBypassAdminAllowlist() {
  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

function isAuthorizedAdmin(user) {
  if (!adminAccessConfig.requiresSignIn) {
    return true;
  }

  if (!user?.email) {
    return false;
  }

  if (!adminAccessConfig.allowedEmails.length) {
    return canBypassAdminAllowlist();
  }

  return adminAccessConfig.allowedEmails.includes(normalizeEmail(user.email));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char] || char));
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toLocaleString("ko-KR") : "-";
}

function formatText(value, fallback = "-") {
  const safeValue = String(value ?? "").trim();
  return safeValue || fallback;
}

function formatList(values, fallback = "-") {
  return Array.isArray(values) && values.length ? values.join(", ") : fallback;
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

function formatAgo(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) {
    return `${seconds}초 전`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}분 전`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}시간 전`;
  }

  return `${Math.floor(hours / 24)}일 전`;
}

function buildWalletAdjustDraft(delta, reason) {
  const safeDelta = Math.floor(Number(delta) || 0);
  const absoluteDelta = Math.abs(safeDelta);
  const actionLabel = safeDelta > 0 ? "지급" : "차감";
  const safeReason = formatText(reason, "");

  return {
    title: "후쥬페이 변동 안내",
    body: [
      `관리자가 ${formatNumber(absoluteDelta)} HujuPay를 ${actionLabel}했습니다.`,
      safeReason ? `사유: ${safeReason}` : ""
    ].filter(Boolean).join("\n")
  };
}

function renderWalletAdjustPreview() {
  if (!elements.walletAdjustPreviewMeta || !elements.walletAdjustPreviewTitle || !elements.walletAdjustPreviewBody) {
    return;
  }

  const selectedTarget = adminState.selectedManualTarget || null;
  const delta = readWholeNumber(elements.walletAdjustDelta, 0);
  const reason = readTrimmedValue(elements.walletAdjustReason);
  const defaultDraft = buildWalletAdjustDraft(delta, reason);
  const title = readTrimmedValue(elements.walletAdjustTitle) || defaultDraft.title;
  const body = readTrimmedValue(elements.walletAdjustBody) || defaultDraft.body;
  const targetLabel = selectedTarget
    ? `${formatText(selectedTarget.nickname, "플레이어")} / ${formatText(getManualTargetValue(selectedTarget), "-")}`
    : "플레이어를 먼저 선택해주세요";

  elements.walletAdjustPreviewMeta.textContent = delta
    ? `대상: ${targetLabel} / ${delta > 0 ? "+" : ""}${formatNumber(delta)} HujuPay / 메시지 ID 자동 생성`
    : `대상: ${targetLabel} / 금액을 입력하면 지급 또는 차감 문구가 완성됩니다.`;
  elements.walletAdjustPreviewTitle.textContent = title || "후쥬페이 변동 안내";
  elements.walletAdjustPreviewBody.textContent = body || "금액과 사유를 입력하면 실제 발송 문구가 여기 표시됩니다.";
}

function renderSendMessagePreview() {
  if (!elements.sendMessagePreviewMeta || !elements.sendMessagePreviewTitle || !elements.sendMessagePreviewBody) {
    return;
  }

  const selectedTarget = adminState.selectedManualTarget || null;
  const title = readTrimmedValue(elements.sendMessageTitle);
  const body = readTrimmedValue(elements.sendMessageBody);
  const messageId = readTrimmedValue(elements.sendMessageId);
  const targetLabel = selectedTarget
    ? `${formatText(selectedTarget.nickname, "플레이어")} / ${formatText(getManualTargetValue(selectedTarget), "-")}`
    : "플레이어를 먼저 선택해주세요";

  elements.sendMessagePreviewMeta.textContent = `대상: ${targetLabel} / 메시지 ID ${messageId || "자동 생성"}`;
  elements.sendMessagePreviewTitle.textContent = title || "제목을 입력해주세요";
  elements.sendMessagePreviewBody.textContent = body || "본문을 입력하면 여기서 실제 발송 메시지를 바로 확인할 수 있습니다.";
}

function renderManualMessagePreviews() {
  renderWalletAdjustPreview();
  renderSendMessagePreview();
}

function compareRankings(left, right) {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  return String(left.submittedAt).localeCompare(String(right.submittedAt));
}

function getGameEntryUrl() {
  const pathname = String(window.location.pathname || "/");
  const entryPath = pathname.startsWith("/public/admin/") ? "/public/index.html" : "/";
  return new URL(entryPath, window.location.origin);
}

function renderAccessGate({ title, body }) {
  document.body.innerHTML = `
    <main class="admin-shell">
      <section class="panel-card admin-access-card">
        <div class="panel-head">
          <h2>${escapeHtml(title)}</h2>
        </div>
        <p class="admin-access-copy">${escapeHtml(body)}</p>
        <div class="admin-access-actions">
          <a class="refresh-button" href="${escapeHtml(getGameEntryUrl().toString())}">게임 열기</a>
          <button class="refresh-button refresh-button--secondary" type="button" id="retryAdminAccess">다시 시도</button>
        </div>
      </section>
    </main>
  `;

  document.getElementById("retryAdminAccess")?.addEventListener("click", () => {
    window.location.reload();
  });
}

async function requireAuthorizedAdmin() {
  if (!adminAccessConfig.requiresSignIn && !adminAccessConfig.allowedEmails.length) {
    return null;
  }

  const { user } = await initAuth();

  if (!user?.uid) {
    renderAccessGate({
      title: "관리자 로그인 필요",
      body: "먼저 메인 게임에서 관리자 계정으로 로그인한 뒤 이 페이지를 다시 열어주세요. localhost와 127.0.0.1을 섞지 말고 같은 주소로 접속하는 것이 안전합니다."
    });
    throw new Error("관리자 로그인이 필요합니다.");
  }

  if (!isAuthorizedAdmin(user)) {
    renderAccessGate({
      title: "접근 권한 없음",
      body: adminAccessConfig.allowedEmails.length
        ? `현재 로그인한 계정(${normalizeEmail(user.email)})은 관리자 허용 목록에 없습니다.`
        : "앱 서버의 ADMIN_ALLOWED_EMAILS 설정 후 다시 로그인해주세요."
    });
    throw new Error("관리자 허용 목록에서 거부되었습니다.");
  }

  return user;
}

function formatPhaseLabel(phase) {
  return PHASE_LABELS[phase] || formatText(phase);
}

function renderMetaRows(rows) {
  return rows.map((row) => `
    <div class="player-detail-meta-row">
      <dt>${escapeHtml(row.label)}</dt>
      <dd>${escapeHtml(row.value)}</dd>
    </div>
  `).join("");
}

function createPlayerDetailModal() {
  const wrapper = document.createElement("div");
  wrapper.className = "player-detail-modal";
  wrapper.setAttribute("hidden", "");
  wrapper.innerHTML = `
    <div class="player-detail-backdrop" data-player-modal-close></div>
    <section class="player-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="playerDetailTitle">
      <div class="player-detail-header">
        <div>
          <p class="player-detail-eyebrow">플레이어 조회</p>
          <h2 id="playerDetailTitle">플레이어 상세</h2>
          <p id="playerDetailSubtitle" class="player-detail-subtitle">플레이어를 선택하면 실시간 상태와 시즌 기록을 확인할 수 있습니다.</p>
        </div>
        <button type="button" class="player-detail-close" data-player-modal-close aria-label="플레이어 상세 닫기">닫기</button>
      </div>
      <div id="playerDetailBody" class="player-detail-body"></div>
    </section>
  `;

  document.body.append(wrapper);

  const modal = {
    wrapper,
    title: wrapper.querySelector("#playerDetailTitle"),
    subtitle: wrapper.querySelector("#playerDetailSubtitle"),
    body: wrapper.querySelector("#playerDetailBody")
  };

  wrapper.querySelectorAll("[data-player-modal-close]").forEach((node) => {
    node.addEventListener("click", () => {
      closePlayerDetailModal();
    });
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !wrapper.hasAttribute("hidden")) {
      closePlayerDetailModal();
    }
  });

  return modal;
}

function ensurePlayerModal() {
  if (!adminState.playerModal) {
    adminState.playerModal = createPlayerDetailModal();
  }

  return adminState.playerModal;
}

function openPlayerDetailModalShell({ title, subtitle, bodyHtml }) {
  const modal = ensurePlayerModal();
  modal.title.textContent = title;
  modal.subtitle.textContent = subtitle;
  modal.body.innerHTML = bodyHtml;
  modal.wrapper.removeAttribute("hidden");
  document.body.classList.add("player-detail-open");
}

function closePlayerDetailModal() {
  const modal = adminState.playerModal;
  if (!modal) {
    return;
  }

  modal.wrapper.setAttribute("hidden", "");
  document.body.classList.remove("player-detail-open");
}

function renderPlayerLoadingState(name) {
  openPlayerDetailModalShell({
    title: formatText(name, "플레이어 상세"),
    subtitle: "실시간 상태와 시즌 기록을 불러오는 중입니다.",
    bodyHtml: `
      <div class="player-detail-empty">
        <strong>플레이어 정보를 불러오는 중입니다...</strong>
        <p>랭킹과 접속 기록을 수집하고 있습니다.</p>
      </div>
    `
  });
}

function renderPlayerErrorState(name, error) {
  openPlayerDetailModalShell({
    title: formatText(name, "플레이어 상세"),
    subtitle: "요청한 플레이어 정보를 불러오지 못했습니다.",
    bodyHtml: `
      <div class="player-detail-empty">
        <strong>플레이어 상세 정보를 표시할 수 없습니다.</strong>
        <p>${escapeHtml(formatText(error?.message, "알 수 없는 오류"))}</p>
      </div>
    `
  });
}

async function loadSeasonRankings(seasonId) {
  const cacheKey = String(seasonId);
  if (!adminState.seasonRankingsCache.has(cacheKey)) {
    adminState.seasonRankingsCache.set(cacheKey, (async () => {
      const seasonCollection = getRankingSeasonCollection(seasonId);
      const seasonQuery = query(collection(getDb(), seasonCollection), orderBy("score", "desc"));
      const snapshot = await getDocs(seasonQuery);
      return snapshot.docs
        .map((entryDoc) => {
          const data = entryDoc.data();
          return {
            playerId: String(data.playerId || ""),
            uid: String(data.uid || "").trim(),
            name: normalizeName(data.nicknameSnapshot || data.name),
            score: Math.floor(Number(data.score)),
            submittedAt: typeof data.submittedAt === "string" ? data.submittedAt : ""
          };
        })
        .filter((entry) => entry.name && Number.isFinite(entry.score))
        .sort(compareRankings);
    })());
  }

  return adminState.seasonRankingsCache.get(cacheKey);
}

function getLatestPresenceEntry(playerId) {
  return adminState.activePresence.find((entry) => entry.playerId === playerId) || null;
}

function getPlayerSessionStats(playerId) {
  const matchedSessions = adminState.recentSessions.filter((entry) => entry.playerId === playerId);
  return {
    totalSessions: matchedSessions.length,
    latestStartedAt: matchedSessions[0]?.startedAt || "",
    latestEndedAt: matchedSessions.find((entry) => entry.endedAt)?.endedAt || ""
  };
}

async function buildPlayerLookupDetail(entry) {
  const safePlayerId = String(entry?.playerId || "").trim();
  const safeUid = String(entry?.uid || "").trim();
  const latestPresence = safePlayerId ? getLatestPresenceEntry(safePlayerId) : null;
  const sessionStats = safePlayerId
    ? getPlayerSessionStats(safePlayerId)
    : { totalSessions: 0, latestStartedAt: "", latestEndedAt: "" };

  const knownNicknames = new Set(
    [entry?.name, entry?.nickname, latestPresence?.nickname]
      .map((value) => normalizeName(value))
      .filter(Boolean)
  );
  const seasonRows = [];

  for (const seasonConfig of RANKING_SEASONS) {
    const seasonRankings = await loadSeasonRankings(seasonConfig.id);
    const matchedEntry = seasonRankings.find((candidate) => {
      if (safePlayerId && candidate.playerId === safePlayerId) {
        return true;
      }

      if (safeUid && candidate.uid && candidate.uid === safeUid) {
        return true;
      }

      return false;
    });

    if (!matchedEntry) {
      continue;
    }

    knownNicknames.add(normalizeName(matchedEntry.name));
    seasonRows.push({
      seasonName: seasonConfig.displayName,
      period: seasonConfig.period,
      status: seasonConfig.status,
      score: matchedEntry.score,
      rank: seasonRankings.findIndex((candidate) => candidate.playerId === matchedEntry.playerId) + 1,
      submittedAt: matchedEntry.submittedAt
    });
  }

  let accountSummary = null;
  if (safeUid) {
    try {
      const userSnapshot = await getDoc(doc(getDb(), "users", safeUid));
      if (userSnapshot.exists()) {
        const userData = userSnapshot.data() || {};
        accountSummary = {
          currentNickname: normalizeName(userData.currentNickname || userData.displayName || userData.lastNickname),
          lastSeenPlayerId: String(userData.lastSeenPlayerId || "").trim(),
          linkedPlayerIds: Array.isArray(userData.linkedPlayerIds)
            ? userData.linkedPlayerIds.map((value) => String(value || "").trim()).filter(Boolean)
            : []
        };
        if (accountSummary.currentNickname) {
          knownNicknames.add(accountSummary.currentNickname);
        }
      }
    } catch (error) {
      console.warn("관리자 플레이어 조회에서 users 컬렉션을 읽지 못했습니다.", error);
    }
  }

  return {
    playerId: safePlayerId,
    uid: safeUid,
    latestPresence,
    sessionStats,
    seasonRows,
    accountSummary,
    knownNicknames: [...knownNicknames].filter(Boolean)
  };
}

function renderSeasonHistoryRows(seasonRows) {
  if (!seasonRows.length) {
    return `
      <div class="player-detail-empty">
        <strong>시즌 랭킹 기록이 없습니다.</strong>
        <p>설정된 시즌들에서 일치하는 랭킹 기록을 찾지 못했습니다.</p>
      </div>
    `;
  }

  return `
    <div class="table-wrap player-detail-table-wrap">
      <table>
        <thead>
          <tr>
            <th>시즌</th>
            <th>점수</th>
            <th>순위</th>
            <th>기록 시간</th>
          </tr>
        </thead>
        <tbody>
          ${seasonRows.map((row) => `
            <tr>
              <td>
                <strong>${escapeHtml(row.seasonName)}</strong>
                <div class="player-detail-table-sub">${escapeHtml(formatText(row.period, row.status))}</div>
              </td>
              <td>${formatNumber(row.score)}</td>
              <td>#${formatNumber(row.rank)}</td>
              <td>${formatDateTime(row.submittedAt)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderPlayerDetail(entry, detail) {
  const latestPresence = detail.latestPresence;
  const sessionStats = detail.sessionStats;
  const accountSummary = detail.accountSummary;

  prefillAdminTargets({
    uid: detail.uid,
    playerId: detail.playerId
  });
  setSelectedManualTarget({
    uid: detail.uid,
    playerId: detail.playerId,
    primaryPlayerId: detail.accountSummary?.lastSeenPlayerId || detail.playerId,
    playerIds: detail.accountSummary?.linkedPlayerIds?.length ? detail.accountSummary.linkedPlayerIds : [detail.playerId],
    nickname: accountSummary?.currentNickname || entry.name || entry.nickname,
    lastSeenAt: latestPresence?.lastSeen,
    isOnline: Boolean(latestPresence?.lastSeen),
    sourceLabel: entry.sourceLabel || "플레이어 조회"
  }, { prefill: true });
  renderRankings(adminState.rankings);

  const identityRows = [
    { label: "플레이어 ID", value: formatText(detail.playerId) },
    { label: "유저 UID", value: formatText(detail.uid) },
    { label: "확인된 닉네임", value: formatList(detail.knownNicknames) },
    { label: "현재 프로필 닉네임", value: formatText(accountSummary?.currentNickname) },
    { label: "연결된 플레이어 ID", value: formatList(accountSummary?.linkedPlayerIds) },
    { label: "최근 접속 플레이어 ID", value: formatText(accountSummary?.lastSeenPlayerId) }
  ];

  const liveRows = [
    { label: "조회 출처", value: formatText(entry.sourceLabel) },
    { label: "현재 상태", value: formatPhaseLabel(latestPresence?.phase || entry.phase || "") },
    { label: "최근 갱신", value: formatDateTime(latestPresence?.lastSeen || entry.lastSeen || "") },
    { label: "최근 30일 세션 수", value: formatNumber(sessionStats.totalSessions) },
    { label: "최근 세션 시작", value: formatDateTime(sessionStats.latestStartedAt) },
    { label: "최근 세션 종료", value: formatDateTime(sessionStats.latestEndedAt) }
  ];

  openPlayerDetailModalShell({
    title: formatText(entry.name || entry.nickname, "플레이어 상세"),
    subtitle: "랭킹, 접속 현황, 시즌 기록을 조회합니다.",
    bodyHtml: `
      <section class="player-detail-section">
        <h3>식별 정보</h3>
        <dl class="player-detail-meta-grid">
          ${renderMetaRows(identityRows)}
        </dl>
      </section>
      <section class="player-detail-section">
        <h3>실시간 상태</h3>
        <dl class="player-detail-meta-grid">
          ${renderMetaRows(liveRows)}
        </dl>
      </section>
      <section class="player-detail-section">
        <h3>시즌 기록</h3>
        ${renderSeasonHistoryRows(detail.seasonRows)}
      </section>
    `
  });
}

async function openPlayerDetail(entry) {
  renderPlayerLoadingState(entry.name || entry.nickname);

  try {
    const detail = await buildPlayerLookupDetail(entry);
    renderPlayerDetail(entry, detail);
  } catch (error) {
    console.error("플레이어 상세 정보를 불러오지 못했습니다.", error);
    renderPlayerErrorState(entry.name || entry.nickname, error);
  }
}

function extractLookupEntryFromEvent(event) {
  const trigger = event.target.closest("[data-player-source]");
  if (!trigger) {
    return null;
  }

  const source = trigger.dataset.playerSource;
  const index = Number.parseInt(trigger.dataset.playerIndex || "", 10);
  if (!Number.isInteger(index) || index < 0) {
    return null;
  }

  if (source === "ranking") {
    const entry = adminState.rankings[index];
    return entry ? { ...entry, sourceLabel: "랭킹 표" } : null;
  }

  if (source === "presence") {
    const entry = adminState.activePresence[index];
    return entry ? { ...entry, sourceLabel: "접속자 표", name: entry.nickname } : null;
  }

  return null;
}

function bindPlayerLookupTriggers() {
  const handleLookup = (event) => {
    const actionTrigger = event.target.closest("[data-manual-target-source]");
    if (actionTrigger) {
      const source = actionTrigger.dataset.manualTargetSource;
      const index = Number.parseInt(actionTrigger.dataset.playerIndex || "", 10);
      if (!Number.isInteger(index) || index < 0) {
        return;
      }

      if (source === "ranking") {
        const entry = adminState.rankings[index];
        if (entry) {
          event.preventDefault();
          handleManualTargetSelectionFromEntry(entry, "랭킹 표");
        }
      }
      return;
    }

    const entry = extractLookupEntryFromEvent(event);
    if (!entry) {
      return;
    }

    event.preventDefault();
    void openPlayerDetail(entry);
  };

  elements.rankingTableBody.addEventListener("click", handleLookup);
  elements.presenceTableBody.addEventListener("click", handleLookup);
}

function renderEmptyRow(tbody, columns, message) {
  tbody.innerHTML = `<tr class="empty-row"><td colspan="${columns}">${escapeHtml(message)}</td></tr>`;
}

function renderRankings(rankings) {
  if (!rankings.length) {
    renderEmptyRow(elements.rankingTableBody, 5, "아직 랭킹이 없습니다.");
    return;
  }

  elements.rankingTableBody.innerHTML = rankings.map((entry, index) => `
    <tr class="${isManualTargetSelected(entry) ? "player-target-row--selected" : ""}">
      <td>${index + 1}</td>
      <td>
        <button
          type="button"
          class="player-link-button"
          data-player-source="ranking"
          data-player-index="${index}"
        >${escapeHtml(entry.name)}</button>
      </td>
      <td>${formatNumber(entry.score)}</td>
      <td>${formatDateTime(entry.submittedAt)}</td>
      <td>
        <button
          type="button"
          class="player-assign-button"
          data-manual-target-source="ranking"
          data-player-index="${index}"
        >${isManualTargetSelected(entry) ? "선택됨" : "작업 선택"}</button>
      </td>
    </tr>
  `).join("");
}

function renderPresence(entries) {
  if (!entries.length) {
    renderEmptyRow(elements.presenceTableBody, 3, "현재 접속 중인 플레이어가 없습니다.");
    return;
  }

  elements.presenceTableBody.innerHTML = entries.map((entry, index) => `
    <tr>
      <td>
        <button
          type="button"
          class="player-link-button"
          data-player-source="presence"
          data-player-index="${index}"
        >${escapeHtml(entry.nickname || "알 수 없음")}</button>
      </td>
      <td><span class="phase-pill">${escapeHtml(formatPhaseLabel(entry.phase))}</span></td>
      <td>${formatAgo(entry.lastSeen)}</td>
    </tr>
  `).join("");
}

function setTrafficCard(periodKey, stats) {
  const uniqueElement = elements[`${periodKey}Unique`];
  const metaElement = elements[`${periodKey}VisitsMeta`];

  if (!uniqueElement || !metaElement) {
    return;
  }

  uniqueElement.textContent = formatNumber(stats.uniquePlayers);
  metaElement.textContent = `${formatNumber(stats.totalSessions)}회 세션`;
}

function resetTrafficCards() {
  ["daily", "weekly", "monthly"].forEach((periodKey) => {
    const uniqueElement = elements[`${periodKey}Unique`];
    const metaElement = elements[`${periodKey}VisitsMeta`];

    if (uniqueElement) {
      uniqueElement.textContent = "-";
    }

    if (metaElement) {
      metaElement.textContent = "데이터 없음";
    }
  });
}

function getStartOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function toDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPeriodStartDate(dayOffset) {
  return getStartOfDay(addDays(new Date(), -dayOffset));
}

function buildRecentDayKeys(dayCount) {
  const today = getStartOfDay(new Date());
  return Array.from({ length: dayCount }, (_, index) => toDayKey(addDays(today, -index)));
}

function toSessionEntry(entryDoc) {
  const data = entryDoc.data();
  return {
    sessionId: entryDoc.id,
    playerId: String(data.playerId || ""),
    nickname: normalizeName(data.nickname) || "플레이어",
    phase: String(data.phase || "ready"),
    startedAt: typeof data.startedAt === "string" ? data.startedAt : "",
    endedAt: typeof data.endedAt === "string" ? data.endedAt : "",
    lastSeen: typeof data.lastSeen === "string" ? data.lastSeen : ""
  };
}

function isValidIso(value) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function buildPeriodStats(sessionEntries, definition) {
  const startTime = getPeriodStartDate(definition.dayOffset).getTime();
  const uniquePlayers = new Set();
  const matchedEntries = sessionEntries.filter((entry) => {
    const startedAt = new Date(entry.startedAt).getTime();
    return !Number.isNaN(startedAt) && startedAt >= startTime;
  });

  matchedEntries.forEach((entry) => {
    if (entry.playerId) {
      uniquePlayers.add(entry.playerId);
    }
  });

  return {
    key: definition.key,
    label: definition.label,
    uniquePlayers: uniquePlayers.size,
    totalSessions: matchedEntries.length
  };
}

function buildDailyStats(sessionEntries) {
  const dayKeys = buildRecentDayKeys(ANALYTICS_WINDOW_DAYS);
  const dailyStats = new Map(dayKeys.map((dayKey) => [dayKey, {
    dayKey,
    totalSessions: 0,
    uniquePlayers: new Set()
  }]));

  sessionEntries.forEach((entry) => {
    const startedAt = new Date(entry.startedAt);
    if (Number.isNaN(startedAt.getTime())) {
      return;
    }

    const dayKey = toDayKey(startedAt);
    const bucket = dailyStats.get(dayKey);
    if (!bucket) {
      return;
    }

    bucket.totalSessions += 1;
    if (entry.playerId) {
      bucket.uniquePlayers.add(entry.playerId);
    }
  });

  return dayKeys.map((dayKey) => {
    const bucket = dailyStats.get(dayKey);
    return {
      dayKey,
      totalSessions: bucket.totalSessions,
      uniquePlayers: bucket.uniquePlayers.size
    };
  });
}

function getTrendChartScaleMax(values) {
  const maxValue = Math.max(...values, 1);
  if (maxValue <= 5) {
    return 5;
  }

  if (maxValue <= 10) {
    return 10;
  }

  return Math.ceil(maxValue / 5) * 5;
}

function getTrendChartTicks(scaleMax) {
  const tickCount = scaleMax <= 5 ? scaleMax : 5;
  return Array.from({ length: tickCount + 1 }, (_, index) => {
    const value = Math.round((scaleMax / tickCount) * index);
    return scaleMax - value;
  });
}

function formatTrendChartDayLabel(dayKey) {
  const [, month = "", day = ""] = String(dayKey || "").split("-");
  return `${month}.${day}`;
}

function setupChartTooltip() {
  const canvas = elements.trendChart;
  const tooltip = elements.chartTooltip;
  if (!canvas || !tooltip) {
    return;
  }

  canvas.addEventListener("mousemove", (event) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const hit = barHitAreas.find((area) => (
      mouseX >= area.x
      && mouseX < area.x + area.w
      && mouseY >= area.hitTop
      && mouseY < area.hitBottom
    ));

    if (!hit) {
      tooltip.classList.remove("visible");
      return;
    }

    tooltip.innerHTML = `
      <strong>${escapeHtml(hit.entry.dayKey)}</strong><br>
      순 방문자 ${formatNumber(hit.entry.uniquePlayers)}<br>
      세션 ${formatNumber(hit.entry.totalSessions)}
    `;
    tooltip.style.left = `${Math.max(4, hit.x)}px`;
    tooltip.style.right = "auto";
    tooltip.style.top = `${Math.max(36, hit.barY)}px`;
    tooltip.classList.add("visible");
  });

  canvas.addEventListener("mouseleave", () => {
    tooltip.classList.remove("visible");
  });
}

function renderTrendChart(dailyStats) {
  const canvas = elements.trendChart;
  if (!canvas) {
    return;
  }

  const data = [...dailyStats].reverse();
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.offsetWidth;
  const height = canvas.offsetHeight;
  if (!width || !height) {
    return;
  }

  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const context = canvas.getContext("2d");
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.scale(dpr, dpr);
  context.clearRect(0, 0, width, height);

  const padding = { top: 20, right: 12, bottom: 36, left: 42 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const scaleMax = getTrendChartScaleMax(data.map((entry) => entry.uniquePlayers));
  const tickValues = getTrendChartTicks(scaleMax);
  const barGap = 2;
  const barWidth = Math.max(3, (chartWidth - barGap * Math.max(0, data.length - 1)) / Math.max(1, data.length));
  const baselineY = padding.top + chartHeight;

  barHitAreas = [];

  context.strokeStyle = "rgba(165, 119, 82, 0.18)";
  context.fillStyle = "rgba(122, 94, 79, 0.85)";
  context.lineWidth = 1;
  context.font = '12px "Noto Sans KR", sans-serif';
  context.textAlign = "right";
  context.textBaseline = "middle";

  tickValues.forEach((tickValue) => {
    const y = padding.top + (tickValue / scaleMax) * chartHeight;
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(width - padding.right, y);
    context.stroke();
    context.fillText(String(tickValue), padding.left - 8, y);
  });

  context.beginPath();
  context.moveTo(padding.left, baselineY);
  context.lineTo(width - padding.right, baselineY);
  context.strokeStyle = "rgba(217, 111, 43, 0.28)";
  context.stroke();

  data.forEach((entry, index) => {
    const x = padding.left + index * (barWidth + barGap);
    const rawBarHeight = (entry.uniquePlayers / scaleMax) * chartHeight;
    const barHeight = entry.uniquePlayers > 0 ? Math.max(rawBarHeight, 4) : 0;
    const barY = padding.top + chartHeight - barHeight;

    if (barHeight > 0) {
      context.fillStyle = "#d96f2b";
      context.fillRect(x, barY, barWidth, barHeight);
    }

    barHitAreas.push({
      x,
      w: barWidth + barGap,
      barY: barHeight > 0 ? barY : baselineY,
      hitTop: padding.top,
      hitBottom: padding.top + chartHeight,
      entry
    });
  });

  const labelIndexes = new Set([0, data.length - 1]);
  const targetLabelCount = Math.min(6, data.length);
  for (let index = 1; index < targetLabelCount - 1; index += 1) {
    labelIndexes.add(Math.round((index * (data.length - 1)) / Math.max(1, targetLabelCount - 1)));
  }

  context.fillStyle = "rgba(122, 94, 79, 0.85)";
  context.textAlign = "center";
  context.textBaseline = "top";
  labelIndexes.forEach((index) => {
    const entry = data[index];
    if (!entry) {
      return;
    }

    const x = padding.left + index * (barWidth + barGap) + (barWidth / 2);
    context.fillText(formatTrendChartDayLabel(entry.dayKey), x, baselineY + 8);
  });
}

function renderAnalytics(sessionEntries) {
  const periodStats = PERIOD_DEFINITIONS.map((definition) => buildPeriodStats(sessionEntries, definition));
  const dailyStats = buildDailyStats(sessionEntries);
  adminState.trendDailyStats = dailyStats;
  periodStats.forEach((stats) => setTrafficCard(stats.key, stats));
  renderTrendChart(dailyStats);
  elements.trendChartStatus.textContent = sessionEntries.length
    ? `최근 세션 ${formatNumber(sessionEntries.length)}개 기준`
    : "최근 세션 데이터 없음";
}

function applyRankingFailure() {
  renderEmptyRow(elements.rankingTableBody, 5, "랭킹을 불러오지 못했습니다.");
  elements.rankingCount.textContent = "-";
  elements.rankingStatus.textContent = "불러오기 실패";
}

function applyPresenceFailure() {
  renderEmptyRow(elements.presenceTableBody, 3, "실시간 접속 현황을 불러오지 못했습니다.");
  elements.activeCount.textContent = "-";
  elements.presenceStatus.textContent = "불러오기 실패";
}

function applyAnalyticsFailure() {
  adminState.trendDailyStats = [];
  resetTrafficCards();
  elements.trendChartStatus.textContent = "불러오기 실패";
}

async function fetchAllRankings() {
  const rankingQuery = query(collection(getDb(), CURRENT_RANKING_COLLECTION), orderBy("score", "desc"));
  const snapshot = await getDocs(rankingQuery);

  return snapshot.docs
    .map((entryDoc) => {
      const data = entryDoc.data();
      return {
        playerId: String(data.playerId || ""),
        uid: String(data.uid || "").trim(),
        name: normalizeName(data.nicknameSnapshot || data.name),
        score: Math.floor(Number(data.score)),
        submittedAt: typeof data.submittedAt === "string" ? data.submittedAt : ""
      };
    })
    .filter((entry) => entry.name && Number.isFinite(entry.score))
    .sort(compareRankings);
}

async function fetchActivePresence() {
  const cutoffIso = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();
  const presenceQuery = query(
    collection(getDb(), PRESENCE_COLLECTION),
    where("lastSeen", ">", cutoffIso),
    orderBy("lastSeen", "desc")
  );
  const snapshot = await getDocs(presenceQuery);

  return snapshot.docs.map((entryDoc) => {
    const data = entryDoc.data();
    return {
      playerId: String(data.playerId || ""),
      nickname: normalizeName(data.nickname) || "플레이어",
      phase: String(data.phase || "ready"),
      page: String(data.page || ""),
      lastSeen: typeof data.lastSeen === "string" ? data.lastSeen : ""
    };
  });
}

async function fetchRecentSessions() {
  const cutoffIso = getPeriodStartDate(ANALYTICS_WINDOW_DAYS - 1).toISOString();
  const sessionQuery = query(
    collection(getDb(), SESSION_COLLECTION),
    where("startedAt", ">=", cutoffIso),
    orderBy("startedAt", "desc")
  );
  const snapshot = await getDocs(sessionQuery);

  return snapshot.docs
    .map((entryDoc) => toSessionEntry(entryDoc))
    .filter((entry) => isValidIso(entry.startedAt));
}

function isManualTargetSelected(entry = {}) {
  const selectedTarget = adminState.selectedManualTarget;
  if (!selectedTarget) {
    return false;
  }

  const entryUid = String(entry.uid || "").trim();
  const entryPlayerId = String(entry.playerId || "").trim();
  return (selectedTarget.uid && entryUid && selectedTarget.uid === entryUid)
    || (selectedTarget.primaryPlayerId && entryPlayerId && selectedTarget.primaryPlayerId === entryPlayerId);
}

function handleManualTargetSelectionFromEntry(entry = {}, sourceLabel = "랭킹 표") {
  setSelectedManualTarget({
    uid: entry.uid,
    playerId: entry.playerId,
    primaryPlayerId: entry.playerId,
    playerIds: [entry.playerId],
    nickname: entry.name || entry.nickname,
    lastSeenAt: entry.lastSeen,
    isOnline: Boolean(entry.lastSeen),
    sourceLabel
  });
  renderRankings(adminState.rankings);
  setInlineStatus(elements.playerActionStatus, `${formatText(entry.name || entry.nickname, "플레이어")} 선택됨. 아래 수동 작업에 바로 적용됩니다.`, "success");
}

function bindManualTargetControls() {
  elements.playerSelectionClearButton?.addEventListener("click", () => {
    clearSelectedManualTarget();
    renderRankings(adminState.rankings);
    setInlineStatus(elements.playerActionStatus, "선택한 플레이어를 해제했습니다.");
  });

  [
    elements.walletAdjustDelta,
    elements.walletAdjustReason,
    elements.walletAdjustTitle,
    elements.walletAdjustBody
  ].forEach((element) => {
    element?.addEventListener("input", () => {
      renderWalletAdjustPreview();
    });
  });

  [
    elements.sendMessageId,
    elements.sendMessageTitle,
    elements.sendMessageBody
  ].forEach((element) => {
    element?.addEventListener("input", () => {
      renderSendMessagePreview();
    });
  });
}

async function handleSeasonPayoutAction({ apply }) {
  const season = getSelectedPayoutSeason();
  const playerId = readTrimmedValue(elements.seasonPayoutPlayerId);
  const targetUid = readTrimmedValue(elements.seasonPayoutTargetUid);
  const limit = Math.max(0, readWholeNumber(elements.seasonPayoutLimit, 0));
  const seasonLabel = getSelectedPayoutSeasonLabel();

  if (targetUid && !playerId) {
    throw new Error("강제 대상 UID를 쓰려면 플레이어 ID 필터가 필요합니다.");
  }

  setInlineStatus(elements.seasonPayoutStatus, apply ? "보상을 지급하는 중..." : "보상 미리보기를 불러오는 중...");
  setResultBox(elements.seasonPayoutResult, "처리 중...");

  const result = await runAdminActionRequest(apply ? "season-payout-apply" : "season-payout-preview", {
    season,
    seasonLabel,
    limit,
    playerId,
    targetUid
  });

  setInlineStatus(
    elements.seasonPayoutStatus,
    apply
      ? `${formatText(seasonLabel)} 보상 지급 완료. ${formatNumber(result.processedEntries)}명 처리됨.`
      : `${formatText(seasonLabel)} 보상 미리보기 완료. ${formatNumber(result.eligibleEntries)}명 대상.`,
    "success"
  );
  setResultBox(elements.seasonPayoutResult, result);

  if (apply) {
    await refreshAdminData();
  }
}

async function handleWalletAdjustAction() {
  const uid = getRequiredManualTargetValue();
  const delta = readWholeNumber(elements.walletAdjustDelta, 0);
  const reason = readTrimmedValue(elements.walletAdjustReason);
  const draft = buildWalletAdjustDraft(delta, reason);
  const title = readTrimmedValue(elements.walletAdjustTitle) || draft.title;
  const body = readTrimmedValue(elements.walletAdjustBody) || draft.body;

  if (!delta) {
    throw new Error("증감값은 0일 수 없습니다.");
  }

  if (!reason) {
    throw new Error("사유를 입력해주세요.");
  }

  setInlineStatus(elements.playerActionStatus, "후쥬 잔액을 조정하는 중...");

  await runAdminActionRequest("adjust-wallet", {
    uid,
    delta,
    reason,
    title,
    body,
    apply: true,
    season: getSelectedPayoutSeason(),
    seasonLabel: "관리자"
  });

  setInlineStatus(elements.playerActionStatus, `${uid} 후쥬 잔액 조정 완료.`, "success");
}

async function handleSendMessageAction() {
  const uid = getRequiredManualTargetValue();
  const messageId = readTrimmedValue(elements.sendMessageId);
  const title = readTrimmedValue(elements.sendMessageTitle);
  const body = readTrimmedValue(elements.sendMessageBody);

  if (!title || !body) {
    throw new Error("제목과 본문을 입력해주세요.");
  }

  setInlineStatus(elements.playerActionStatus, "메시지를 보내는 중...");

  await runAdminActionRequest("send-message", {
    uid,
    messageId,
    title,
    body,
    apply: true,
    season: getSelectedPayoutSeason(),
    seasonLabel: "관리자",
    claimed: true
  });

  setInlineStatus(elements.playerActionStatus, `${uid}에게 메시지 전송 완료.`, "success");
}

async function handleDeleteMessageAction() {
  const uid = getRequiredManualTargetValue();
  const messageId = readTrimmedValue(elements.deleteMessageId);

  if (!messageId) {
    throw new Error("메시지 ID가 필요합니다.");
  }

  setInlineStatus(elements.playerActionStatus, "메시지를 삭제하는 중...");

  await runAdminActionRequest("delete-message", {
    uid,
    messageId,
    apply: true
  });

  setInlineStatus(elements.playerActionStatus, `${uid}의 메시지 ${messageId} 삭제 완료.`, "success");
}

function bindAdminOperationControls() {
  elements.seasonPayoutPreviewButton?.addEventListener("click", async () => {
    try {
      await handleSeasonPayoutAction({ apply: false });
    } catch (error) {
      console.error(error);
      setInlineStatus(elements.seasonPayoutStatus, formatText(error?.message, "보상 미리보기에 실패했습니다."), "error");
      setResultBox(elements.seasonPayoutResult, formatText(error?.message, "보상 미리보기에 실패했습니다."));
    }
  });

  elements.seasonPayoutApplyButton?.addEventListener("click", async () => {
    const seasonLabel = getSelectedPayoutSeasonLabel();
    if (!window.confirm(`${seasonLabel} 보상을 실제 지급합니다. 잔액과 메시지함이 함께 갱신됩니다. 계속할까요?`)) {
      return;
    }

    try {
      await handleSeasonPayoutAction({ apply: true });
    } catch (error) {
      console.error(error);
      setInlineStatus(elements.seasonPayoutStatus, formatText(error?.message, "보상 지급에 실패했습니다."), "error");
      setResultBox(elements.seasonPayoutResult, formatText(error?.message, "보상 지급에 실패했습니다."));
    }
  });

  elements.walletAdjustApplyButton?.addEventListener("click", async () => {
    try {
      await handleWalletAdjustAction();
    } catch (error) {
      console.error(error);
      setInlineStatus(elements.playerActionStatus, formatText(error?.message, "후쥬 잔액 조정에 실패했습니다."), "error");
    }
  });

  elements.sendMessageApplyButton?.addEventListener("click", async () => {
    try {
      await handleSendMessageAction();
    } catch (error) {
      console.error(error);
      setInlineStatus(elements.playerActionStatus, formatText(error?.message, "메시지 전송에 실패했습니다."), "error");
    }
  });

  elements.deleteMessageApplyButton?.addEventListener("click", async () => {
    const uid = getManualTargetValue(adminState.selectedManualTarget || {});
    const messageId = readTrimmedValue(elements.deleteMessageId);
    if (!window.confirm(`${uid || "(비어 있음)"} 계정의 메시지 ${messageId || "(비어 있음)"}를 삭제할까요?`)) {
      return;
    }

    try {
      await handleDeleteMessageAction();
    } catch (error) {
      console.error(error);
      setInlineStatus(elements.playerActionStatus, formatText(error?.message, "메시지 삭제에 실패했습니다."), "error");
    }
  });
}

async function refreshAdminData() {
  elements.refreshButton.disabled = true;
  elements.presenceStatus.textContent = "불러오는 중...";
  elements.rankingStatus.textContent = "불러오는 중...";
  elements.trendChartStatus.textContent = "불러오는 중...";

  const [rankingsResult, presenceResult, sessionsResult] = await Promise.allSettled([
    fetchAllRankings(),
    fetchActivePresence(),
    fetchRecentSessions()
  ]);

  if (rankingsResult.status === "fulfilled") {
    const rankings = rankingsResult.value;
    adminState.rankings = rankings;
    renderRankings(rankings);
    elements.rankingCount.textContent = formatNumber(rankings.length);
    elements.rankingStatus.textContent = `${CURRENT_SEASON_META.displayName} / ${formatNumber(rankings.length)}개 기록`;
  } else {
    console.error(rankingsResult.reason);
    adminState.rankings = [];
    applyRankingFailure();
  }

  if (presenceResult.status === "fulfilled") {
    const activeEntries = presenceResult.value;
    adminState.activePresence = activeEntries;
    renderPresence(activeEntries);
    elements.activeCount.textContent = formatNumber(activeEntries.length);
    elements.presenceStatus.textContent = activeEntries.length ? "실시간 접속 추정치" : "현재 접속 없음";
  } else {
    console.error(presenceResult.reason);
    adminState.activePresence = [];
    applyPresenceFailure();
  }

  if (sessionsResult.status === "fulfilled") {
    adminState.recentSessions = sessionsResult.value;
    renderAnalytics(sessionsResult.value);
  } else {
    console.error(sessionsResult.reason);
    adminState.recentSessions = [];
    applyAnalyticsFailure();
  }

  elements.lastUpdated.textContent = formatDateTime(new Date().toISOString());
  elements.refreshButton.disabled = false;
}

async function bootstrapAdminDashboard() {
  try {
    await requireAuthorizedAdmin();
  } catch (error) {
    console.warn("관리자 대시보드 접근이 차단되었습니다.", error);
    return;
  }

  ensurePlayerModal();
  renderSelectedManualTarget();
  renderManualMessagePreviews();
  setupChartTooltip();
  bindPlayerLookupTriggers();
  bindManualTargetControls();
  populateSeasonSelect();
  bindAdminOperationControls();
  window.addEventListener("resize", () => {
    if (adminState.trendDailyStats.length) {
      renderTrendChart(adminState.trendDailyStats);
    }
  });

  elements.refreshButton.addEventListener("click", () => {
    void refreshAdminData();
  });

  await refreshAdminData();
  window.setInterval(() => {
    void refreshAdminData();
  }, REFRESH_INTERVAL_MS);
}

void bootstrapAdminDashboard();
