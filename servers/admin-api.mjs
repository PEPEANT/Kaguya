import { runSeasonPayout } from "../scripts/admin-season-payout.mjs";
import { runAdminUserAction } from "../scripts/admin-user-actions.mjs";
import { firestoreFieldsToJs, listDocuments, readDocument } from "../scripts/admin-firestore-utils.mjs";
import { sendJson } from "./shared/http.mjs";

const DEFAULT_FIREBASE_API_KEY = "AIzaSyCVk-H_DkZfbo_KaEg9C3Kq1ij4ziHmW6M";
const MAX_BODY_BYTES = 256 * 1024;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function getAdminAllowedEmails() {
  return String(process.env.ADMIN_ALLOWED_EMAILS || "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

function getFirebaseApiKey() {
  return String(process.env.FIREBASE_API_KEY || DEFAULT_FIREBASE_API_KEY).trim();
}

function isLocalHost(hostname = "") {
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(String(hostname || "").trim().toLowerCase());
}

function isLoopbackOrigin(origin = "") {
  if (!origin) {
    return false;
  }

  try {
    const requestOrigin = new URL(origin);
    return isLocalHost(requestOrigin.hostname);
  } catch {
    return false;
  }
}

function setAdminCorsHeaders(request, response) {
  const requestOrigin = String(request.headers.origin || "").trim();
  if (!isLoopbackOrigin(requestOrigin)) {
    return;
  }

  response.setHeader("Access-Control-Allow-Origin", requestOrigin);
  response.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Vary", "Origin");
}

async function readJsonBody(request) {
  const chunks = [];
  let totalLength = 0;

  for await (const chunk of request) {
    totalLength += chunk.length;
    if (totalLength > MAX_BODY_BYTES) {
      throw new Error("Request body is too large.");
    }

    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function lookupFirebaseUserByIdToken(idToken) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(getFirebaseApiKey())}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ idToken })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to verify Firebase session (${response.status}): ${text}`);
  }

  const payload = await response.json();
  const user = Array.isArray(payload.users) ? payload.users[0] : null;
  if (!user?.localId) {
    throw new Error("Firebase session did not return a valid user.");
  }

  return {
    uid: String(user.localId || "").trim(),
    email: normalizeEmail(user.email),
    displayName: String(user.displayName || "").trim()
  };
}

async function requireAuthorizedAdmin(request, requestUrl) {
  const allowedEmails = getAdminAllowedEmails();
  const header = String(request.headers.authorization || "").trim();
  const tokenMatch = header.match(/^Bearer\s+(.+)$/iu);
  if (!tokenMatch) {
    if (!allowedEmails.length && isLocalHost(requestUrl.hostname)) {
      return {
        uid: "local-dev-admin",
        email: "local-dev@localhost",
        displayName: "Local Dev Admin"
      };
    }

    const error = new Error("Admin authentication is required.");
    error.statusCode = 401;
    throw error;
  }

  const user = await lookupFirebaseUserByIdToken(tokenMatch[1]);

  if (allowedEmails.length) {
    if (!allowedEmails.includes(user.email)) {
      const error = new Error(`Admin access denied for ${user.email || "unknown account"}.`);
      error.statusCode = 403;
      throw error;
    }

    return user;
  }

  if (!isLocalHost(requestUrl.hostname)) {
    const error = new Error("ADMIN_ALLOWED_EMAILS must be configured for remote admin actions.");
    error.statusCode = 403;
    throw error;
  }

  return user;
}

function sanitizePayoutOptions(payload = {}) {
  const targetUidByPlayerId = Object.fromEntries(
    Object.entries(payload.targetUidByPlayerId && typeof payload.targetUidByPlayerId === "object"
      ? payload.targetUidByPlayerId
      : {})
      .map(([playerId, uid]) => [String(playerId || "").trim(), String(uid || "").trim()])
      .filter(([playerId, uid]) => playerId && uid)
  );

  return {
    season: Math.max(1, Math.floor(Number(payload.season) || 1)),
    seasonLabel: String(payload.seasonLabel || "").trim(),
    apply: Boolean(payload.apply),
    limit: Math.max(0, Math.floor(Number(payload.limit) || 0)),
    uid: String(payload.uid || "").trim(),
    playerId: String(payload.playerId || "").trim(),
    targetUid: String(payload.targetUid || "").trim(),
    targetUidByPlayerId,
    messageTitleTemplate: String(payload.messageTitleTemplate || "").trim(),
    messageBodyTemplate: String(payload.messageBodyTemplate || "").trim(),
    persistSummary: false,
    refreshTokenCache: false,
    quiet: true
  };
}

function sanitizeUserActionOptions(payload = {}, actor = "") {
  return {
    apply: Boolean(payload.apply),
    uid: String(payload.uid || "").trim(),
    actor: String(actor || "").trim() || "admin",
    messageId: String(payload.messageId || "").trim(),
    title: String(payload.title || "").trim(),
    body: String(payload.body || "").trim(),
    type: String(payload.type || "").trim(),
    season: Math.max(1, Math.floor(Number(payload.season) || 1)),
    seasonLabel: String(payload.seasonLabel || "").trim(),
    rank: payload.rank,
    rewardAmount: Math.max(0, Math.floor(Number(payload.rewardAmount) || 0)),
    claimable: Boolean(payload.claimable),
    claimed: payload.claimed !== false,
    delta: Math.floor(Number(payload.delta) || 0),
    reason: String(payload.reason || "").trim(),
    skipMessage: Boolean(payload.skipMessage),
    persistSummary: false,
    refreshTokenCache: false
  };
}

function normalizeSeasonNumber(value, fallback = 1) {
  const season = Math.floor(Number(value) || fallback);
  return Number.isFinite(season) && season >= 1 ? season : fallback;
}

function normalizeNonNegativeInt(value, fallback = 0) {
  const safeValue = Math.floor(Number(value) || fallback);
  return Number.isFinite(safeValue) && safeValue >= 0 ? safeValue : fallback;
}

function normalizeNickname(...values) {
  for (const value of values) {
    const safeValue = String(value || "").trim();
    if (safeValue) {
      return safeValue;
    }
  }

  return "이름 없음";
}

function comparePayoutRecipients(left, right) {
  const leftTime = new Date(left.rewardedAt || 0).getTime();
  const rightTime = new Date(right.rewardedAt || 0).getTime();
  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  const leftRank = Number(left.rank) || 0;
  const rightRank = Number(right.rank) || 0;
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return String(left.nickname || "").localeCompare(String(right.nickname || ""), "ko");
}

async function listSeasonPayoutRecipients(payload = {}) {
  const season = normalizeSeasonNumber(payload.season, 1);
  const seasonLabel = String(payload.seasonLabel || "").trim() || (season === 1 ? "시즌 0" : `시즌 ${season - 1}`);
  const limit = normalizeNonNegativeInt(payload.limit, 200);
  const userDocuments = await listDocuments("users");
  const recipients = [];

  await Promise.allSettled(userDocuments.map(async (document) => {
    const userData = firestoreFieldsToJs(document.fields || {});
    const uid = String(userData.uid || "").trim() || String(document.name || "").split("/").pop() || "";
    if (!uid) {
      return;
    }

    const seasonDoc = await readDocument(`users/${uid}/seasons/${season}`);
    if (!seasonDoc.exists) {
      return;
    }

    const seasonData = seasonDoc.data || {};
    const rewardedAt = String(seasonData.adminRewardedAt || "").trim();
    if (!rewardedAt) {
      return;
    }

    recipients.push({
      uid,
      playerId: String(seasonData.playerId || userData.lastSeenPlayerId || "").trim(),
      nickname: normalizeNickname(
        userData.currentNickname,
        userData.displayName,
        userData.lastNickname,
        seasonData.lastNickname
      ),
      rank: normalizeNonNegativeInt(seasonData.lastRank, 0),
      score: normalizeNonNegativeInt(seasonData.lastScore, 0),
      rewardAmount: normalizeNonNegativeInt(seasonData.adminRewardAmount, 0),
      rewardedAt,
      messageId: String(seasonData.adminRewardMessageId || "").trim(),
      currentBalance: normalizeNonNegativeInt(userData.hujupayBalance, 0)
    });
  }));

  recipients.sort(comparePayoutRecipients);

  const visibleRecipients = limit > 0 ? recipients.slice(0, limit) : recipients;
  const lastRewardedAt = recipients[0]?.rewardedAt || "";

  return {
    season,
    seasonLabel,
    totalRecipients: recipients.length,
    totalRewardedAmount: recipients.reduce((sum, entry) => sum + (Number(entry.rewardAmount) || 0), 0),
    lastRewardedAt,
    recipients: visibleRecipients
  };
}

export async function handleAdminApiRequest(request, response, requestUrl) {
  setAdminCorsHeaders(request, response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return true;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "Method not allowed." });
    return true;
  }

  try {
    const adminUser = await requireAuthorizedAdmin(request, requestUrl);
    const body = await readJsonBody(request);
    const action = String(body.action || "").trim();
    const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
    let result;

    switch (action) {
      case "season-payout-preview":
        result = await runSeasonPayout({
          ...sanitizePayoutOptions(payload),
          apply: false
        });
        break;
      case "season-payout-apply":
        result = await runSeasonPayout({
          ...sanitizePayoutOptions(payload),
          apply: true
        });
        break;
      case "season-payout-report":
        result = await listSeasonPayoutRecipients(payload);
        break;
      case "send-message":
        result = await runAdminUserAction("send-message", sanitizeUserActionOptions(payload, adminUser.email || adminUser.uid));
        break;
      case "adjust-wallet":
        result = await runAdminUserAction("adjust-wallet", sanitizeUserActionOptions(payload, adminUser.email || adminUser.uid));
        break;
      case "delete-message":
        result = await runAdminUserAction("delete-message", sanitizeUserActionOptions(payload, adminUser.email || adminUser.uid));
        break;
      default:
        sendJson(response, 400, { ok: false, error: "Unknown admin action." });
        return true;
    }

    sendJson(response, 200, {
      ok: true,
      action,
      admin: {
        uid: adminUser.uid,
        email: adminUser.email
      },
      result
    });
    return true;
  } catch (error) {
    sendJson(response, Number(error?.statusCode) || 500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
    return true;
  }
}
