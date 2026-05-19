import { initAuth } from "../game/auth.js";
import {
  getAdminAccessConfig,
  getAvailableContentSeasons,
  getContentSeasonConfig
} from "../game/config/runtime.js";

const PLAYTEST_MESSAGE_SOURCE = "admin-playtest";
const PLAYTEST_STATUS_SOURCE = "game-playtest";
const PLAYTEST_BRIDGE_KEY = "__KAGUYA_PLAYTEST__";
const STATUS_REQUEST_INTERVAL_MS = 1000;
const DEFAULT_CONTENT_SEASON = getAvailableContentSeasons().find((season) => season.id === "s2")?.id
  || getContentSeasonConfig().id
  || "s2";

const PRESETS = Object.freeze({
  boss7000: Object.freeze({ score: 7000, round: 4, timeLeft: 55, health: 6 }),
  boss8000: Object.freeze({ score: 8000, round: 4, timeLeft: 50, health: 5 }),
  boss9000: Object.freeze({ score: 9000, round: 4, timeLeft: 45, health: 4 })
});

const elements = {
  contentSeasonSelect: document.getElementById("contentSeasonSelect"),
  reloadPlaytestButton: document.getElementById("reloadPlaytestButton"),
  openStandaloneButton: document.getElementById("openStandaloneButton"),
  playtestConnectionStatus: document.getElementById("playtestConnectionStatus"),
  playtestLobbyButton: document.getElementById("playtestLobbyButton"),
  playtestStartButton: document.getElementById("playtestStartButton"),
  preset7000Button: document.getElementById("preset7000Button"),
  preset8000Button: document.getElementById("preset8000Button"),
  preset9000Button: document.getElementById("preset9000Button"),
  plusScoreButton: document.getElementById("plusScoreButton"),
  plusTimeButton: document.getElementById("plusTimeButton"),
  healHpButton: document.getElementById("healHpButton"),
  spawnIrohaButton: document.getElementById("spawnIrohaButton"),
  spawnFullMoonButton: document.getElementById("spawnFullMoonButton"),
  spawnHealButton: document.getElementById("spawnHealButton"),
  spawnZ1Button: document.getElementById("spawnZ1Button"),
  spawnZ2Button: document.getElementById("spawnZ2Button"),
  spawnZ3Button: document.getElementById("spawnZ3Button"),
  playtestFrame: document.getElementById("playtestFrame"),
  statusScreen: document.getElementById("statusScreen"),
  statusPhase: document.getElementById("statusPhase"),
  statusScore: document.getElementById("statusScore"),
  statusRound: document.getElementById("statusRound"),
  statusTime: document.getElementById("statusTime"),
  statusHealth: document.getElementById("statusHealth")
};

const controlButtons = [
  elements.playtestLobbyButton,
  elements.playtestStartButton,
  elements.preset7000Button,
  elements.preset8000Button,
  elements.preset9000Button,
  elements.plusScoreButton,
  elements.plusTimeButton,
  elements.healHpButton,
  elements.spawnIrohaButton,
  elements.spawnFullMoonButton,
  elements.spawnHealButton,
  elements.spawnZ1Button,
  elements.spawnZ2Button,
  elements.spawnZ3Button
].filter(Boolean);

const state = {
  connected: false,
  contentSeason: DEFAULT_CONTENT_SEASON,
  pendingCommand: null
};

