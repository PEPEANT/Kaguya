import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "kaguya-snack-rush";
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || "(default)";
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT_DIR, "data");

const REWARD_TIERS = Object.freeze([
  Object.freeze({ minRank: 1, maxRank: 1, reward: 8000 }),
  Object.freeze({ minRank: 2, maxRank: 3, reward: 5000 }),
  Object.freeze({ minRank: 4, maxRank: 10, reward: 2500 }),
  Object.freeze({ minRank: 11, maxRank: 50, reward: 500 })
]);

const userLinkIndex = new Map();

function printHelp() {
  console.log("Usage: node scripts/admin-season-payout.mjs [options]");
  console.log("");
  console.log("Options:");
  console.log("  --season <number>        Ranking season number. Default: 1");
  console.log("  --season-label <text>    Override the user-facing season label.");
  console.log("  --apply                  Apply the payout. Default is dry-run.");
  console.log("  --limit <number>         Process only the first N eligible ranking rows.");
  console.log("  --uid <uid>              Restrict payout preview/apply to one user.");
  console.log("  --player-id <playerId>   Restrict payout preview/apply to one playerId.");
  console.log("  --target-uid <uid>       Force a uid for the selected playerId when no link exists.");
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    season: 1,
    seasonLabel: "",
    apply: false,
    limit: 0,
    uid: "",
    playerId: "",
    targetUid: ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || "").trim();
    const next = String(argv[index + 1] || "").trim();

    switch (arg) {
      case "--season":
        options.season = Math.max(1, Math.floor(Number(next) || 1));
        index += 1;
        break;
      case "--season-label":
        options.seasonLabel = next;
        index += 1;
        break;
      case "--apply":
        options.apply = true;
        break;
      case "--limit":
        options.limit = Math.max(0, Math.floor(Number(next) || 0));
        index += 1;
        break;
      case "--uid":
        options.uid = next;
        index += 1;
        break;
      case "--player-id":
        options.playerId = next;
        index += 1;
        break;
      case "--target-uid":
        options.targetUid = next;
        index += 1;
        break;
      case "--help":
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function getRankingCollectionName(season) {
  return season === 1 ? "rankings" : `rankings_season${season}`;
}

function getDefaultSeasonLabel(season) {
  return season === 1 ? "\uD504\uB9AC\uB7AD\uD0B9" : `\uC2DC\uC98C ${season}`;
}

function getRewardAmount(rank) {
  const tier = REWARD_TIERS.find((entry) => rank >= entry.minRank && rank <= entry.maxRank);
  return tier ? tier.reward : 0;
}

function normalizeInt(value) {
  const safeValue = Math.floor(Number(value));
  return Number.isFinite(safeValue) && safeValue >= 0 ? safeValue : 0;
}

function normalizeName(value) {
  return Array.from(String(value || "").trim().replace(/\s+/g, " ")).slice(0, 12).join("");
}

function normalizeIso(value) {
  const safeValue = String(value || "").trim();
  return safeValue || "";
}

function compareRankings(left, right) {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  return String(left.submittedAt).localeCompare(String(right.submittedAt));
}

function getFirebaseConfigstorePath() {
  return path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
}

function refreshFirebaseTokenCache() {
  if (process.platform === "win32") {
    execFileSync("cmd.exe", ["/c", "firebase.cmd", "projects:list", "--json"], {
      stdio: "ignore",
      cwd: ROOT_DIR
    });
    return;
  }

  execFileSync("firebase", ["projects:list", "--json"], {
    stdio: "ignore",
    cwd: ROOT_DIR
  });
}

async function readFirebaseAccessToken() {
  const raw = await fs.readFile(getFirebaseConfigstorePath(), "utf8");
  const config = JSON.parse(raw);
  const token = String(config?.tokens?.access_token || "").trim();

  if (!token) {
    throw new Error("Firebase CLI access token not found.");
  }

  return token;
}

function encodePathSegments(relativePath) {
  return relativePath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function getApiBaseUrl() {
  return `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${encodeURIComponent(DATABASE_ID)}`;
}

function getDocumentName(documentPath) {
  return `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/${documentPath}`;
}

async function authFetch(url, options = {}) {
  const token = await readFirebaseAccessToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Firestore API ${response.status} ${response.statusText}: ${text}`);
  }

  return response;
}

function firestoreValueToJs(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  if ("stringValue" in value) {
    return String(value.stringValue || "");
  }

  if ("integerValue" in value) {
    return Number.parseInt(value.integerValue, 10) || 0;
  }

  if ("doubleValue" in value) {
    return Number(value.doubleValue) || 0;
  }

  if ("booleanValue" in value) {
    return value.booleanValue === true;
  }

  if ("timestampValue" in value) {
    return String(value.timestampValue || "");
  }

  if ("arrayValue" in value) {
    return Array.isArray(value.arrayValue?.values)
      ? value.arrayValue.values.map((entry) => firestoreValueToJs(entry))
      : [];
  }

  if ("mapValue" in value) {
    return firestoreFieldsToJs(value.mapValue?.fields || {});
  }

  if ("nullValue" in value) {
    return null;
  }

  return null;
}

function firestoreFieldsToJs(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, firestoreValueToJs(value)])
  );
}

function jsValueToFirestore(value) {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((entry) => jsValueToFirestore(entry))
      }
    };
  }

  if (typeof value === "boolean") {
    return { booleanValue: value };
  }

  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }

  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }

  if (typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, entry]) => [key, jsValueToFirestore(entry)])
        )
      }
    };
  }

  return { stringValue: String(value) };
}

function jsFieldsToFirestore(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, jsValueToFirestore(value)])
  );
}

async function listDocuments(collectionPath) {
  const encodedCollectionPath = encodePathSegments(collectionPath);
  const documents = [];
  let pageToken = "";

  while (true) {
    const search = new URLSearchParams({ pageSize: "1000" });
    if (pageToken) {
      search.set("pageToken", pageToken);
    }

    const response = await authFetch(`${getApiBaseUrl()}/documents/${encodedCollectionPath}?${search.toString()}`);
    if (!response) {
      break;
    }

    const payload = await response.json();
    documents.push(...(payload.documents || []));

    if (!payload.nextPageToken) {
      break;
    }

    pageToken = payload.nextPageToken;
  }

  return documents;
}

async function readDocument(documentPath) {
  const encodedDocumentPath = encodePathSegments(documentPath);
  const response = await authFetch(`${getApiBaseUrl()}/documents/${encodedDocumentPath}`);

  if (!response) {
    return { exists: false, data: {} };
  }

  const payload = await response.json();
  return {
    exists: true,
    data: firestoreFieldsToJs(payload.fields || {})
  };
}

async function commitWrites(writes) {
  const response = await authFetch(`${getApiBaseUrl()}/documents:commit`, {
    method: "POST",
    body: JSON.stringify({ writes })
  });

  if (!response) {
    throw new Error("Commit request returned an empty response.");
  }

  return response.json();
}

function buildPatchWrite(documentPath, fields, { mustNotExist = false } = {}) {
  return {
    update: {
      name: getDocumentName(documentPath),
      fields: jsFieldsToFirestore(fields)
    },
    updateMask: {
      fieldPaths: Object.keys(fields)
    },
    ...(mustNotExist ? { currentDocument: { exists: false } } : {})
  };
}

function buildRankingEntry(document) {
  const data = firestoreFieldsToJs(document.fields || {});
  return {
    playerId: String(data.playerId || "").trim(),
    uid: String(data.uid || "").trim(),
    name: normalizeName(data.nicknameSnapshot || data.name),
    score: normalizeInt(data.score),
    submittedAt: normalizeIso(data.submittedAt)
  };
}

function buildPaidMessage({ season, seasonLabel, rank, rewardAmount, sentAt }) {
  return {
    type: "season_reward_paid",
    title: `${seasonLabel} reward paid`,
    body: `${seasonLabel} final rank #${rank} reward of HujuPay ${rewardAmount.toLocaleString("ko-KR")} has already been added to your balance.`,
    season,
    seasonLabel,
    rank,
    rewardCurrency: "hujupay",
    rewardAmount,
    claimable: false,
    claimed: true,
    sentAt,
    claimedAt: sentAt
  };
}

function buildSeasonSummaryPatch({
  existingSeason,
  exists,
  season,
  entry,
  rewardAmount,
  messageId,
  nowIso
}) {
  const patch = {
    season,
    playerId: entry.playerId,
    lastNickname: entry.name,
    lastScore: entry.score,
    lastRank: entry.rank,
    lastSubmittedAt: entry.submittedAt,
    hujupayEarned: normalizeInt(existingSeason.hujupayEarned) + rewardAmount,
    adminRewardAmount: rewardAmount,
    adminRewardMessageId: messageId,
    adminRewardedAt: nowIso,
    updatedAt: new Date(nowIso)
  };

  const existingBestScore = Number.isFinite(Number(existingSeason.bestScore))
    ? Number(existingSeason.bestScore)
    : null;
  const existingBestRank = Number.isFinite(Number(existingSeason.bestRank))
    ? Number(existingSeason.bestRank)
    : null;
  const shouldUpdateBest = !exists
    || existingBestScore === null
    || entry.score > existingBestScore
    || (entry.score === existingBestScore && (existingBestRank === null || entry.rank < existingBestRank));

  if (!exists) {
    patch.createdAt = new Date(nowIso);
  }

  if (shouldUpdateBest) {
    patch.bestNickname = entry.name;
    patch.bestScore = entry.score;
    patch.bestRank = entry.rank;
    patch.bestSubmittedAt = entry.submittedAt;
  }

  return patch;
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
    const uid = String(data.uid || "").trim();
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

async function resolveUid(entry) {
  if (entry.uid) {
    return entry.uid;
  }

  if (entry.playerId && userLinkIndex.has(entry.playerId)) {
    return userLinkIndex.get(entry.playerId) || "";
  }

  if (!entry.playerId) {
    return "";
  }

  const identityLink = await readDocument(`identityLinks/${entry.playerId}`);
  return String(identityLink.data.uid || "").trim();
}

async function writeSummaryFile(summary) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const filename = `admin-season-payout-s${summary.season}-${summary.startedAt.slice(0, 19).replace(/[:T]/g, "_")}.json`;
  const filepath = path.join(DATA_DIR, filename);
  await fs.writeFile(filepath, JSON.stringify(summary, null, 2));
  return filepath;
}

export async function runSeasonPayout(rawOptions = {}) {
  const options = {
    season: Math.max(1, Math.floor(Number(rawOptions.season) || 1)),
    seasonLabel: String(rawOptions.seasonLabel || "").trim(),
    apply: Boolean(rawOptions.apply),
    limit: Math.max(0, Math.floor(Number(rawOptions.limit) || 0)),
    uid: String(rawOptions.uid || "").trim(),
    playerId: String(rawOptions.playerId || "").trim(),
    targetUid: String(rawOptions.targetUid || "").trim(),
    quiet: Boolean(rawOptions.quiet)
  };
  if (options.targetUid && !options.playerId) {
    throw new Error("--target-uid requires --player-id.");
  }

  const log = (...args) => {
    if (!options.quiet) {
      console.log(...args);
    }
  };
  const logError = (...args) => {
    if (!options.quiet) {
      console.error(...args);
    }
  };

  refreshFirebaseTokenCache();

  const season = options.season;
  const seasonLabel = options.seasonLabel || getDefaultSeasonLabel(season);
  const rankingCollection = getRankingCollectionName(season);
  const rewardMessageId = `season_reward_paid_s${season}`;
  const startedAt = new Date().toISOString();

  log(options.apply
    ? `[apply] Paying ${seasonLabel} rewards from ${rankingCollection}.`
    : `[dry-run] Previewing ${seasonLabel} rewards from ${rankingCollection}.`);

  await buildUserLinkIndex();

  const rankingDocs = await listDocuments(rankingCollection);
  const rankedEntries = rankingDocs
    .map((document) => buildRankingEntry(document))
    .filter((entry) => entry.playerId && entry.name && Number.isFinite(entry.score))
    .sort(compareRankings)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
      rewardAmount: getRewardAmount(index + 1)
    }))
    .filter((entry) => entry.rewardAmount > 0)
    .filter((entry) => !options.playerId || entry.playerId === options.playerId);

  const eligibleEntries = options.limit > 0
    ? rankedEntries.slice(0, options.limit)
    : rankedEntries;

  const summary = {
    projectId: PROJECT_ID,
    databaseId: DATABASE_ID,
    season,
    seasonLabel,
    rankingCollection,
    apply: options.apply,
    startedAt,
    eligibleEntries: eligibleEntries.length,
    processedEntries: 0,
    skippedExistingMessage: 0,
    skippedMissingUid: 0,
    skippedUidFilter: 0,
    failedCount: 0,
    totalRewardedAmount: 0,
    entries: []
  };

  for (const rankingEntry of eligibleEntries) {
    const resolvedUid = options.targetUid && options.playerId && rankingEntry.playerId === options.playerId
      ? options.targetUid
      : await resolveUid(rankingEntry);
    const entry = {
      playerId: rankingEntry.playerId,
      uid: resolvedUid,
      name: rankingEntry.name,
      score: rankingEntry.score,
      rank: rankingEntry.rank,
      rewardAmount: rankingEntry.rewardAmount,
      status: "pending"
    };

    if (!resolvedUid) {
      entry.status = "skipped-missing-uid";
      summary.skippedMissingUid += 1;
      summary.entries.push(entry);
      log(`- skip #${entry.rank} ${entry.name} (${entry.playerId}) -> no uid`);
      continue;
    }

    if (options.uid && resolvedUid !== options.uid) {
      entry.status = "skipped-uid-filter";
      summary.skippedUidFilter += 1;
      summary.entries.push(entry);
      continue;
    }

    try {
      const [userDoc, seasonDoc, messageDoc] = await Promise.all([
        readDocument(`users/${resolvedUid}`),
        readDocument(`users/${resolvedUid}/seasons/${season}`),
        readDocument(`users/${resolvedUid}/messages/${rewardMessageId}`)
      ]);

      if (messageDoc.exists) {
        entry.status = "skipped-existing-message";
        summary.skippedExistingMessage += 1;
        summary.entries.push(entry);
        log(`- skip #${entry.rank} ${entry.name} (${resolvedUid}) -> already paid`);
        continue;
      }

      const nowIso = new Date().toISOString();
      const userData = userDoc.data || {};
      const nextBalance = normalizeInt(userData.hujupayBalance) + entry.rewardAmount;
      const nextEarnedTotal = normalizeInt(userData.hujupayEarnedTotal) + entry.rewardAmount;
      const paidMessage = buildPaidMessage({
        season,
        seasonLabel,
        rank: entry.rank,
        rewardAmount: entry.rewardAmount,
        sentAt: nowIso
      });

      const userPatch = {
        uid: resolvedUid,
        hujupayBalance: nextBalance,
        hujupayEarnedTotal: nextEarnedTotal,
        updatedAt: new Date(nowIso)
      };

      if (!userDoc.exists) {
        userPatch.createdAt = new Date(nowIso);
        userPatch.displayName = entry.name;
        userPatch.currentNickname = entry.name;
        userPatch.lastNickname = entry.name;
      }

      const seasonPatch = buildSeasonSummaryPatch({
        existingSeason: seasonDoc.data || {},
        exists: seasonDoc.exists,
        season,
        entry,
        rewardAmount: entry.rewardAmount,
        messageId: rewardMessageId,
        nowIso
      });

      if (options.apply) {
        await commitWrites([
          buildPatchWrite(`users/${resolvedUid}`, userPatch),
          buildPatchWrite(`users/${resolvedUid}/seasons/${season}`, seasonPatch),
          buildPatchWrite(`users/${resolvedUid}/messages/${rewardMessageId}`, {
            messageId: rewardMessageId,
            ...paidMessage
          }, { mustNotExist: true })
        ]);
      }

      entry.status = options.apply ? "paid" : "preview";
      entry.nextBalance = nextBalance;
      entry.nextEarnedTotal = nextEarnedTotal;
      summary.processedEntries += 1;
      summary.totalRewardedAmount += entry.rewardAmount;
      summary.entries.push(entry);
      log(`${options.apply ? "+" : "*"} #${entry.rank} ${entry.name} -> ${entry.rewardAmount.toLocaleString("ko-KR")} HujuPay`);
    } catch (error) {
      entry.status = "failed";
      entry.error = error instanceof Error ? error.message : String(error);
      summary.failedCount += 1;
      summary.entries.push(entry);
      logError(`! failed #${entry.rank} ${entry.name} (${resolvedUid})`);
      logError(`  ${entry.error}`);
    }
  }

  summary.completedAt = new Date().toISOString();
  const summaryFile = await writeSummaryFile(summary);
  summary.summaryFile = summaryFile;

  log("");
  log(options.apply ? "Reward payout complete." : "Reward payout preview complete.");
  log(`Eligible entries: ${summary.eligibleEntries}`);
  log(`Processed entries: ${summary.processedEntries}`);
  log(`Skipped (already paid): ${summary.skippedExistingMessage}`);
  log(`Skipped (missing uid): ${summary.skippedMissingUid}`);
  log(`Skipped (uid filter): ${summary.skippedUidFilter}`);
  log(`Failed: ${summary.failedCount}`);
  log(`Total reward amount: ${summary.totalRewardedAmount.toLocaleString("ko-KR")} HujuPay`);
  log(`Summary written to ${summaryFile}`);
  return summary;
}

async function main() {
  await runSeasonPayout(parseArgs());
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
