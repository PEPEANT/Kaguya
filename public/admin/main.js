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

const PERIOD_DEFINITIONS = [
  { key: "daily", label: "Today", days: 1, dayOffset: 0 },
  { key: "weekly", label: "Last 7 days", days: 7, dayOffset: 6 },
  { key: "monthly", label: "Last 30 days", days: 30, dayOffset: 29 }
];

const PHASE_LABELS = {
  ready: "Ready",
  loading: "Loading",
  playing: "Playing",
  submitting: "Submitting",
  error: "Error"
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
  walletAdjustUid: document.getElementById("walletAdjustUid"),
  walletAdjustDelta: document.getElementById("walletAdjustDelta"),
  walletAdjustReason: document.getElementById("walletAdjustReason"),
  walletAdjustTitle: document.getElementById("walletAdjustTitle"),
  walletAdjustBody: document.getElementById("walletAdjustBody"),
  walletAdjustApplyButton: document.getElementById("walletAdjustApplyButton"),
  sendMessageUid: document.getElementById("sendMessageUid"),
  sendMessageId: document.getElementById("sendMessageId"),
  sendMessageTitle: document.getElementById("sendMessageTitle"),
  sendMessageBody: document.getElementById("sendMessageBody"),
  sendMessageApplyButton: document.getElementById("sendMessageApplyButton"),
  deleteMessageUid: document.getElementById("deleteMessageUid"),
  deleteMessageId: document.getElementById("deleteMessageId"),
  deleteMessageApplyButton: document.getElementById("deleteMessageApplyButton"),
  playerActionStatus: document.getElementById("playerActionStatus"),
  playerActionResult: document.getElementById("playerActionResult")
};

