import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  runTransaction,
  where
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

import { getCurrentRankingSeason, getFirebaseRuntimeConfig, getRankingSeasonCollection } from "../config/runtime.js";

const MAX_RANKINGS = 10;

function hasFirebaseConfig(config) {
  return Boolean(config?.apiKey && config?.projectId && config?.appId);
}

function ensureFirebaseReady() {
  const config = getFirebaseRuntimeConfig();

  if (!hasFirebaseConfig(config)) {
    throw new Error("Firebase ranking is not configured.");
  }

  return config;
}

function normalizeName(name) {
  return Array.from(String(name || "").trim().replace(/\s+/g, " ")).slice(0, 12).join("");
}

function normalizePlayerId(playerId) {
  const trimmed = String(playerId || "").trim();
  return /^[A-Za-z0-9_-]{16,64}$/u.test(trimmed) ? trimmed : "";
}

function normalizeUid(uid) {
  return String(uid || "").trim();
}

function compareRankings(left, right) {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  return String(left.submittedAt).localeCompare(String(right.submittedAt));
}

function pickPreferredEntry(current, candidate) {
  if (!current) {
    return candidate;
  }

  if (!candidate) {
    return current;
  }

  return compareRankings(current, candidate) <= 0 ? current : candidate;
}

function sanitizeEntry(entry) {
  const nicknameSnapshot = normalizeName(entry?.nicknameSnapshot || entry?.name);
  const playerId = normalizePlayerId(entry?.playerId);
  const uid = normalizeUid(entry?.uid);
  const score = Math.floor(Number(entry?.score));
  const submittedAt = typeof entry?.submittedAt === "string" ? entry.submittedAt : new Date(0).toISOString();

  if (!nicknameSnapshot || !playerId || !Number.isFinite(score)) {
    return null;
  }

  return {
    playerId,
    uid,
    nicknameSnapshot,
    name: nicknameSnapshot,
    score,
    submittedAt
  };
}

function getFirebaseApp() {
  const config = ensureFirebaseReady();
  return getApps().length ? getApp() : initializeApp(config);
}

function getDb() {
  return getFirestore(getFirebaseApp());
}

function resolveSeason(season) {
  const safeSeason = Math.floor(Number(season));
  return Number.isFinite(safeSeason) && safeSeason >= 1
    ? safeSeason
    : getCurrentRankingSeason();
}

function getCollectionName(season = getCurrentRankingSeason()) {
  return getRankingSeasonCollection(resolveSeason(season));
}

async function readRankingEntry(playerId, season = getCurrentRankingSeason()) {
  const snapshot = await getDoc(doc(getDb(), getCollectionName(season), playerId));
  return snapshot.exists() ? sanitizeEntry(snapshot.data()) : null;
}

async function readTopRankings(season = getCurrentRankingSeason()) {
  const rankingQuery = query(
    collection(getDb(), getCollectionName(season)),
    orderBy("score", "desc"),
    limit(MAX_RANKINGS)
  );
  const snapshot = await getDocs(rankingQuery);

  return snapshot.docs
    .map((entryDoc) => sanitizeEntry(entryDoc.data()))
    .filter(Boolean)
    .sort(compareRankings)
    .slice(0, MAX_RANKINGS);
}

async function readAllRankings(season = getCurrentRankingSeason()) {
  const rankingQuery = query(
    collection(getDb(), getCollectionName(season)),
    orderBy("score", "desc")
  );
  const snapshot = await getDocs(rankingQuery);

  return snapshot.docs
    .map((entryDoc) => sanitizeEntry(entryDoc.data()))
    .filter(Boolean)
    .sort(compareRankings);
}

async function readEntriesByName(name, season = getCurrentRankingSeason()) {
  const nameQuery = query(
    collection(getDb(), getCollectionName(season)),
    where("name", "==", name)
  );
  const snapshot = await getDocs(nameQuery);

  return snapshot.docs
    .map((entryDoc) => sanitizeEntry(entryDoc.data()))
    .filter(Boolean);
}

async function readEntriesByUid(uid, season = getCurrentRankingSeason()) {
  const safeUid = normalizeUid(uid);
  if (!safeUid) {
    return [];
  }

  const uidQuery = query(
    collection(getDb(), getCollectionName(season)),
    where("uid", "==", safeUid)
  );
  const snapshot = await getDocs(uidQuery);

  return snapshot.docs
    .map((entryDoc) => sanitizeEntry(entryDoc.data()))
    .filter(Boolean)
    .sort(compareRankings);
}

