import { promises as fs } from "node:fs";

import { DATA_DIR, MAX_RANKINGS, RANKINGS_FILE, getSeasonRankingsFile, normalizeRankingSeason } from "./config.mjs";

const MAX_STORED_RANKINGS = Number.POSITIVE_INFINITY;

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureFile(filePath) {
  if (await fileExists(filePath)) {
    return;
  }

  await fs.writeFile(filePath, "[]\n", "utf8");
}

async function resolveReadableRankingFile(season) {
  const safeSeason = normalizeRankingSeason(season);
  const seasonFile = getSeasonRankingsFile(safeSeason);

  if (await fileExists(seasonFile)) {
    return seasonFile;
  }

  if (safeSeason === 1 && await fileExists(RANKINGS_FILE)) {
    return RANKINGS_FILE;
  }

  return seasonFile;
}

async function resolveWritableRankingFile(season) {
  const safeSeason = normalizeRankingSeason(season);
  const seasonFile = getSeasonRankingsFile(safeSeason);

  if (safeSeason === 1 && !await fileExists(seasonFile) && await fileExists(RANKINGS_FILE)) {
    return RANKINGS_FILE;
  }

  return seasonFile;
}

export async function ensureRankingStorage(season = 1) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await ensureFile(await resolveWritableRankingFile(season));
}

export function normalizeName(input) {
  if (typeof input !== "string") {
    return "";
  }

  const collapsed = input.trim().replace(/\s+/g, " ");
  return Array.from(collapsed).slice(0, 12).join("");
}

export function normalizePlayerId(input) {
  if (typeof input !== "string") {
    return "";
  }

  const trimmed = input.trim();
  return /^[A-Za-z0-9_-]{16,64}$/u.test(trimmed) ? trimmed : "";
}

export function normalizeUid(input) {
  return typeof input === "string" ? input.trim() : "";
}

function compareRankings(left, right) {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  return String(left.submittedAt).localeCompare(String(right.submittedAt));
}

function getEntryIdentity(entry) {
  const playerId = normalizePlayerId(entry?.playerId);
  if (playerId) {
    return `player:${playerId}`;
  }

  const name = normalizeName(entry?.name);
  return name ? `legacy:${name}` : "";
}

function sanitizeRankings(rawRankings, maxCount = MAX_STORED_RANKINGS) {
  const bestByIdentity = new Map();

  for (const entry of Array.isArray(rawRankings) ? rawRankings : []) {
    const nicknameSnapshot = normalizeName(entry?.nicknameSnapshot || entry?.name);
    const uid = normalizeUid(entry?.uid);
    const playerId = normalizePlayerId(entry?.playerId);
    const score = Number(entry?.score);
    const submittedAt = typeof entry?.submittedAt === "string" ? entry.submittedAt : new Date(0).toISOString();
    const identity = getEntryIdentity({ name: nicknameSnapshot, playerId });

    if (!nicknameSnapshot || !identity || !Number.isFinite(score)) {
      continue;
    }

    const nextEntry = {
      uid,
      nicknameSnapshot,
      name: nicknameSnapshot,
      score: Math.floor(score),
      submittedAt
    };

    if (playerId) {
      nextEntry.playerId = playerId;
    }

    const existing = bestByIdentity.get(identity);
    if (!existing || compareRankings(nextEntry, existing) < 0) {
      bestByIdentity.set(identity, nextEntry);
    }
  }

  return [...bestByIdentity.values()].sort(compareRankings).slice(0, maxCount);
}

async function readStoredRankings(season = 1) {
  await ensureRankingStorage(season);

  try {
    const fileContents = await fs.readFile(await resolveReadableRankingFile(season), "utf8");
    return sanitizeRankings(JSON.parse(fileContents), MAX_STORED_RANKINGS);
  } catch {
    return [];
  }
}

export async function readRankings({ season = 1 } = {}) {
  return (await readStoredRankings(season)).slice(0, MAX_RANKINGS);
}

export async function readAllRankings({ season = 1 } = {}) {
  return (await readStoredRankings(season)).slice(0, MAX_STORED_RANKINGS);
}

