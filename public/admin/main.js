import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { collection, getDocs, getFirestore, orderBy, query, where } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { getAdminAccessConfig, getCurrentRankingSeason, getFirebaseRuntimeConfig, getRankingSeasonCollection, getRankingSeasonConfig } from "../game/config/runtime.js";

const PRESENCE_COLLECTION = "presence";
const SESSION_COLLECTION = "presenceSessions";
const ACTIVE_WINDOW_MS = 35000;
const REFRESH_INTERVAL_MS = 10000;
const ANALYTICS_WINDOW_DAYS = 30;
const CURRENT_SEASON = getCurrentRankingSeason();
const CURRENT_RANKING_COLLECTION = getRankingSeasonCollection(CURRENT_SEASON);
const CURRENT_SEASON_META = getRankingSeasonConfig(CURRENT_SEASON);

const PERIOD_DEFINITIONS = [
  {
    key: "daily",
    label: "오늘",
    cardLabel: "일간",
    days: 1,
    dayOffset: 0
  },
  {
    key: "weekly",
    label: "최근 7일",
    cardLabel: "주간",
    days: 7,
    dayOffset: 6
  },
  {
    key: "monthly",
    label: "최근 30일",
    cardLabel: "월간",
    days: 30,
    dayOffset: 29
  }
];

const PHASE_LABELS = {
  ready: "대기",
  loading: "로딩",
  playing: "플레이 중",
  submitting: "기록 제출",
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
  chartTooltip: document.getElementById("chartTooltip")
};

const adminAccessConfig = getAdminAccessConfig();

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

function getAuthInstance() {
  const config = getFirebaseRuntimeConfig();
  if (!hasFirebaseConfig(config)) {
    throw new Error("Firebase config missing");
  }

  const app = getApps().length ? getApp() : initializeApp(config);
  return getAuth(app);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
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

function renderAccessGate({ title, body }) {
  document.body.innerHTML = `
    <main class="admin-shell">
      <section class="panel-card admin-access-card">
        <div class="panel-head">
          <h2>${escapeHtml(title)}</h2>
        </div>
        <p class="admin-access-copy">${escapeHtml(body)}</p>
        <div class="admin-access-actions">
          <a class="refresh-button" href="/">Open Game</a>
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

  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(getAuthInstance(), (user) => {
      unsubscribe();

      if (!user?.uid) {
        renderAccessGate({
          title: "Admin sign-in required",
          body: "Sign in with an admin account in the main game first, then reopen this page."
        });
        reject(new Error("Admin login required."));
        return;
      }

      if (!isAuthorizedAdmin(user)) {
        renderAccessGate({
          title: "Access denied",
          body: adminAccessConfig.allowedEmails.length
            ? `The signed-in account (${normalizeEmail(user.email)}) is not in the admin allowlist.`
            : "Set ADMIN_ALLOWED_EMAILS on the app server, then sign in again."
        });
        reject(new Error("Admin allowlist rejected the current user."));
        return;
      }

      resolve(user);
    }, (error) => {
      unsubscribe();
      reject(error);
    });
  });
}

function normalizeName(name) {
  return Array.from(String(name || "").trim().replace(/\s+/g, " ")).slice(0, 12).join("");
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
  return `${hours}시간 전`;
}

function compareRankings(left, right) {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  return String(left.submittedAt).localeCompare(String(right.submittedAt));
}

function renderEmptyRow(tbody, columns, message) {
  tbody.innerHTML = `<tr class="empty-row"><td colspan="${columns}">${escapeHtml(message)}</td></tr>`;
}

function renderRankings(rankings) {
  if (!rankings.length) {
    renderEmptyRow(elements.rankingTableBody, 4, "아직 저장된 랭킹이 없어요.");
    return;
  }

  elements.rankingTableBody.innerHTML = rankings.map((entry, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(entry.name)}</td>
      <td>${formatNumber(entry.score)}</td>
      <td>${formatDateTime(entry.submittedAt)}</td>
    </tr>
  `).join("");
}

