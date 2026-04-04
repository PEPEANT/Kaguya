import { getCurrentAuthIdToken, initAuth } from "../game/auth.js";
import {
  getAdminAccessConfig,
  getAvailableRankingSeasons,
  getCurrentRankingSeason,
  getRankingSeasonConfig
} from "../game/config/runtime.js";

const CURRENT_SEASON = getCurrentRankingSeason();
const RANKING_SEASONS = getAvailableRankingSeasons().sort((left, right) => right.id - left.id);
const adminAccessConfig = getAdminAccessConfig();
const DEFAULT_APP_SERVER_ORIGIN = "http://localhost:3000";
const DEFAULT_PAYOUT_MESSAGE_TITLE = "{seasonLabel} 보상 지급 안내";
const DEFAULT_PAYOUT_MESSAGE_BODY = "축하합니다. {seasonLabel} 최종 순위 {rank}위 보상으로 {rewardAmount} HujuPay를 지급했습니다.";

const state = {
  previewResult: null,
  selectedPlayerIds: new Set(),
  targetUidByPlayerId: new Map(),
  applyInFlight: false
};

const elements = {
  payoutRefreshButton: document.getElementById("payoutRefreshButton"),
  payoutSeason: document.getElementById("payoutSeason"),
  payoutLimit: document.getElementById("payoutLimit"),
  payoutStatus: document.getElementById("payoutStatus"),
  previewLoadButton: document.getElementById("previewLoadButton"),
  previewSelectReadyButton: document.getElementById("previewSelectReadyButton"),
  previewClearSelectionButton: document.getElementById("previewClearSelectionButton"),
  previewApplySelectedButton: document.getElementById("previewApplySelectedButton"),
  previewApplyStatus: document.getElementById("previewApplyStatus"),
  payoutMessageTitle: document.getElementById("payoutMessageTitle"),
  payoutMessageBody: document.getElementById("payoutMessageBody"),
  payoutMessageResetButton: document.getElementById("payoutMessageResetButton"),
  payoutMessagePreviewMeta: document.getElementById("payoutMessagePreviewMeta"),
  payoutMessagePreviewTitle: document.getElementById("payoutMessagePreviewTitle"),
  payoutMessagePreviewBody: document.getElementById("payoutMessagePreviewBody"),
  previewCandidateCount: document.getElementById("previewCandidateCount"),
  previewReadyCount: document.getElementById("previewReadyCount"),
  previewSelectedCount: document.getElementById("previewSelectedCount"),
  previewIssueCount: document.getElementById("previewIssueCount"),
  previewResultMeta: document.getElementById("previewResultMeta"),
  previewTableBody: document.getElementById("previewTableBody"),
  payoutLoadButton: document.getElementById("payoutLoadButton"),
  payoutRecipientCount: document.getElementById("payoutRecipientCount"),
  payoutRewardTotal: document.getElementById("payoutRewardTotal"),
  payoutLastRewardedAt: document.getElementById("payoutLastRewardedAt"),
  payoutResultMeta: document.getElementById("payoutResultMeta"),
  payoutTableBody: document.getElementById("payoutTableBody")
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char] || char));
}

function formatText(value, fallback = "-") {
  const safeValue = String(value ?? "").trim();
  return safeValue || fallback;
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
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

function renderTemplate(template, context = {}) {
  return String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_, token) => {
    const resolved = context[token];
    return resolved === undefined || resolved === null ? `{${token}}` : String(resolved);
  });
}

function getPayoutMessageTitleTemplate() {
  return String(elements.payoutMessageTitle?.value || "").trim() || DEFAULT_PAYOUT_MESSAGE_TITLE;
}

function getPayoutMessageBodyTemplate() {
  return String(elements.payoutMessageBody?.value || "").trim() || DEFAULT_PAYOUT_MESSAGE_BODY;
}