export async function writeRankings(rankings, { season = 1 } = {}) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const targetFile = await resolveWritableRankingFile(season);
  const nextRankings = sanitizeRankings(rankings, MAX_STORED_RANKINGS);
  const tempPath = `${targetFile}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(nextRankings, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, targetFile);
  return nextRankings;
}

export async function isNicknameAvailable({ season = 1, playerId, name }) {
  const safePlayerId = normalizePlayerId(playerId);
  const safeName = normalizeName(name);

  if (!safeName) {
    return { available: false };
  }

  const rankings = await readAllRankings({ season });
  const conflictingEntry = rankings.find((entry) => {
    if (entry.name !== safeName) {
      return false;
    }

    return normalizePlayerId(entry.playerId) !== safePlayerId;
  });

  return {
    available: !conflictingEntry
  };
}

export async function submitRanking({ season = 1, playerId, uid = "", name, score }) {
  const safeSeason = normalizeRankingSeason(season, 1);
  const safePlayerId = normalizePlayerId(playerId);
  const safeUid = normalizeUid(uid);
  const safeName = normalizeName(name);
  const safeScore = Math.floor(Number(score));

  if (!safeName) {
    throw new Error("Nickname is required.");
  }

  if (!Number.isFinite(safeScore)) {
    throw new Error("Score is invalid.");
  }

  const availability = await isNicknameAvailable({
    season: safeSeason,
    playerId: safePlayerId,
    name: safeName
  });
  if (!availability.available) {
    throw new Error("Nickname is already taken.");
  }

  const rankings = await readAllRankings({ season: safeSeason });
  const samePlayerEntry = safePlayerId
    ? rankings.find((entry) => normalizePlayerId(entry.playerId) === safePlayerId)
    : null;
  const legacyNameEntry = rankings.find((entry) => !normalizePlayerId(entry.playerId) && entry.name === safeName);
  const existing = samePlayerEntry || legacyNameEntry || null;
  const submittedAt = new Date().toISOString();
  const shouldRefreshExistingPlayer = Boolean(
    existing
    && (
      (safePlayerId && samePlayerEntry && samePlayerEntry.name !== safeName)
      || (safeUid && normalizeUid(existing.uid) !== safeUid)
      || normalizeName(existing.nicknameSnapshot || existing.name) !== safeName
    )
  );

  let accepted = false;
  let nextRankings = rankings;

  if (!existing || safeScore > existing.score) {
    const withoutCurrentPlayer = rankings.filter((entry) => {
      const entryPlayerId = normalizePlayerId(entry.playerId);

      if (safePlayerId && entryPlayerId === safePlayerId) {
        return false;
      }

      if (safePlayerId && !entryPlayerId && entry.name === safeName) {
        return false;
      }

      if (!safePlayerId && !entryPlayerId && entry.name === safeName) {
        return false;
      }

      return true;
    });
    const nextEntry = {
      uid: safeUid,
      nicknameSnapshot: safeName,
      name: safeName,
      score: safeScore,
      submittedAt
    };
    if (safePlayerId) {
      nextEntry.playerId = safePlayerId;
    }

    nextRankings = await writeRankings([
      ...withoutCurrentPlayer,
      nextEntry
    ], { season: safeSeason });
    accepted = true;
  } else if (shouldRefreshExistingPlayer) {
    const withoutCurrentPlayer = rankings.filter((entry) => {
      const entryPlayerId = normalizePlayerId(entry.playerId);

      if (safePlayerId && entryPlayerId === safePlayerId) {
        return false;
      }

      if (safePlayerId && !entryPlayerId && entry.name === safeName) {
        return false;
      }

      if (!safePlayerId && !entryPlayerId && entry.name === safeName) {
        return false;
      }

      return true;
    });
    nextRankings = await writeRankings([
      ...withoutCurrentPlayer,
      {
        playerId: safePlayerId,
        uid: safeUid || normalizeUid(existing.uid),
        nicknameSnapshot: safeName,
        name: safeName,
        score: existing.score,
        submittedAt: existing.submittedAt
      }
    ], { season: safeSeason });
  } else {
    nextRankings = await writeRankings(rankings, { season: safeSeason });
  }

  const rankIdentity = getEntryIdentity({ playerId: safePlayerId, name: safeName });
  const currentEntry = nextRankings.find((entry) => getEntryIdentity(entry) === rankIdentity) || null;

  return {
    season: safeSeason,
    accepted,
    currentEntry,
    rank: nextRankings.findIndex((entry) => getEntryIdentity(entry) === rankIdentity) + 1 || null,
    totalPlayers: nextRankings.length,
    rankings: nextRankings.slice(0, MAX_RANKINGS)
  };
}