function renderPresence(entries) {
  if (!entries.length) {
    renderEmptyRow(elements.presenceTableBody, 3, "현재 접속 중인 플레이어가 없어요.");
    return;
  }

  elements.presenceTableBody.innerHTML = entries.map((entry) => `
    <tr>
      <td>${escapeHtml(entry.nickname || "이름 없음")}</td>
      <td><span class="phase-pill">${escapeHtml(PHASE_LABELS[entry.phase] || entry.phase)}</span></td>
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
  metaElement.textContent = `총 ${formatNumber(stats.totalSessions)}세션`;
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
  let latestVisit = "";

  const matchedEntries = sessionEntries.filter((entry) => {
    const startedAt = new Date(entry.startedAt).getTime();
    return !Number.isNaN(startedAt) && startedAt >= startTime;
  });

  matchedEntries.forEach((entry) => {
    if (entry.playerId) {
      uniquePlayers.add(entry.playerId);
    }

    if (!latestVisit || entry.startedAt > latestVisit) {
      latestVisit = entry.startedAt;
    }
  });

  return {
    key: definition.key,
    label: definition.label,
    cardLabel: definition.cardLabel,
    uniquePlayers: uniquePlayers.size,
    totalSessions: matchedEntries.length,
    averageSessionsPerDay: matchedEntries.length / definition.days,
    latestVisit
  };
}

function buildDailyStats(sessionEntries) {
  const dayKeys = buildRecentDayKeys(ANALYTICS_WINDOW_DAYS);
  const dailyStats = new Map(dayKeys.map((dayKey) => [dayKey, {
    dayKey,
    totalSessions: 0,
    uniquePlayers: new Set(),
    latestVisit: ""
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

    if (!bucket.latestVisit || entry.startedAt > bucket.latestVisit) {
      bucket.latestVisit = entry.startedAt;
    }
  });

  return dayKeys.map((dayKey) => {
    const bucket = dailyStats.get(dayKey);
    return {
      dayKey,
      totalSessions: bucket.totalSessions,
      uniquePlayers: bucket.uniquePlayers.size,
      latestVisit: bucket.latestVisit
    };
  });
}

// --- Chart ---

let barHitAreas = [];

function setupChartTooltip() {
  const canvas = elements.trendChart;
  const tooltip = elements.chartTooltip;
  if (!canvas || !tooltip) return;

  canvas.addEventListener("mousemove", (event) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const hit = barHitAreas.find(
      (area) => mouseX >= area.x && mouseX < area.x + area.w &&
                mouseY >= area.hitTop && mouseY < area.hitBottom
    );

    if (hit) {
      tooltip.innerHTML =
        `<strong>${hit.entry.dayKey}</strong><br>` +
        `방문자 ${formatNumber(hit.entry.uniquePlayers)}명 · 세션 ${formatNumber(hit.entry.totalSessions)}`;

      const centerX = hit.x + hit.w / 2;
      const fromRight = centerX > rect.width / 2;
      tooltip.style.left = fromRight ? "auto" : `${Math.max(4, hit.x)}px`;
      tooltip.style.right = fromRight ? `${Math.max(4, rect.width - hit.x - hit.w)}px` : "auto";
      tooltip.style.top = `${Math.max(36, hit.barY)}px`;
      tooltip.classList.add("visible");
    } else {
      tooltip.classList.remove("visible");
    }
  });

  canvas.addEventListener("mouseleave", () => {
    tooltip.classList.remove("visible");
  });
}

function renderTrendChart(dailyStats) {
  const canvas = elements.trendChart;
  if (!canvas) return;

  // oldest → newest (left to right)
  const data = [...dailyStats].reverse();

  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth;
  const H = canvas.offsetHeight;
  if (!W || !H) return;

  canvas.width = W * dpr;
  canvas.height = H * dpr;

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const PAD = { top: 20, right: 12, bottom: 36, left: 38 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...data.map((d) => d.uniquePlayers), 1);

  // Y gridlines + labels
  const ySteps = 4;
  for (let i = 0; i <= ySteps; i++) {
    const y = PAD.top + chartH * (1 - i / ySteps);

    ctx.strokeStyle = "rgba(165, 119, 82, 0.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + chartW, y);
    ctx.stroke();

    if (i > 0) {
      ctx.fillStyle = "rgba(122, 94, 79, 0.65)";
      ctx.font = '11px "Noto Sans KR", sans-serif';
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(Math.round((i / ySteps) * maxVal), PAD.left - 6, y);
    }
  }

  const barCount = data.length;
  const gap = 2;
  const barW = Math.max(3, (chartW - gap * (barCount - 1)) / barCount);

  barHitAreas = [];

  data.forEach((entry, i) => {
    const x = PAD.left + i * (barW + gap);
    const barH = (entry.uniquePlayers / maxVal) * chartH;
    const barY = PAD.top + chartH - barH;

    barHitAreas.push({
      x,
      w: barW + gap,
      barY,
      hitTop: PAD.top,
      hitBottom: PAD.top + chartH,
      entry
    });

    if (barH > 1) {
      const grad = ctx.createLinearGradient(0, barY, 0, PAD.top + chartH);
      grad.addColorStop(0, "#ffb277");
      grad.addColorStop(1, "#d96f2b");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, barY, barW, barH, [3, 3, 0, 0]);
      ctx.fill();
    } else {
      ctx.fillStyle = "rgba(217, 111, 43, 0.2)";
      ctx.fillRect(x, PAD.top + chartH - 2, barW, 2);
    }

    // X labels every 5 days
    if (i % 5 === 0) {
      ctx.fillStyle = "rgba(122, 94, 79, 0.65)";
      ctx.font = '10px "Noto Sans KR", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(entry.dayKey.slice(5), x + barW / 2, PAD.top + chartH + 8);
    }
  });
}

// --- Analytics ---

function renderAnalytics(sessionEntries) {
  const periodStats = PERIOD_DEFINITIONS.map((definition) => buildPeriodStats(sessionEntries, definition));
  const dailyStats = buildDailyStats(sessionEntries);

  periodStats.forEach((stats) => setTrafficCard(stats.key, stats));
  renderTrendChart(dailyStats);
  elements.trendChartStatus.textContent = sessionEntries.length
    ? `최근 30일 ${formatNumber(sessionEntries.length)}세션 기준`
    : "배포 후 새 접속부터 집계됩니다.";
}

function applyRankingFailure() {
  renderEmptyRow(elements.rankingTableBody, 4, "랭킹을 불러오지 못했어요.");
  elements.rankingCount.textContent = "-";
  elements.rankingStatus.textContent = "불러오기 실패";
}

function applyPresenceFailure() {
  renderEmptyRow(elements.presenceTableBody, 3, "접속자 정보를 불러오지 못했어요.");
  elements.activeCount.textContent = "-";
  elements.presenceStatus.textContent = "불러오기 실패";
}

function applyAnalyticsFailure() {
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
        name: normalizeName(data.name),
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
      nickname: normalizeName(data.nickname) || "플레이어",
      phase: String(data.phase || "ready"),
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
    renderRankings(rankings);
    elements.rankingCount.textContent = formatNumber(rankings.length);
    elements.rankingStatus.textContent = `${CURRENT_SEASON_META.displayName} / ${formatNumber(rankings.length)}명 기록`;
  } else {
    console.error(rankingsResult.reason);
    applyRankingFailure();
  }

  if (presenceResult.status === "fulfilled") {
    const activeEntries = presenceResult.value;
    renderPresence(activeEntries);
    elements.activeCount.textContent = formatNumber(activeEntries.length);
    elements.presenceStatus.textContent = activeEntries.length ? "실시간 추정치" : "현재 0명";
  } else {
    console.error(presenceResult.reason);
    applyPresenceFailure();
  }

  if (sessionsResult.status === "fulfilled") {
    renderAnalytics(sessionsResult.value);
  } else {
    console.error(sessionsResult.reason);
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

  setupChartTooltip();

  elements.refreshButton.addEventListener("click", () => {
    void refreshAdminData();
  });

  await refreshAdminData();
  window.setInterval(() => {
    void refreshAdminData();
  }, REFRESH_INTERVAL_MS);
}

void bootstrapAdminDashboard();
