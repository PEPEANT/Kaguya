import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { arrayUnion, doc, getDoc, getFirestore, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

import { getFirebaseRuntimeConfig } from "./config/runtime.js";
import { normalizeName } from "./state.js";

function hasFirebaseConfig(config) {
  return Boolean(config?.apiKey && config?.authDomain && config?.projectId && config?.appId);
}

function ensureFirebaseReady() {
  const config = getFirebaseRuntimeConfig();

  if (!hasFirebaseConfig(config)) {
    throw new Error("Firebase account sync is not configured.");
  }

  return config;
}

function getFirebaseApp() {
  const config = ensureFirebaseReady();
  return getApps()[0] || initializeApp(config);
}

function getDb() {
  return getFirestore(getFirebaseApp());
}

function normalizePlayerId(playerId) {
  const trimmed = String(playerId || "").trim();
  return /^[A-Za-z0-9_-]{16,64}$/u.test(trimmed) ? trimmed : "";
}

function normalizeUid(uid) {
  const trimmed = String(uid || "").trim();
  return trimmed ? trimmed : "";
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeProviderIds(providerIds) {
  return Array.isArray(providerIds)
    ? providerIds
      .map((providerId) => String(providerId || "").trim())
      .filter(Boolean)
    : [];
}

function normalizeLinkedPlayerIds(playerIds) {
  return Array.isArray(playerIds)
    ? [...new Set(playerIds.map((playerId) => normalizePlayerId(playerId)).filter(Boolean))]
    : [];
}

function normalizeSeasonNumber(season) {
  const safeSeason = Math.floor(Number(season));
  return Number.isFinite(safeSeason) && safeSeason >= 1 ? safeSeason : 1;
}

function normalizeRank(rank) {
  const safeRank = Math.floor(Number(rank));
  return Number.isFinite(safeRank) && safeRank >= 1 ? safeRank : null;
}

function normalizeScore(score) {
  const safeScore = Math.floor(Number(score));
  return Number.isFinite(safeScore) ? safeScore : null;
}

function normalizeIsoDate(value) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : "";
}

async function upsertUserDocument({ user, playerId, nickname }) {
  const userRef = doc(getDb(), "users", user.uid);
  const snapshot = await getDoc(userRef);

  const payload = {
    uid: normalizeUid(user.uid),
    email: normalizeEmail(user.email),
    displayName: String(user.displayName || "").trim(),
    currentNickname: normalizeName(user.displayName),
    providerIds: normalizeProviderIds(user.providerIds),
    lastSeenPlayerId: playerId || "",
    lastNickname: normalizeName(nickname),
    lastLoginAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  if (!snapshot.exists()) {
    payload.createdAt = serverTimestamp();
  }

  if (playerId) {
    payload.linkedPlayerIds = arrayUnion(playerId);

    if (!snapshot.exists() || !normalizePlayerId(snapshot.data()?.firstLinkedPlayerId)) {
      payload.firstLinkedPlayerId = playerId;
    }
  }

  await setDoc(userRef, payload, { merge: true });
}

async function upsertIdentityLink({ user, playerId, nickname }) {
  if (!playerId) {
    return { status: "skipped" };
  }

  const linkRef = doc(getDb(), "identityLinks", playerId);
  const snapshot = await getDoc(linkRef);
  const existingUid = String(snapshot.data()?.uid || "").trim();
  const safeNickname = normalizeName(nickname);
  const safeEmail = normalizeEmail(user.email);

  if (!snapshot.exists()) {
    await setDoc(linkRef, {
      uid: user.uid,
      email: safeEmail,
      playerId,
      lastNickname: safeNickname,
      linkedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      lastSeenAt: serverTimestamp()
    }, { merge: true });
    return { status: "linked" };
  }

  if (!existingUid || existingUid === user.uid) {
    await setDoc(linkRef, {
      uid: user.uid,
      email: safeEmail,
      playerId,
      lastNickname: safeNickname,
      lastSeenAt: serverTimestamp()
    }, { merge: true });
    return { status: "linked" };
  }

  await setDoc(linkRef, {
    playerId,
    conflictUid: user.uid,
    conflictEmail: safeEmail,
    conflictNickname: safeNickname,
    conflictAt: serverTimestamp(),
    lastSeenAt: serverTimestamp()
  }, { merge: true });

  return {
    status: "conflict",
    ownerUid: existingUid
  };
}

export async function syncAccountIdentity({ user, playerId, nickname = "" }) {
  if (!user?.uid) {
    return { status: "skipped" };
  }

  const safePlayerId = normalizePlayerId(playerId);
  await upsertUserDocument({ user, playerId: safePlayerId, nickname });
  return upsertIdentityLink({ user, playerId: safePlayerId, nickname });
}

export async function fetchAccountIdentity({ uid }) {
  const safeUid = String(uid || "").trim();

  if (!safeUid) {
    return {
      uid: "",
      email: "",
      displayName: "",
      currentNickname: "",
      firstLinkedPlayerId: "",
      lastSeenPlayerId: "",
      linkedPlayerIds: []
    };
  }

  const snapshot = await getDoc(doc(getDb(), "users", safeUid));
  const data = snapshot.exists() ? snapshot.data() || {} : {};

  return {
    uid: safeUid,
    email: normalizeEmail(data.email),
    displayName: String(data.displayName || "").trim(),
    currentNickname: normalizeName(data.currentNickname || data.displayName),
    firstLinkedPlayerId: normalizePlayerId(data.firstLinkedPlayerId),
    lastSeenPlayerId: normalizePlayerId(data.lastSeenPlayerId),
    linkedPlayerIds: normalizeLinkedPlayerIds(data.linkedPlayerIds)
  };
}

export async function updateAccountNickname({ uid, nickname }) {
  const safeUid = normalizeUid(uid);
  const safeNickname = normalizeName(nickname);

  if (!safeUid) {
    throw new Error("Authenticated user is required.");
  }

  if (!safeNickname) {
    throw new Error("Nickname is required.");
  }

  await setDoc(doc(getDb(), "users", safeUid), {
    uid: safeUid,
    displayName: safeNickname,
    currentNickname: safeNickname,
    lastNickname: safeNickname,
    updatedAt: serverTimestamp()
  }, { merge: true });

  return {
    uid: safeUid,
    currentNickname: safeNickname
  };
}

export async function saveSeasonSummary({
  uid,
  season,
  playerId,
  nickname = "",
  score,
  rank,
  submittedAt = ""
}) {
  const safeUid = String(uid || "").trim();
  const safeSeason = normalizeSeasonNumber(season);
  const safePlayerId = normalizePlayerId(playerId);
  const safeNickname = normalizeName(nickname);
  const safeScore = normalizeScore(score);
  const safeRank = normalizeRank(rank);
  const safeSubmittedAt = normalizeIsoDate(submittedAt) || new Date().toISOString();

  if (!safeUid || safeScore === null) {
    return null;
  }

  const seasonRef = doc(getDb(), "users", safeUid, "seasons", String(safeSeason));
  const snapshot = await getDoc(seasonRef);
  const existing = snapshot.exists() ? snapshot.data() || {} : {};
  const existingBestScore = normalizeScore(existing.bestScore);
  const existingBestRank = normalizeRank(existing.bestRank);
  const shouldUpdateBest = existingBestScore === null
    || safeScore > existingBestScore
    || (
      safeScore === existingBestScore
      && safeRank !== null
      && (existingBestRank === null || safeRank < existingBestRank)
    );

  const payload = {
    season: safeSeason,
    playerId: safePlayerId,
    lastNickname: safeNickname,
    lastScore: safeScore,
    lastRank: safeRank,
    lastSubmittedAt: safeSubmittedAt,
    updatedAt: serverTimestamp()
  };

  if (!snapshot.exists()) {
    payload.createdAt = serverTimestamp();
  }

  if (shouldUpdateBest) {
    payload.bestNickname = safeNickname;
    payload.bestScore = safeScore;
    payload.bestRank = safeRank;
    payload.bestSubmittedAt = safeSubmittedAt;
  }

  await setDoc(seasonRef, payload, { merge: true });

  return {
    season: safeSeason,
    playerId: safePlayerId,
    lastNickname: safeNickname,
    lastScore: safeScore,
    lastRank: safeRank,
    lastSubmittedAt: safeSubmittedAt,
    bestNickname: shouldUpdateBest ? safeNickname : normalizeName(existing.bestNickname),
    bestScore: shouldUpdateBest ? safeScore : existingBestScore,
    bestRank: shouldUpdateBest ? safeRank : existingBestRank,
    bestSubmittedAt: shouldUpdateBest ? safeSubmittedAt : normalizeIsoDate(existing.bestSubmittedAt)
  };
}

export async function fetchSeasonSummary({ uid, season }) {
  const safeUid = String(uid || "").trim();
  const safeSeason = normalizeSeasonNumber(season);

  if (!safeUid) {
    return {
      season: safeSeason,
      playerId: "",
      lastNickname: "",
      lastScore: null,
      lastRank: null,
      lastSubmittedAt: "",
      bestNickname: "",
      bestScore: null,
      bestRank: null,
      bestSubmittedAt: ""
    };
  }

  const snapshot = await getDoc(doc(getDb(), "users", safeUid, "seasons", String(safeSeason)));
  const data = snapshot.exists() ? snapshot.data() || {} : {};

  return {
    season: safeSeason,
    playerId: normalizePlayerId(data.playerId),
    lastNickname: normalizeName(data.lastNickname),
    lastScore: normalizeScore(data.lastScore),
    lastRank: normalizeRank(data.lastRank),
    lastSubmittedAt: normalizeIsoDate(data.lastSubmittedAt),
    bestNickname: normalizeName(data.bestNickname),
    bestScore: normalizeScore(data.bestScore),
    bestRank: normalizeRank(data.bestRank),
    bestSubmittedAt: normalizeIsoDate(data.bestSubmittedAt)
  };
}