async function resolveExistingEntry({ season = getCurrentRankingSeason(), playerId, uid = "" } = {}) {
  const safePlayerId = normalizePlayerId(playerId);
  const safeUid = normalizeUid(uid);

  const [playerEntry, uidEntries] = await Promise.all([
    safePlayerId ? readRankingEntry(safePlayerId, season) : Promise.resolve(null),
    safeUid ? readEntriesByUid(safeUid, season) : Promise.resolve([])
  ]);

  return [playerEntry, ...uidEntries]
    .filter(Boolean)
    .reduce((bestEntry, entry) => pickPreferredEntry(bestEntry, entry), null);
}

export async function fetchRankings({ season = getCurrentRankingSeason() } = {}) {
  ensureFirebaseReady();
  const safeSeason = resolveSeason(season);
  return {
    season: safeSeason,
    rankings: await readTopRankings(safeSeason)
  };
}

export async function fetchAllRankings({ season = getCurrentRankingSeason() } = {}) {
  ensureFirebaseReady();
  const safeSeason = resolveSeason(season);

  return {
    season: safeSeason,
    rankings: await readAllRankings(safeSeason)
  };
}

export async function checkNicknameAvailability({ season = getCurrentRankingSeason(), playerId, uid = "", name }) {
  ensureFirebaseReady();

  const safeSeason = resolveSeason(season);
  const safePlayerId = normalizePlayerId(playerId);
  const safeUid = normalizeUid(uid);
  const safeName = normalizeName(name);

  if (!safeName) {
    return { available: false };
  }

  const existingEntry = await resolveExistingEntry({
    season: safeSeason,
    playerId: safePlayerId,
    uid: safeUid
  });
  const matchedEntries = await readEntriesByName(safeName, safeSeason);
  const allowedPlayerIds = new Set([safePlayerId, existingEntry?.playerId].filter(Boolean));
  const conflictingEntry = matchedEntries.find((entry) => {
    if (allowedPlayerIds.has(entry.playerId)) {
      return false;
    }

    if (safeUid && entry.uid === safeUid) {
      return false;
    }

    return true;
  });

  return {
    available: !conflictingEntry
  };
}

export async function submitScore({ season = getCurrentRankingSeason(), playerId, uid = "", name, score }) {
  ensureFirebaseReady();

  const safeSeason = resolveSeason(season);
  const safePlayerId = normalizePlayerId(playerId);
  const safeUid = normalizeUid(uid);
  const safeName = normalizeName(name);
  const safeScore = Math.floor(Number(score));

  if (!safePlayerId) {
    throw new Error("Player identity is missing.");
  }

  if (!safeName) {
    throw new Error("Nickname is required.");
  }

  if (!Number.isFinite(safeScore)) {
    throw new Error("Score is invalid.");
  }

  const existingEntry = await resolveExistingEntry({
    season: safeSeason,
    playerId: safePlayerId,
    uid: safeUid
  });
  const resolvedPlayerId = existingEntry?.playerId || safePlayerId;
  const availability = await checkNicknameAvailability({
    season: safeSeason,
    playerId: resolvedPlayerId,
    uid: safeUid,
    name: safeName
  });
  if (!availability.available) {
    throw new Error("Nickname is already taken.");
  }

  const submittedAt = new Date().toISOString();
  const rankingRef = doc(getDb(), getCollectionName(safeSeason), resolvedPlayerId);

  let accepted = false;

  await runTransaction(getDb(), async (transaction) => {
    const snapshot = await transaction.get(rankingRef);
    const existing = snapshot.exists() ? sanitizeEntry(snapshot.data()) : null;
    const shouldRefreshMetadata = Boolean(
      existing
      && (
        (safeUid && existing.uid !== safeUid)
        || existing.nicknameSnapshot !== safeName
      )
    );

    if (!existing || safeScore > existing.score) {
      transaction.set(rankingRef, {
        playerId: resolvedPlayerId,
        uid: safeUid,
        nicknameSnapshot: safeName,
        name: safeName,
        score: safeScore,
        submittedAt
      });
      accepted = true;
      return;
    }

    if (shouldRefreshMetadata) {
      transaction.set(rankingRef, {
        playerId: resolvedPlayerId,
        uid: safeUid || existing.uid || "",
        nicknameSnapshot: safeName,
        name: safeName,
        score: existing.score,
        submittedAt: existing.submittedAt
      });
    }
  });

  const currentEntry = await readRankingEntry(resolvedPlayerId, safeSeason);
  const allRankings = await readAllRankings(safeSeason);
  const rankings = allRankings.slice(0, MAX_RANKINGS);

  return {
    season: safeSeason,
    accepted,
    currentEntry,
    rank: currentEntry ? allRankings.findIndex((entry) => entry.playerId === currentEntry.playerId) + 1 || null : null,
    totalPlayers: allRankings.length,
    rankings
  };
}
