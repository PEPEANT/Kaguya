import {
  buildDeleteWrite,
  buildPatchWrite,
  commitWrites,
  createActionId,
  firestoreFieldsToJs,
  getDefaultActor,
  listDocuments,
  readDocument,
  refreshFirebaseTokenCache,
  writeSummaryFile
} from "./admin-firestore-utils.mjs";
import { fileURLToPath } from "node:url";

const userLinkIndex = new Map();

function isDirectRun(moduleUrl) {
  return process.argv[1] && process.argv[1] === fileURLToPath(moduleUrl);
}

function printHelp() {
  console.log("Usage: node scripts/admin-user-actions.mjs <command> [options]");
  console.log("");
  console.log("Commands:");
  console.log("  send-message     Create an inbox message for one user.");
  console.log("  adjust-wallet    Add or subtract HujuPay for one user.");
  console.log("  delete-message   Remove one message from one user inbox.");
  console.log("");
  console.log("Common:");
  console.log("  --apply                  Apply the action. Default is dry-run.");
  console.log("  --uid <uid|playerId>     Target user uid or linked playerId.");
  console.log("  --actor <name>           Actor label saved to adminLogs.");
  console.log("");
  console.log("send-message:");
  console.log("  --message-id <id>        Optional custom message id.");
  console.log("  --title <text>           Message title.");
  console.log("  --body <text>            Message body.");
  console.log("  --type <text>            Message type. Default: admin_notice");
  console.log("  --season <number>        Season number. Default: 1");
  console.log("  --season-label <text>    Meta label shown in the inbox.");
  console.log("  --rank <number>          Optional rank number.");
  console.log("  --reward-amount <int>    Optional reward display amount.");
  console.log("  --claimable <bool>       Default: false");
  console.log("  --claimed <bool>         Default: true");
  console.log("");
  console.log("adjust-wallet:");
  console.log("  --delta <int>            Balance change. Example: 500 or -300");
  console.log("  --reason <text>          Required audit reason.");
  console.log("  --message-id <id>        Optional custom message id.");
  console.log("  --title <text>           Optional inbox title.");
  console.log("  --body <text>            Optional inbox body.");
  console.log("  --season <number>        Season number for message meta. Default: 1");
  console.log("  --season-label <text>    Meta label for the inbox message.");
  console.log("  --skip-message           Do not create an inbox message.");
  console.log("");
  console.log("delete-message:");
  console.log("  --message-id <id>        Message id to delete.");
}

function normalizeUid(value) {
  return String(value || "").trim();
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeSeason(value, fallback = 1) {
  const safeValue = Math.floor(Number(value));
  return Number.isFinite(safeValue) && safeValue >= 1 ? safeValue : fallback;
}

function normalizeRank(value) {
  const safeValue = Math.floor(Number(value));
  return Number.isFinite(safeValue) && safeValue >= 1 ? safeValue : null;
}

function normalizeInt(value, fallback = 0) {
  const safeValue = Math.floor(Number(value));
  return Number.isFinite(safeValue) ? safeValue : fallback;
}

function normalizeNonNegativeInt(value) {
  return Math.max(0, normalizeInt(value, 0));
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const safeValue = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(safeValue);
}

function normalizeMessageId(value, fallbackPrefix = "admin_message") {
  const safeValue = String(value || "").trim();
  if (/^[A-Za-z0-9_-]{1,80}$/u.test(safeValue)) {
    return safeValue;
  }

  return createActionId(fallbackPrefix);
}

function requireMessageId(value) {
  const safeValue = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]{1,80}$/u.test(safeValue)) {
    throw new Error("message-id format is invalid.");
  }

  return safeValue;
}

function collectPlayerIdsFromUserDoc(data = {}) {
  const candidates = [
    data.firstLinkedPlayerId,
    data.lastSeenPlayerId,
    ...(Array.isArray(data.linkedPlayerIds) ? data.linkedPlayerIds : [])
  ];

  return [...new Set(
    candidates
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  )];
}

async function buildUserLinkIndex() {
  userLinkIndex.clear();

  const userDocs = await listDocuments("users");
  for (const document of userDocs) {
    const data = firestoreFieldsToJs(document.fields || {});
    const uid = String(data.uid || "").trim() || String(document.name || "").split("/").pop() || "";
    if (!uid) {
      continue;
    }

    for (const playerId of collectPlayerIdsFromUserDoc(data)) {
      if (!userLinkIndex.has(playerId)) {
        userLinkIndex.set(playerId, uid);
      }
    }
  }
}

