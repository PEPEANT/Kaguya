import { runSeasonPayout } from "../scripts/admin-season-payout.mjs";
import { runAdminUserAction } from "../scripts/admin-user-actions.mjs";
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
  const header = String(request.headers.authorization || "").trim();
  const tokenMatch = header.match(/^Bearer\s+(.+)$/iu);
  if (!tokenMatch) {
    const error = new Error("Admin authentication is required.");
    error.statusCode = 401;
    throw error;
  }

  const user = await lookupFirebaseUserByIdToken(tokenMatch[1]);
  const allowedEmails = getAdminAllowedEmails();

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
  return {
    season: Math.max(1, Math.floor(Number(payload.season) || 1)),
    seasonLabel: String(payload.seasonLabel || "").trim(),
    apply: Boolean(payload.apply),
    limit: Math.max(0, Math.floor(Number(payload.limit) || 0)),
    uid: String(payload.uid || "").trim(),
    playerId: String(payload.playerId || "").trim(),
    targetUid: String(payload.targetUid || "").trim(),
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
    skipMessage: Boolean(payload.skipMessage)
  };
}

export async function handleAdminApiRequest(request, response, requestUrl) {
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