function setInlineStatus(element, text, tone = "info") {
  if (!element) {
    return;
  }

  element.textContent = formatText(text, "");
  element.dataset.tone = tone;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeId(value) {
  return String(value || "").trim();
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

function getGameEntryUrl() {
  return new URL("/", window.location.origin).toString();
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
          <a class="refresh-button" href="${escapeHtml(getGameEntryUrl())}">게임 열기</a>
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
      body: "먼저 메인 게임에서 관리자 계정으로 로그인한 뒤 이 페이지를 다시 열어주세요."
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

function populateSeasonSelect() {
  elements.payoutSeason.innerHTML = RANKING_SEASONS.map((seasonConfig) => `
    <option value="${seasonConfig.id}">
      ${escapeHtml(seasonConfig.displayName)}${seasonConfig.period ? ` (${escapeHtml(seasonConfig.period)})` : ""}
    </option>
  `).join("");
  elements.payoutSeason.value = String(CURRENT_SEASON);
}

function getSelectedSeason() {
  const season = Number.parseInt(String(elements.payoutSeason.value || ""), 10);
  return Number.isInteger(season) && season >= 1 ? season : CURRENT_SEASON;
}

function getSelectedSeasonLabel() {
  return getRankingSeasonConfig(getSelectedSeason()).displayName;
}

function readLimit() {
  const limit = Math.floor(Number(elements.payoutLimit.value) || 0);
  return Number.isFinite(limit) && limit >= 0 ? limit : 0;
}

function getPreviewEntries() {
  return Array.isArray(state.previewResult?.entries) ? state.previewResult.entries : [];
}

function getTargetUidOverride(playerId) {
  return state.targetUidByPlayerId.get(normalizeId(playerId)) || "";
}

function setTargetUidOverride(playerId, uid) {
  const safePlayerId = normalizeId(playerId);
  const safeUid = normalizeId(uid);

  if (!safePlayerId) {
    return;
  }

  if (safeUid) {
    state.targetUidByPlayerId.set(safePlayerId, safeUid);
  } else {
    state.targetUidByPlayerId.delete(safePlayerId);
  }
}

function getEffectiveUid(entry) {
  return normalizeId(entry?.uid) || getTargetUidOverride(entry?.playerId);
}

function isAlreadyPaidEntry(entry) {
  return normalizeId(entry?.status) === "skipped-existing-message";
}

function isMissingUidEntry(entry) {
  return normalizeId(entry?.status) === "skipped-missing-uid";
}

function isFailedEntry(entry) {
  return normalizeId(entry?.status) === "failed";
}

function isSelectableEntry(entry) {
  const status = normalizeId(entry?.status);
  if (!normalizeId(entry?.playerId)) {
    return false;
  }

  if (status === "preview" || status === "paid") {
    return Boolean(getEffectiveUid(entry));
  }

  if (status === "skipped-missing-uid") {
    return Boolean(getTargetUidOverride(entry.playerId));
  }

  return false;
}

function getSelectedPreviewEntries() {
  return getPreviewEntries().filter((entry) => state.selectedPlayerIds.has(normalizeId(entry.playerId)) && isSelectableEntry(entry));
}

function getPayoutPreviewSampleEntry() {
  const selectedEntries = getSelectedPreviewEntries();
  if (selectedEntries.length) {
    return selectedEntries[0];
  }

  const previewEntries = getPreviewEntries();
  return previewEntries.find((entry) => isSelectableEntry(entry)) || previewEntries[0] || null;
}

function buildPayoutPreviewContext(entry) {
  return {
    nickname: formatText(entry?.name, "플레이어"),
    seasonLabel: getSelectedSeasonLabel(),
    rank: formatNumber(Number(entry?.rank) || 0),
    rewardAmount: formatNumber(Number(entry?.rewardAmount) || 0)
  };
}

function renderPayoutMessagePreview() {
  if (!elements.payoutMessagePreviewTitle || !elements.payoutMessagePreviewBody || !elements.payoutMessagePreviewMeta) {
    return;
  }

  const sampleEntry = getPayoutPreviewSampleEntry();
  const previewContext = sampleEntry
    ? buildPayoutPreviewContext(sampleEntry)
    : {
      nickname: "플레이어",
      seasonLabel: getSelectedSeasonLabel(),
      rank: "-",
      rewardAmount: "-"
    };

  elements.payoutMessagePreviewTitle.textContent = renderTemplate(getPayoutMessageTitleTemplate(), previewContext);
  elements.payoutMessagePreviewBody.textContent = renderTemplate(getPayoutMessageBodyTemplate(), previewContext);

  if (!sampleEntry) {
    elements.payoutMessagePreviewMeta.textContent = "대상 미리보기를 불러오면 선택된 플레이어 기준으로 실제 지급 메시지를 확인할 수 있습니다.";
    return;
  }

  elements.payoutMessagePreviewMeta.textContent = `샘플 대상: ${formatText(sampleEntry.name)} / ${formatNumber(Number(sampleEntry.rank) || 0)}위 / ${formatNumber(Number(sampleEntry.rewardAmount) || 0)} HujuPay`;
}

function pruneSelectedPlayerIds() {
  const selectableIds = new Set(
    getPreviewEntries()
      .filter((entry) => isSelectableEntry(entry))
      .map((entry) => normalizeId(entry.playerId))
  );

  [...state.selectedPlayerIds].forEach((playerId) => {
    if (!selectableIds.has(playerId)) {
      state.selectedPlayerIds.delete(playerId);
    }
  });
}

function getPreviewStatusDescriptor(entry) {
  const status = normalizeId(entry?.status);

  if (status === "preview" || status === "paid") {
    return {
      label: status === "paid" ? "지급 완료" : "지급 가능",
      tone: "success",
      detail: getEffectiveUid(entry) ? `uid ${getEffectiveUid(entry)}` : ""
    };
  }

  if (status === "skipped-existing-message") {
    return {
      label: "이미 지급됨",
      tone: "muted",
      detail: "보상 메시지가 이미 존재합니다."
    };
  }

  if (status === "skipped-missing-uid") {
    const overrideUid = getTargetUidOverride(entry?.playerId);
    return overrideUid
      ? {
        label: "수동 uid 준비",
        tone: "warning",
        detail: `입력한 uid ${overrideUid}로 선택 지급됩니다.`
      }
      : {
        label: "uid 필요",
        tone: "warning",
        detail: "이 행만 uid를 입력한 뒤 선택하세요."
      };
  }

  if (status === "failed") {
    return {
      label: "미리보기 실패",
      tone: "error",
      detail: formatText(entry?.error, "원인을 확인해주세요.")
    };
  }

  return {
    label: formatText(status, "확인 필요"),
    tone: "muted",
    detail: ""
  };
}

function renderPreviewEmptyRow(message) {
  elements.previewTableBody.innerHTML = `
    <tr class="empty-row">
      <td colspan="8">${escapeHtml(message)}</td>
    </tr>
  `;
  renderPayoutMessagePreview();
}

function renderReportEmptyRow(message) {
  elements.payoutTableBody.innerHTML = `
    <tr class="empty-row">
      <td colspan="7">${escapeHtml(message)}</td>
    </tr>
  `;
}

function applyPreviewSummary() {
  const entries = getPreviewEntries();
  const selectableEntries = entries.filter((entry) => isSelectableEntry(entry));
  const selectedEntries = getSelectedPreviewEntries();
  const actionableIssueCount = entries.filter((entry) => !isAlreadyPaidEntry(entry) && !isSelectableEntry(entry)).length;
  const alreadyPaidCount = entries.filter((entry) => isAlreadyPaidEntry(entry)).length;
  const selectedRewardTotal = selectedEntries.reduce((sum, entry) => sum + (Number(entry.rewardAmount) || 0), 0);

  elements.previewCandidateCount.textContent = formatNumber(entries.length);
  elements.previewReadyCount.textContent = formatNumber(selectableEntries.length);
  elements.previewSelectedCount.textContent = formatNumber(selectedEntries.length);
  elements.previewIssueCount.textContent = formatNumber(actionableIssueCount);

  if (!entries.length) {
    elements.previewResultMeta.textContent = "아직 미리보기를 실행하지 않았습니다.";
    return;
  }

  elements.previewResultMeta.textContent = [
    `${formatText(state.previewResult?.seasonLabel)} 대상 ${formatNumber(entries.length)}명`,
    `즉시 지급 ${formatNumber(selectableEntries.length)}명`,
    `이미 지급 ${formatNumber(alreadyPaidCount)}명`,
    `선택 보상 ${formatNumber(selectedRewardTotal)} H`
  ].join(" / ");
}

function renderPreviewRows() {
  const entries = getPreviewEntries();
  if (!entries.length) {
    renderPreviewEmptyRow("미리보기 결과가 없습니다.");
    updateActionButtons();
    return;
  }

  elements.previewTableBody.innerHTML = entries.map((entry) => {
    const playerId = normalizeId(entry.playerId);
    const checked = state.selectedPlayerIds.has(playerId);
    const selectable = isSelectableEntry(entry);
    const status = getPreviewStatusDescriptor(entry);
    const overrideUid = getTargetUidOverride(playerId);
    const effectiveUid = getEffectiveUid(entry);
    const uidCellHtml = normalizeId(entry.uid)
      ? `<div class="payout-uid-value">${escapeHtml(entry.uid)}</div>`
      : `
        <input
          class="payout-uid-input"
          data-role="target-uid"
          data-player-id="${escapeHtml(playerId)}"
          type="text"
          placeholder="uid 수동 입력"
          value="${escapeHtml(overrideUid)}"
        >
      `;

    return `
      <tr class="${checked ? "payout-row-selected" : ""}">
        <td>
          <input
            class="payout-row-checkbox"
            data-role="select-row"
            data-player-id="${escapeHtml(playerId)}"
            type="checkbox"
            ${checked ? "checked" : ""}
            ${selectable ? "" : "disabled"}
          >
        </td>
        <td>#${escapeHtml(formatNumber(Number(entry.rank) || 0))}</td>
        <td>${escapeHtml(formatText(entry.name, "이름 없음"))}</td>
        <td>${escapeHtml(formatNumber(Number(entry.rewardAmount) || 0))} HujuPay</td>
        <td>${escapeHtml(formatNumber(Number(entry.score) || 0))}</td>
        <td>${escapeHtml(formatText(playerId))}</td>
        <td>
          ${uidCellHtml}
          ${effectiveUid && !normalizeId(entry.uid) ? `<span class="payout-row-note">지정 uid: ${escapeHtml(effectiveUid)}</span>` : ""}
        </td>
        <td>
          <span class="status-pill" data-tone="${escapeHtml(status.tone)}">${escapeHtml(status.label)}</span>
          ${status.detail ? `<span class="payout-row-note">${escapeHtml(status.detail)}</span>` : ""}
          ${isFailedEntry(entry) ? `<span class="payout-row-note">${escapeHtml(formatText(entry.error, "지급 전에 다시 확인해주세요."))}</span>` : ""}
        </td>
      </tr>
    `;
  }).join("");

  renderPayoutMessagePreview();
  updateActionButtons();
}

function renderPayoutRows(recipients) {
  if (!Array.isArray(recipients) || !recipients.length) {
    renderReportEmptyRow("아직 지급 완료된 내역이 없습니다.");
    return;
  }

  elements.payoutTableBody.innerHTML = recipients.map((entry) => `
    <tr>
      <td>${escapeHtml(formatDateTime(entry.rewardedAt))}</td>
      <td>${escapeHtml(formatText(entry.nickname, "이름 없음"))}</td>
      <td>#${escapeHtml(formatNumber(Number(entry.rank) || 0))}</td>
      <td>${escapeHtml(formatNumber(Number(entry.rewardAmount) || 0))} HujuPay</td>
      <td>${escapeHtml(formatNumber(Number(entry.score) || 0))}</td>
      <td>${escapeHtml(formatText(entry.uid))}</td>
      <td>${escapeHtml(formatText(entry.playerId))}</td>
    </tr>
  `).join("");
}

function applyReportSummary(result) {
  elements.payoutRecipientCount.textContent = formatNumber(result.totalRecipients);
  elements.payoutRewardTotal.textContent = `${formatNumber(result.totalRewardedAmount)} H`;
  elements.payoutLastRewardedAt.textContent = formatDateTime(result.lastRewardedAt);
  elements.payoutResultMeta.textContent = `${formatText(result.seasonLabel)} 기준 ${formatNumber(result.totalRecipients)}명 지급 완료`;
}

function updateActionButtons() {
  const previewEntries = getPreviewEntries();
  const selectedEntries = getSelectedPreviewEntries();
  const selectableCount = previewEntries.filter((entry) => isSelectableEntry(entry)).length;

  elements.previewSelectReadyButton.disabled = !previewEntries.length || !selectableCount || state.applyInFlight;
  elements.previewClearSelectionButton.disabled = !state.selectedPlayerIds.size || state.applyInFlight;
  elements.previewApplySelectedButton.disabled = !selectedEntries.length || state.applyInFlight;
  elements.previewLoadButton.disabled = state.applyInFlight;
  elements.payoutLoadButton.disabled = state.applyInFlight;
  elements.payoutRefreshButton.disabled = state.applyInFlight;
}

async function refreshPreview() {
  const season = getSelectedSeason();
  const seasonLabel = getSelectedSeasonLabel();
  const limit = readLimit();

  elements.previewLoadButton.disabled = true;
  elements.payoutRefreshButton.disabled = true;
  setInlineStatus(elements.payoutStatus, "시즌 보상 미리보기를 계산하는 중...");
  renderPreviewEmptyRow("보상 대상을 계산하는 중입니다.");

  try {
    state.previewResult = await runAdminActionRequest("season-payout-preview", {
      season,
      seasonLabel,
      limit,
      messageTitleTemplate: getPayoutMessageTitleTemplate(),
      messageBodyTemplate: getPayoutMessageBodyTemplate(),
      targetUidByPlayerId: Object.fromEntries(state.targetUidByPlayerId)
    });
    pruneSelectedPlayerIds();
    applyPreviewSummary();
    renderPreviewRows();
    setInlineStatus(elements.payoutStatus, `${formatText(state.previewResult.seasonLabel)} 보상 대상을 불러왔습니다.`, "success");
  } catch (error) {
    console.error(error);
    state.previewResult = null;
    state.selectedPlayerIds.clear();
    applyPreviewSummary();
    renderPreviewEmptyRow(formatText(error?.message, "보상 대상을 불러오지 못했습니다."));
    setInlineStatus(elements.payoutStatus, formatText(error?.message, "보상 대상을 불러오지 못했습니다."), "error");
  } finally {
    elements.previewLoadButton.disabled = state.applyInFlight;
    elements.payoutRefreshButton.disabled = state.applyInFlight;
    updateActionButtons();
  }
}

async function refreshPayoutReport() {
  const season = getSelectedSeason();
  const seasonLabel = getSelectedSeasonLabel();
  const limit = readLimit();

  elements.payoutLoadButton.disabled = true;
  elements.payoutRefreshButton.disabled = true;
  renderReportEmptyRow("지급 완료 내역을 불러오는 중입니다.");

  try {
    const result = await runAdminActionRequest("season-payout-report", {
      season,
      seasonLabel,
      limit
    });

    applyReportSummary(result);
    renderPayoutRows(result.recipients);
  } catch (error) {
    console.error(error);
    elements.payoutRecipientCount.textContent = "-";
    elements.payoutRewardTotal.textContent = "-";
    elements.payoutLastRewardedAt.textContent = "-";
    elements.payoutResultMeta.textContent = "불러오기에 실패했습니다.";
    renderReportEmptyRow(formatText(error?.message, "지급 완료 내역을 불러오지 못했습니다."));
    setInlineStatus(elements.payoutStatus, formatText(error?.message, "지급 완료 내역을 불러오지 못했습니다."), "error");
  } finally {
    elements.payoutLoadButton.disabled = state.applyInFlight;
    elements.payoutRefreshButton.disabled = state.applyInFlight;
    updateActionButtons();
  }
}

function selectReadyEntries() {
  state.selectedPlayerIds = new Set(
    getPreviewEntries()
      .filter((entry) => isSelectableEntry(entry))
      .map((entry) => normalizeId(entry.playerId))
  );
  applyPreviewSummary();
  renderPreviewRows();
  setInlineStatus(elements.previewApplyStatus, `${formatNumber(state.selectedPlayerIds.size)}명을 선택했습니다.`);
}

function clearSelectedEntries() {
  state.selectedPlayerIds.clear();
  applyPreviewSummary();
  renderPreviewRows();
  setInlineStatus(elements.previewApplyStatus, "선택을 해제했습니다.");
}

function summarizeApplyResults(summary) {
  const segments = [];

  if (summary.paidCount) {
    segments.push(`${formatNumber(summary.paidCount)}명 지급 완료`);
  }
  if (summary.alreadyPaidCount) {
    segments.push(`${formatNumber(summary.alreadyPaidCount)}명 이미 지급됨`);
  }
  if (summary.missingUidCount) {
    segments.push(`${formatNumber(summary.missingUidCount)}명 uid 필요`);
  }
  if (summary.failedCount) {
    segments.push(`${formatNumber(summary.failedCount)}명 실패`);
  }

  if (!segments.length) {
    return "선택 지급 결과를 확인해주세요.";
  }

  return segments.join(" / ");
}

async function applySelectedEntries() {
  const selectedEntries = getSelectedPreviewEntries();
  if (!selectedEntries.length) {
    setInlineStatus(elements.previewApplyStatus, "선택한 지급 대상이 없습니다.", "error");
    return;
  }

  const seasonLabel = getSelectedSeasonLabel();
  if (!window.confirm(`${seasonLabel} 보상을 ${selectedEntries.length}명에게 지급할까요?`)) {
    return;
  }

  state.applyInFlight = true;
  updateActionButtons();
  setInlineStatus(elements.previewApplyStatus, `${selectedEntries.length}명 지급 중...`);

  const summary = {
    paidCount: 0,
    alreadyPaidCount: 0,
    missingUidCount: 0,
    failedCount: 0
  };

  for (const [index, entry] of selectedEntries.entries()) {
    const label = formatText(entry.name, entry.playerId);
    setInlineStatus(elements.previewApplyStatus, `${index + 1}/${selectedEntries.length} 처리 중: ${label}`);

    try {
      const result = await runAdminActionRequest("season-payout-apply", {
        season: getSelectedSeason(),
        seasonLabel,
        playerId: normalizeId(entry.playerId),
        targetUid: getTargetUidOverride(entry.playerId),
        messageTitleTemplate: getPayoutMessageTitleTemplate(),
        messageBodyTemplate: getPayoutMessageBodyTemplate(),
        targetUidByPlayerId: Object.fromEntries(state.targetUidByPlayerId)
      });

      const resultEntry = Array.isArray(result.entries) ? result.entries[0] : null;
      const status = normalizeId(resultEntry?.status);

      if (status === "paid") {
        summary.paidCount += 1;
      } else if (status === "skipped-existing-message") {
        summary.alreadyPaidCount += 1;
      } else if (status === "skipped-missing-uid") {
        summary.missingUidCount += 1;
      } else {
        summary.failedCount += 1;
      }
    } catch (error) {
      console.error(error);
      summary.failedCount += 1;
    }
  }

  state.selectedPlayerIds.clear();
  state.applyInFlight = false;
  updateActionButtons();

  const tone = summary.failedCount ? "error" : "success";
  setInlineStatus(elements.previewApplyStatus, summarizeApplyResults(summary), tone);

  await refreshPreview();
  await refreshPayoutReport();
}

async function refreshAllData() {
  elements.payoutRefreshButton.disabled = true;
  setInlineStatus(elements.payoutStatus, "지급 센터 데이터를 새로고침하는 중...");
  await refreshPreview();
  await refreshPayoutReport();
}

function handlePreviewTableChange(event) {
  const checkbox = event.target.closest("[data-role='select-row']");
  if (checkbox) {
    const playerId = normalizeId(checkbox.dataset.playerId);
    if (!playerId) {
      return;
    }

    if (checkbox.checked) {
      state.selectedPlayerIds.add(playerId);
    } else {
      state.selectedPlayerIds.delete(playerId);
    }

    checkbox.closest("tr")?.classList.toggle("payout-row-selected", checkbox.checked);
    applyPreviewSummary();
    renderPayoutMessagePreview();
    updateActionButtons();
    return;
  }

  const uidInput = event.target.closest("[data-role='target-uid']");
  if (uidInput) {
    setTargetUidOverride(uidInput.dataset.playerId, uidInput.value);
    pruneSelectedPlayerIds();
    applyPreviewSummary();
    renderPreviewRows();
  }
}

function bindEvents() {
  elements.previewLoadButton?.addEventListener("click", () => {
    void refreshPreview();
  });
  elements.payoutLoadButton?.addEventListener("click", () => {
    void refreshPayoutReport();
  });
  elements.payoutRefreshButton?.addEventListener("click", () => {
    void refreshAllData();
  });
  elements.previewSelectReadyButton?.addEventListener("click", () => {
    selectReadyEntries();
  });
  elements.previewClearSelectionButton?.addEventListener("click", () => {
    clearSelectedEntries();
  });
  elements.previewApplySelectedButton?.addEventListener("click", () => {
    void applySelectedEntries();
  });
  elements.payoutMessageTitle?.addEventListener("input", () => {
    renderPayoutMessagePreview();
  });
  elements.payoutMessageBody?.addEventListener("input", () => {
    renderPayoutMessagePreview();
  });
  elements.payoutMessageResetButton?.addEventListener("click", () => {
    if (elements.payoutMessageTitle) {
      elements.payoutMessageTitle.value = DEFAULT_PAYOUT_MESSAGE_TITLE;
    }
    if (elements.payoutMessageBody) {
      elements.payoutMessageBody.value = DEFAULT_PAYOUT_MESSAGE_BODY;
    }
    renderPayoutMessagePreview();
    setInlineStatus(elements.payoutStatus, "지급 메시지 기본 문구를 복원했습니다.");
  });
  elements.previewTableBody?.addEventListener("change", handlePreviewTableChange);
  elements.payoutSeason?.addEventListener("change", () => {
    state.selectedPlayerIds.clear();
    setInlineStatus(elements.previewApplyStatus, "시즌이 바뀌어 선택을 초기화했습니다.");
    renderPayoutMessagePreview();
    void refreshAllData();
  });
  elements.payoutLimit?.addEventListener("change", () => {
    state.selectedPlayerIds.clear();
    setInlineStatus(elements.previewApplyStatus, "대상 수가 바뀌어 선택을 초기화했습니다.");
    renderPayoutMessagePreview();
    void refreshAllData();
  });
}

async function bootstrapPayoutPage() {
  try {
    await requireAuthorizedAdmin();
  } catch (error) {
    console.warn("관리자 지급 센터 접근이 차단되었습니다.", error);
    return;
  }

  populateSeasonSelect();
  if (elements.payoutMessageTitle && !String(elements.payoutMessageTitle.value || "").trim()) {
    elements.payoutMessageTitle.value = DEFAULT_PAYOUT_MESSAGE_TITLE;
  }
  if (elements.payoutMessageBody && !String(elements.payoutMessageBody.value || "").trim()) {
    elements.payoutMessageBody.value = DEFAULT_PAYOUT_MESSAGE_BODY;
  }
  applyPreviewSummary();
  renderPreviewEmptyRow("미리보기를 실행하면 시즌 보상 대상이 여기에 표시됩니다.");
  renderReportEmptyRow("지급 완료 내역을 불러오는 중입니다.");
  renderPayoutMessagePreview();
  bindEvents();
  await refreshAllData();
}

void bootstrapPayoutPage();