const adminAccessConfig = getAdminAccessConfig();
const adminState = {
  rankings: [],
  activePresence: [],
  recentSessions: [],
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
    [elements.walletAdjustUid, elements.sendMessageUid, elements.deleteMessageUid, elements.seasonPayoutTargetUid]
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

async function runAdminActionRequest(action, payload) {
  const idToken = await getCurrentAuthIdToken();
  const response = await fetch("/api/admin/action", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify({ action, payload })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(formatText(data.error, `Admin request failed (${response.status})`));
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
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.floor(hours / 24)}d ago`;
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
          <a class="refresh-button" href="${escapeHtml(getGameEntryUrl().toString())}">Open Game</a>
          <button class="refresh-button refresh-button--secondary" type="button" id="retryAdminAccess">Retry</button>
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
      title: "Admin sign-in required",
      body: "Sign in with an admin account in the main game first, then reopen this page. Use the same address for both pages, such as localhost on both tabs instead of mixing localhost and 127.0.0.1."
    });
    throw new Error("Admin login required.");
  }

  if (!isAuthorizedAdmin(user)) {
    renderAccessGate({
      title: "Access denied",
      body: adminAccessConfig.allowedEmails.length
        ? `The signed-in account (${normalizeEmail(user.email)}) is not in the admin allowlist.`
        : "Set ADMIN_ALLOWED_EMAILS on the app server, then sign in again."
    });
    throw new Error("Admin allowlist rejected the current user.");
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
          <p class="player-detail-eyebrow">Player Lookup</p>
          <h2 id="playerDetailTitle">Player detail</h2>
          <p id="playerDetailSubtitle" class="player-detail-subtitle">Select a player to inspect live and seasonal records.</p>
        </div>
        <button type="button" class="player-detail-close" data-player-modal-close aria-label="Close player detail">Close</button>
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
    title: formatText(name, "Player detail"),
    subtitle: "Loading live and seasonal records...",
    bodyHtml: `
      <div class="player-detail-empty">
        <strong>Loading player detail...</strong>
        <p>Collecting ranking and presence data for this player.</p>
      </div>
    `
  });
}

function renderPlayerErrorState(name, error) {
  openPlayerDetailModalShell({
    title: formatText(name, "Player detail"),
    subtitle: "Could not load the requested player record.",
    bodyHtml: `
      <div class="player-detail-empty">
        <strong>Player detail unavailable</strong>
        <p>${escapeHtml(formatText(error?.message, "Unknown error"))}</p>
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
      console.warn("Admin player lookup could not read users collection.", error);
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
        <strong>No season ranking history</strong>
        <p>No matching ranking entries were found across the configured seasons.</p>
      </div>
    `;
  }

  return `
    <div class="table-wrap player-detail-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Season</th>
            <th>Score</th>
            <th>Rank</th>
            <th>Submitted</th>
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

  const identityRows = [
    { label: "Player ID", value: formatText(detail.playerId) },
    { label: "User ID", value: formatText(detail.uid) },
    { label: "Known names", value: formatList(detail.knownNicknames) },
    { label: "Current profile name", value: formatText(accountSummary?.currentNickname) },
    { label: "Linked player IDs", value: formatList(accountSummary?.linkedPlayerIds) },
    { label: "Last seen player ID", value: formatText(accountSummary?.lastSeenPlayerId) }
  ];

  const liveRows = [
    { label: "Source", value: formatText(entry.sourceLabel) },
    { label: "Live phase", value: formatPhaseLabel(latestPresence?.phase || entry.phase || "") },
    { label: "Last seen", value: formatDateTime(latestPresence?.lastSeen || entry.lastSeen || "") },
    { label: "30-day sessions", value: formatNumber(sessionStats.totalSessions) },
    { label: "Latest session start", value: formatDateTime(sessionStats.latestStartedAt) },
    { label: "Latest session end", value: formatDateTime(sessionStats.latestEndedAt) }
  ];

  openPlayerDetailModalShell({
    title: formatText(entry.name || entry.nickname, "Player detail"),
    subtitle: "Read-only admin lookup for ranking, presence, and seasonal history.",
    bodyHtml: `
      <section class="player-detail-section">
        <h3>Identity</h3>
        <dl class="player-detail-meta-grid">
          ${renderMetaRows(identityRows)}
        </dl>
      </section>
      <section class="player-detail-section">
        <h3>Live status</h3>
        <dl class="player-detail-meta-grid">
          ${renderMetaRows(liveRows)}
        </dl>
      </section>
      <section class="player-detail-section">
        <h3>Season history</h3>
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
    console.error("Failed to load player detail.", error);
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
    return entry ? { ...entry, sourceLabel: "Ranking table" } : null;
  }

  if (source === "presence") {
    const entry = adminState.activePresence[index];
    return entry ? { ...entry, sourceLabel: "Presence table", name: entry.nickname } : null;
  }

  return null;
}

function bindPlayerLookupTriggers() {
  const handleLookup = (event) => {
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
    renderEmptyRow(elements.rankingTableBody, 4, "No rankings yet.");
    return;
  }

  elements.rankingTableBody.innerHTML = rankings.map((entry, index) => `
    <tr>
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
    </tr>
  `).join("");
}

function renderPresence(entries) {
  if (!entries.length) {
    renderEmptyRow(elements.presenceTableBody, 3, "No active players.");
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
        >${escapeHtml(entry.nickname || "Unknown")}</button>
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
  metaElement.textContent = `${formatNumber(stats.totalSessions)} sessions`;
}

function resetTrafficCards() {
  ["daily", "weekly", "monthly"].forEach((periodKey) => {
    const uniqueElement = elements[`${periodKey}Unique`];
    const metaElement = elements[`${periodKey}VisitsMeta`];

    if (uniqueElement) {
      uniqueElement.textContent = "-";
    }

    if (metaElement) {
      metaElement.textContent = "No data";
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
    nickname: normalizeName(data.nickname) || "Player",
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
      Visitors ${formatNumber(hit.entry.uniquePlayers)}<br>
      Sessions ${formatNumber(hit.entry.totalSessions)}
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

  const padding = { top: 20, right: 12, bottom: 36, left: 38 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...data.map((entry) => entry.uniquePlayers), 1);
  const barGap = 2;
  const barWidth = Math.max(3, (chartWidth - barGap * Math.max(0, data.length - 1)) / Math.max(1, data.length));

  barHitAreas = [];

  data.forEach((entry, index) => {
    const x = padding.left + index * (barWidth + barGap);
    const barHeight = (entry.uniquePlayers / maxValue) * chartHeight;
    const barY = padding.top + chartHeight - barHeight;

    context.fillStyle = barHeight > 1 ? "#d96f2b" : "rgba(217, 111, 43, 0.2)";
    context.fillRect(x, Math.max(barY, padding.top + chartHeight - 2), barWidth, Math.max(barHeight, 2));

    barHitAreas.push({
      x,
      w: barWidth + barGap,
      barY,
      hitTop: padding.top,
      hitBottom: padding.top + chartHeight,
      entry
    });
  });
}

function renderAnalytics(sessionEntries) {
  const periodStats = PERIOD_DEFINITIONS.map((definition) => buildPeriodStats(sessionEntries, definition));
  const dailyStats = buildDailyStats(sessionEntries);
  periodStats.forEach((stats) => setTrafficCard(stats.key, stats));
  renderTrendChart(dailyStats);
  elements.trendChartStatus.textContent = sessionEntries.length
    ? `Based on ${formatNumber(sessionEntries.length)} recent sessions`
    : "No recent session data";
}

function applyRankingFailure() {
  renderEmptyRow(elements.rankingTableBody, 4, "Could not load rankings.");
  elements.rankingCount.textContent = "-";
  elements.rankingStatus.textContent = "Load failed";
}

function applyPresenceFailure() {
  renderEmptyRow(elements.presenceTableBody, 3, "Could not load live presence.");
  elements.activeCount.textContent = "-";
  elements.presenceStatus.textContent = "Load failed";
}

function applyAnalyticsFailure() {
  resetTrafficCards();
  elements.trendChartStatus.textContent = "Load failed";
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
      nickname: normalizeName(data.nickname) || "Player",
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

async function handleSeasonPayoutAction({ apply }) {
  const season = getSelectedPayoutSeason();
  const playerId = readTrimmedValue(elements.seasonPayoutPlayerId);
  const targetUid = readTrimmedValue(elements.seasonPayoutTargetUid);
  const limit = Math.max(0, readWholeNumber(elements.seasonPayoutLimit, 0));
  const seasonLabel = getSelectedPayoutSeasonLabel();

  if (targetUid && !playerId) {
    throw new Error("Force target UID requires a playerId filter.");
  }

  setInlineStatus(elements.seasonPayoutStatus, apply ? "Applying payout..." : "Loading payout preview...");
  setResultBox(elements.seasonPayoutResult, "Working...");

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
      ? `${formatText(seasonLabel)} payout applied. ${formatNumber(result.processedEntries)} entries processed.`
      : `${formatText(seasonLabel)} payout preview ready. ${formatNumber(result.eligibleEntries)} eligible entries.`,
    "success"
  );
  setResultBox(elements.seasonPayoutResult, result);

  if (apply) {
    await refreshAdminData();
  }
}

async function handleWalletAdjustAction() {
  const uid = readTrimmedValue(elements.walletAdjustUid);
  const delta = readWholeNumber(elements.walletAdjustDelta, 0);
  const reason = readTrimmedValue(elements.walletAdjustReason);
  const title = readTrimmedValue(elements.walletAdjustTitle);
  const body = readTrimmedValue(elements.walletAdjustBody);

  if (!uid) {
    throw new Error("Target UID is required.");
  }

  if (!delta) {
    throw new Error("Delta must not be zero.");
  }

  if (!reason) {
    throw new Error("Reason is required.");
  }

  setInlineStatus(elements.playerActionStatus, "Applying wallet change...");
  setResultBox(elements.playerActionResult, "Working...");

  const result = await runAdminActionRequest("adjust-wallet", {
    uid,
    delta,
    reason,
    title,
    body,
    apply: true,
    season: getSelectedPayoutSeason(),
    seasonLabel: "Admin"
  });

  setInlineStatus(elements.playerActionStatus, `Wallet updated for ${uid}.`, "success");
  setResultBox(elements.playerActionResult, result);
}

async function handleSendMessageAction() {
  const uid = readTrimmedValue(elements.sendMessageUid);
  const messageId = readTrimmedValue(elements.sendMessageId);
  const title = readTrimmedValue(elements.sendMessageTitle);
  const body = readTrimmedValue(elements.sendMessageBody);

  if (!uid) {
    throw new Error("Target UID is required.");
  }

  if (!title || !body) {
    throw new Error("Title and body are required.");
  }

  setInlineStatus(elements.playerActionStatus, "Sending inbox message...");
  setResultBox(elements.playerActionResult, "Working...");

  const result = await runAdminActionRequest("send-message", {
    uid,
    messageId,
    title,
    body,
    apply: true,
    season: getSelectedPayoutSeason(),
    seasonLabel: "Admin",
    claimed: true
  });

  setInlineStatus(elements.playerActionStatus, `Message sent to ${uid}.`, "success");
  setResultBox(elements.playerActionResult, result);
}

async function handleDeleteMessageAction() {
  const uid = readTrimmedValue(elements.deleteMessageUid);
  const messageId = readTrimmedValue(elements.deleteMessageId);

  if (!uid) {
    throw new Error("Target UID is required.");
  }

  if (!messageId) {
    throw new Error("Message ID is required.");
  }

  setInlineStatus(elements.playerActionStatus, "Deleting inbox message...");
  setResultBox(elements.playerActionResult, "Working...");

  const result = await runAdminActionRequest("delete-message", {
    uid,
    messageId,
    apply: true
  });

  setInlineStatus(elements.playerActionStatus, `Message ${messageId} deleted for ${uid}.`, "success");
  setResultBox(elements.playerActionResult, result);
}

function bindAdminOperationControls() {
  elements.seasonPayoutPreviewButton?.addEventListener("click", async () => {
    try {
      await handleSeasonPayoutAction({ apply: false });
    } catch (error) {
      console.error(error);
      setInlineStatus(elements.seasonPayoutStatus, formatText(error?.message, "Payout preview failed."), "error");
      setResultBox(elements.seasonPayoutResult, formatText(error?.message, "Payout preview failed."));
    }
  });

  elements.seasonPayoutApplyButton?.addEventListener("click", async () => {
    const seasonLabel = getSelectedPayoutSeasonLabel();
    if (!window.confirm(`${seasonLabel} payout will update balances and inbox messages. Continue?`)) {
      return;
    }

    try {
      await handleSeasonPayoutAction({ apply: true });
    } catch (error) {
      console.error(error);
      setInlineStatus(elements.seasonPayoutStatus, formatText(error?.message, "Payout apply failed."), "error");
      setResultBox(elements.seasonPayoutResult, formatText(error?.message, "Payout apply failed."));
    }
  });

  elements.walletAdjustApplyButton?.addEventListener("click", async () => {
    try {
      await handleWalletAdjustAction();
    } catch (error) {
      console.error(error);
      setInlineStatus(elements.playerActionStatus, formatText(error?.message, "Wallet update failed."), "error");
      setResultBox(elements.playerActionResult, formatText(error?.message, "Wallet update failed."));
    }
  });

  elements.sendMessageApplyButton?.addEventListener("click", async () => {
    try {
      await handleSendMessageAction();
    } catch (error) {
      console.error(error);
      setInlineStatus(elements.playerActionStatus, formatText(error?.message, "Message send failed."), "error");
      setResultBox(elements.playerActionResult, formatText(error?.message, "Message send failed."));
    }
  });

  elements.deleteMessageApplyButton?.addEventListener("click", async () => {
    const uid = readTrimmedValue(elements.deleteMessageUid);
    const messageId = readTrimmedValue(elements.deleteMessageId);
    if (!window.confirm(`Delete message ${messageId || "(empty)"} for ${uid || "(empty)"}?`)) {
      return;
    }

    try {
      await handleDeleteMessageAction();
    } catch (error) {
      console.error(error);
      setInlineStatus(elements.playerActionStatus, formatText(error?.message, "Message delete failed."), "error");
      setResultBox(elements.playerActionResult, formatText(error?.message, "Message delete failed."));
    }
  });
}

async function refreshAdminData() {
  elements.refreshButton.disabled = true;
  elements.presenceStatus.textContent = "Loading...";
  elements.rankingStatus.textContent = "Loading...";
  elements.trendChartStatus.textContent = "Loading...";

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
    elements.rankingStatus.textContent = `${CURRENT_SEASON_META.displayName} / ${formatNumber(rankings.length)} records`;
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
    elements.presenceStatus.textContent = activeEntries.length ? "Estimated live presence" : "No active presence";
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
    console.warn("Admin dashboard access blocked.", error);
    return;
  }

  ensurePlayerModal();
  setupChartTooltip();
  bindPlayerLookupTriggers();
  populateSeasonSelect();
  bindAdminOperationControls();

  elements.refreshButton.addEventListener("click", () => {
    void refreshAdminData();
  });

  await refreshAdminData();
  window.setInterval(() => {
    void refreshAdminData();
  }, REFRESH_INTERVAL_MS);
}

void bootstrapAdminDashboard();