const adminAccessConfig = getAdminAccessConfig();
let statusRequestTimer = 0;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function canBypassAdminAllowlist() {
  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

function canUseLocalAdminBypass() {
  return canBypassAdminAllowlist() && !adminAccessConfig.allowedEmails.length;
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
  if (canUseLocalAdminBypass()) {
    return null;
  }

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

function getFrameUrl() {
  const url = getGameEntryUrl();
  url.searchParams.set("playtest", "1");
  url.searchParams.set("contentSeason", state.contentSeason);
  return url.toString();
}

function setConnectionStatus(text) {
  if (elements.playtestConnectionStatus) {
    elements.playtestConnectionStatus.textContent = text;
  }
}

function setControlsEnabled(enabled) {
  controlButtons.forEach((button) => {
    button.disabled = !enabled;
  });
}

function getPlaytestBridge() {
  try {
    return elements.playtestFrame?.contentWindow?.[PLAYTEST_BRIDGE_KEY] || null;
  } catch {
    return null;
  }
}

function applyConnectedStatus(payload = {}) {
  state.connected = true;
  stopStatusPolling();
  setControlsEnabled(true);
  updateStatusBoard(payload);
  setConnectionStatus(`${String(payload?.contentSeasonId || state.contentSeason).toUpperCase()} connected`);
}

function stopStatusPolling() {
  if (!statusRequestTimer) {
    return;
  }

  window.clearInterval(statusRequestTimer);
  statusRequestTimer = 0;
}

function postPlaytestMessage(type, payload = {}) {
  if (!elements.playtestFrame?.contentWindow) {
    return false;
  }

  elements.playtestFrame.contentWindow.postMessage({
    source: PLAYTEST_MESSAGE_SOURCE,
    type,
    payload
  }, window.location.origin);
  return true;
}

function requestPlaytestStatus() {
  const playtestBridge = getPlaytestBridge();
  if (playtestBridge?.getStatus) {
    applyConnectedStatus(playtestBridge.getStatus());
    return true;
  }

  return postPlaytestMessage("playtest:status-request");
}

function startStatusPolling() {
  stopStatusPolling();
  requestPlaytestStatus();
  statusRequestTimer = window.setInterval(() => {
    requestPlaytestStatus();
  }, STATUS_REQUEST_INTERVAL_MS);
}

function populateContentSeasonOptions() {
  const seasons = getAvailableContentSeasons();
  elements.contentSeasonSelect.innerHTML = seasons.map((season) => `
    <option value="${escapeHtml(season.id)}">${escapeHtml(season.displayName)} (${escapeHtml(season.id)})</option>
  `).join("");
  elements.contentSeasonSelect.value = state.contentSeason;
}

function resetStatusBoard() {
  elements.statusScreen.textContent = "-";
  elements.statusPhase.textContent = "-";
  elements.statusScore.textContent = "0";
  elements.statusRound.textContent = "1";
  elements.statusTime.textContent = "0s";
  elements.statusHealth.textContent = "0 / 0";
}

function updateStatusBoard(payload = {}) {
  elements.statusScreen.textContent = payload.screen || "-";
  elements.statusPhase.textContent = payload.phase || "-";
  elements.statusScore.textContent = Number.isFinite(payload.score) ? payload.score.toLocaleString("ko-KR") : "0";
  elements.statusRound.textContent = Number.isFinite(payload.round) ? String(payload.round) : "1";
  elements.statusTime.textContent = Number.isFinite(payload.timeLeft) ? `${payload.timeLeft}s` : "0s";

  const health = Number.isFinite(payload.health) ? payload.health : 0;
  const maxHealth = Number.isFinite(payload.maxHealth) ? payload.maxHealth : 0;
  elements.statusHealth.textContent = `${health} / ${maxHealth}`;
}

function reloadPlaytestFrame() {
  state.connected = false;
  state.pendingCommand = null;
  resetStatusBoard();
  setConnectionStatus(`${state.contentSeason.toUpperCase()} playtest loading...`);
  startStatusPolling();
  elements.playtestFrame.src = getFrameUrl();
}

function flushPendingCommand() {
  if (!state.connected || !state.pendingCommand) {
    return;
  }

  const pendingCommand = state.pendingCommand;
  state.pendingCommand = null;
  postPlaytestMessage(pendingCommand.type, pendingCommand.payload);
}

function sendPlaytestCommand(type, payload = {}) {
  const playtestBridge = getPlaytestBridge();
  if (playtestBridge) {
    switch (type) {
      case "playtest:go-lobby":
        if (playtestBridge.goLobby) {
          applyConnectedStatus(playtestBridge.goLobby(payload));
          return;
        }
        break;
      case "playtest:start":
        if (playtestBridge.start) {
          applyConnectedStatus(playtestBridge.start(payload));
          return;
        }
        break;
      case "playtest:preset":
        if (playtestBridge.preset) {
          applyConnectedStatus(playtestBridge.preset(payload));
          return;
        }
        break;
      case "playtest:adjust":
        if (playtestBridge.adjust) {
          applyConnectedStatus(playtestBridge.adjust(payload));
          return;
        }
        break;
      case "playtest:spawn":
        if (playtestBridge.spawn) {
          const result = playtestBridge.spawn(payload) || {};
          applyConnectedStatus(result.status || playtestBridge.getStatus?.() || {});
          return;
        }
        break;
      default:
        break;
    }
  }

  if (!state.connected) {
    state.pendingCommand = { type, payload };
    setConnectionStatus(`${state.contentSeason.toUpperCase()} waiting for game connection...`);
    startStatusPolling();
    return;
  }

  postPlaytestMessage(type, payload);
}

function bindControls() {
  elements.contentSeasonSelect.addEventListener("change", () => {
    state.contentSeason = String(elements.contentSeasonSelect.value || DEFAULT_CONTENT_SEASON);
    reloadPlaytestFrame();
  });

  elements.reloadPlaytestButton.addEventListener("click", () => {
    reloadPlaytestFrame();
  });

  elements.openStandaloneButton.addEventListener("click", () => {
    window.open(getFrameUrl(), "_blank", "noopener");
  });

  elements.playtestLobbyButton.addEventListener("click", () => {
    sendPlaytestCommand("playtest:go-lobby");
  });

  elements.playtestStartButton.addEventListener("click", () => {
    sendPlaytestCommand("playtest:start");
  });

  elements.preset7000Button.addEventListener("click", () => {
    sendPlaytestCommand("playtest:preset", PRESETS.boss7000);
  });

  elements.preset8000Button.addEventListener("click", () => {
    sendPlaytestCommand("playtest:preset", PRESETS.boss8000);
  });

  elements.preset9000Button.addEventListener("click", () => {
    sendPlaytestCommand("playtest:preset", PRESETS.boss9000);
  });

  elements.plusScoreButton.addEventListener("click", () => {
    sendPlaytestCommand("playtest:adjust", { scoreDelta: 1000 });
  });

  elements.plusTimeButton.addEventListener("click", () => {
    sendPlaytestCommand("playtest:adjust", { timeDelta: 10 });
  });

  elements.healHpButton.addEventListener("click", () => {
    sendPlaytestCommand("playtest:adjust", { healthDelta: 1 });
  });

  elements.spawnIrohaButton.addEventListener("click", () => {
    sendPlaytestCommand("playtest:spawn", { key: "iroha" });
  });

  elements.spawnFullMoonButton.addEventListener("click", () => {
    sendPlaytestCommand("playtest:spawn", { key: "special1" });
  });

  elements.spawnHealButton.addEventListener("click", () => {
    sendPlaytestCommand("playtest:spawn", { key: "heal1" });
  });

  elements.spawnZ1Button.addEventListener("click", () => {
    sendPlaytestCommand("playtest:spawn", { key: "z1" });
  });

  elements.spawnZ2Button.addEventListener("click", () => {
    sendPlaytestCommand("playtest:spawn", { key: "z2" });
  });

  elements.spawnZ3Button.addEventListener("click", () => {
    sendPlaytestCommand("playtest:spawn", { key: "z3" });
  });

  elements.playtestFrame.addEventListener("load", () => {
    state.connected = false;
    setConnectionStatus(`${state.contentSeason.toUpperCase()} connecting to game...`);
    window.setTimeout(() => {
      startStatusPolling();
    }, 300);
  });

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) {
      return;
    }

    const message = event.data;
    if (!message || message.source !== PLAYTEST_STATUS_SOURCE || message.type !== "playtest:status") {
      return;
    }

    applyConnectedStatus(message.payload || {});
    flushPendingCommand();
  });
}

async function bootstrapPlaytestPage() {
  try {
    await requireAuthorizedAdmin();
  } catch {
    return;
  }

  populateContentSeasonOptions();
  bindControls();
  setControlsEnabled(true);
  resetStatusBoard();
  reloadPlaytestFrame();
}

void bootstrapPlaytestPage();