async function resolveAccountUid(rawTarget) {
  const safeTarget = normalizeUid(rawTarget);
  if (!safeTarget) {
    return "";
  }

  const directUserDoc = await readDocument(`users/${safeTarget}`);
  if (directUserDoc.exists) {
    return safeTarget;
  }

  if (!userLinkIndex.size) {
    await buildUserLinkIndex();
  }

  if (userLinkIndex.has(safeTarget)) {
    return userLinkIndex.get(safeTarget) || "";
  }

  const identityLink = await readDocument(`identityLinks/${safeTarget}`);
  return String(identityLink.data?.uid || "").trim();
}

function parseArgs(argv = process.argv.slice(2)) {
  const [rawCommand = "", ...rest] = argv;
  const command = normalizeText(rawCommand);
  const options = {
    apply: false,
    uid: "",
    actor: getDefaultActor(),
    messageId: "",
    title: "",
    body: "",
    type: "",
    season: 1,
    seasonLabel: "",
    rank: "",
    rewardAmount: 0,
    claimable: false,
    claimed: true,
    delta: 0,
    reason: "",
    skipMessage: false
  };

  if (!command || command === "--help" || command === "help") {
    printHelp();
    process.exit(0);
  }

  for (let index = 0; index < rest.length; index += 1) {
    const arg = String(rest[index] || "").trim();
    const next = String(rest[index + 1] || "").trim();

    switch (arg) {
      case "--apply":
        options.apply = true;
        break;
      case "--uid":
        options.uid = next;
        index += 1;
        break;
      case "--actor":
        options.actor = next;
        index += 1;
        break;
      case "--message-id":
        options.messageId = next;
        index += 1;
        break;
      case "--title":
        options.title = next;
        index += 1;
        break;
      case "--body":
        options.body = next;
        index += 1;
        break;
      case "--type":
        options.type = next;
        index += 1;
        break;
      case "--season":
        options.season = normalizeSeason(next, 1);
        index += 1;
        break;
      case "--season-label":
        options.seasonLabel = next;
        index += 1;
        break;
      case "--rank":
        options.rank = next;
        index += 1;
        break;
      case "--reward-amount":
        options.rewardAmount = normalizeNonNegativeInt(next);
        index += 1;
        break;
      case "--claimable":
        options.claimable = normalizeBoolean(next, false);
        index += 1;
        break;
      case "--claimed":
        options.claimed = normalizeBoolean(next, true);
        index += 1;
        break;
      case "--delta":
        options.delta = normalizeInt(next, 0);
        index += 1;
        break;
      case "--reason":
        options.reason = next;
        index += 1;
        break;
      case "--skip-message":
        options.skipMessage = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { command, options };
}

function ensureRequired(value, label) {
  if (!normalizeText(value)) {
    throw new Error(`${label} is required.`);
  }
}

function buildMessagePayload({
  messageId,
  type = "admin_notice",
  title,
  body,
  season = 1,
  seasonLabel = "",
  rank = null,
  rewardAmount = 0,
  rewardCurrency = "notice",
  claimable = false,
  claimed = true,
  sentAt
}) {
  return {
    messageId,
    type: normalizeText(type) || "admin_notice",
    title: normalizeText(title) || "관리자 메시지",
    body: normalizeText(body) || "관리자가 계정에 안내 메시지를 보냈습니다.",
    season: normalizeSeason(season, 1),
    seasonLabel: normalizeText(seasonLabel),
    rank: normalizeRank(rank) ?? 0,
    rewardCurrency: normalizeText(rewardCurrency) || "notice",
    rewardAmount: normalizeNonNegativeInt(rewardAmount),
    claimable: Boolean(claimable),
    claimed: Boolean(claimed),
    sentAt,
    claimedAt: claimed ? sentAt : ""
  };
}

function buildWalletAdjustmentNotice(delta, reason = "") {
  const safeDelta = normalizeInt(delta, 0);
  const absoluteDelta = Math.abs(safeDelta).toLocaleString("ko-KR");
  const actionLabel = safeDelta > 0 ? "지급" : "차감";
  const safeReason = normalizeText(reason);

  return {
    title: "후쥬페이 변동 안내",
    body: [
      `관리자가 ${absoluteDelta} HujuPay를 ${actionLabel}했습니다.`,
      safeReason ? `사유: ${safeReason}` : ""
    ].filter(Boolean).join("\n")
  };
}

function buildLogPayload({
  actionId,
  actionType,
  actor,
  uid,
  apply,
  summary,
  nowIso
}) {
  return {
    actionId,
    actionType,
    actor,
    uid,
    applied: Boolean(apply),
    summary: normalizeText(summary),
    createdAt: nowIso
  };
}

export async function runSendMessage(options) {
  const targetAccount = normalizeUid(options.uid);
  ensureRequired(targetAccount, "uid or playerId");
  ensureRequired(options.title, "title");
  ensureRequired(options.body, "body");

  const uid = await resolveAccountUid(targetAccount);
  if (!uid) {
    throw new Error(`No linked user account found for ${targetAccount}.`);
  }

  const userDoc = await readDocument(`users/${uid}`);
  if (!userDoc.exists) {
    throw new Error(`User ${uid} does not exist.`);
  }

  const nowIso = new Date().toISOString();
  const actionId = createActionId("admin_send_message");
  const messageId = normalizeMessageId(options.messageId, "admin_message");
  const messageRefPath = `users/${uid}/messages/${messageId}`;
  const existingMessage = await readDocument(messageRefPath);

  if (existingMessage.exists) {
    throw new Error(`Message ${messageId} already exists for ${uid}.`);
  }

  const messagePayload = buildMessagePayload({
    messageId,
    type: options.type || "admin_notice",
    title: options.title,
    body: options.body,
    season: options.season,
    seasonLabel: options.seasonLabel,
    rank: options.rank,
    rewardAmount: options.rewardAmount,
    rewardCurrency: options.rewardAmount > 0 ? "hujupay" : "notice",
    claimable: options.claimable,
    claimed: options.claimed,
    sentAt: nowIso
  });

  const summary = {
    command: "send-message",
    apply: options.apply,
    startedAt: nowIso,
    uid,
    actor: options.actor,
    messageId,
    message: messagePayload
  };

  if (options.apply) {
    await commitWrites([
      buildPatchWrite(messageRefPath, messagePayload, { mustNotExist: true }),
      buildPatchWrite(`adminLogs/${actionId}`, buildLogPayload({
        actionId,
        actionType: "send-message",
        actor: options.actor,
        uid,
        apply: true,
        summary: `Sent message ${messageId}`,
        nowIso
      }))
    ]);
  }

  summary.completedAt = new Date().toISOString();
  summary.summaryFile = await writeSummaryFile("admin-send-message", summary);

  console.log(options.apply
    ? `Message ${messageId} sent to ${uid}.`
    : `[dry-run] Message ${messageId} is ready for ${uid}.`);
  console.log(`Summary written to ${summary.summaryFile}`);
  return summary;
}

export async function runAdjustWallet(options) {
  const targetAccount = normalizeUid(options.uid);
  const delta = normalizeInt(options.delta, 0);
  ensureRequired(targetAccount, "uid or playerId");
  ensureRequired(options.reason, "reason");

  if (!delta) {
    throw new Error("delta must not be zero.");
  }

  const uid = await resolveAccountUid(targetAccount);
  if (!uid) {
    throw new Error(`No linked user account found for ${targetAccount}.`);
  }

  const userPath = `users/${uid}`;
  const userDoc = await readDocument(userPath);
  if (!userDoc.exists) {
    throw new Error(`User ${uid} does not exist.`);
  }

  const nowIso = new Date().toISOString();
  const actionId = createActionId("admin_wallet");
  const currentBalance = normalizeNonNegativeInt(userDoc.data.hujupayBalance);
  const currentEarnedTotal = normalizeNonNegativeInt(userDoc.data.hujupayEarnedTotal);
  const nextBalance = currentBalance + delta;

  if (nextBalance < 0) {
    throw new Error(`Wallet adjustment would make balance negative (${nextBalance}).`);
  }

  const nextEarnedTotal = delta > 0 ? currentEarnedTotal + delta : currentEarnedTotal;
  const messageId = normalizeMessageId(options.messageId, "wallet_adjust");
  const messagePath = `users/${uid}/messages/${messageId}`;
  const messageDoc = options.skipMessage ? null : await readDocument(messagePath);

  if (!options.skipMessage && messageDoc?.exists) {
    throw new Error(`Message ${messageId} already exists for ${uid}.`);
  }

  const noticeDraft = buildWalletAdjustmentNotice(delta, options.reason);
  const messagePayload = options.skipMessage ? null : buildMessagePayload({
    messageId,
    type: delta > 0 ? "admin_wallet_credit" : "admin_wallet_debit",
    title: options.title || noticeDraft.title,
    body: options.body || noticeDraft.body,
    season: options.season,
    seasonLabel: options.seasonLabel || "관리자",
    rewardAmount: delta > 0 ? delta : 0,
    rewardCurrency: delta > 0 ? "hujupay" : "notice",
    claimable: false,
    claimed: true,
    sentAt: nowIso
  });

  const summary = {
    command: "adjust-wallet",
    apply: options.apply,
    startedAt: nowIso,
    uid,
    actor: options.actor,
    delta,
    reason: normalizeText(options.reason),
    previousBalance: currentBalance,
    nextBalance,
    previousEarnedTotal: currentEarnedTotal,
    nextEarnedTotal,
    messageId: options.skipMessage ? "" : messageId,
    skipMessage: Boolean(options.skipMessage)
  };

  if (options.apply) {
    const writes = [
      buildPatchWrite(userPath, {
        uid,
        hujupayBalance: nextBalance,
        hujupayEarnedTotal: nextEarnedTotal,
        updatedAt: new Date(nowIso)
      }),
      buildPatchWrite(`adminLogs/${actionId}`, buildLogPayload({
        actionId,
        actionType: "adjust-wallet",
        actor: options.actor,
        uid,
        apply: true,
        summary: `Adjusted wallet by ${delta}`,
        nowIso
      }))
    ];

    if (messagePayload) {
      writes.splice(1, 0, buildPatchWrite(messagePath, messagePayload, { mustNotExist: true }));
    }

    await commitWrites(writes);
  }

  summary.completedAt = new Date().toISOString();
  summary.summaryFile = await writeSummaryFile("admin-adjust-wallet", summary);

  console.log(options.apply
    ? `Wallet for ${uid} adjusted by ${delta}. New balance: ${nextBalance}.`
    : `[dry-run] Wallet for ${uid} would change by ${delta}. New balance: ${nextBalance}.`);
  console.log(`Summary written to ${summary.summaryFile}`);
  return summary;
}

export async function runDeleteMessage(options) {
  const targetAccount = normalizeUid(options.uid);
  ensureRequired(targetAccount, "uid or playerId");
  ensureRequired(options.messageId, "message-id");
  const messageId = requireMessageId(options.messageId);

  const uid = await resolveAccountUid(targetAccount);
  if (!uid) {
    throw new Error(`No linked user account found for ${targetAccount}.`);
  }

  const nowIso = new Date().toISOString();
  const actionId = createActionId("admin_delete_message");
  const messagePath = `users/${uid}/messages/${messageId}`;
  const messageDoc = await readDocument(messagePath);

  const summary = {
    command: "delete-message",
    apply: options.apply,
    startedAt: nowIso,
    uid,
    actor: options.actor,
    messageId,
    existed: messageDoc.exists
  };

  if (!messageDoc.exists) {
    summary.completedAt = new Date().toISOString();
    summary.summaryFile = await writeSummaryFile("admin-delete-message", summary);
    console.log(`Message ${messageId} does not exist for ${uid}.`);
    console.log(`Summary written to ${summary.summaryFile}`);
    return summary;
  }

  if (options.apply) {
    await commitWrites([
      buildDeleteWrite(messagePath, { mustExist: true }),
      buildPatchWrite(`adminLogs/${actionId}`, buildLogPayload({
        actionId,
        actionType: "delete-message",
        actor: options.actor,
        uid,
        apply: true,
        summary: `Deleted message ${messageId}`,
        nowIso
      }))
    ]);
  }

  summary.completedAt = new Date().toISOString();
  summary.summaryFile = await writeSummaryFile("admin-delete-message", summary);

  console.log(options.apply
    ? `Message ${messageId} deleted for ${uid}.`
    : `[dry-run] Message ${messageId} would be deleted for ${uid}.`);
  console.log(`Summary written to ${summary.summaryFile}`);
  return summary;
}

export async function runAdminUserAction(command, options = {}) {
  refreshFirebaseTokenCache();

  switch (command) {
    case "send-message":
      return runSendMessage(options);
    case "adjust-wallet":
      return runAdjustWallet(options);
    case "delete-message":
      return runDeleteMessage(options);
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

async function main() {
  const { command, options } = parseArgs();
  await runAdminUserAction(command, options);
}

if (isDirectRun(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
