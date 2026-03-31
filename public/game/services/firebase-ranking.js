import { getFirebaseRuntimeConfig } from "../config/runtime.js";

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

export async function fetchRankings() {
  ensureFirebaseReady();
  throw new Error("Firebase ranking provider is prepared but not wired yet.");
}

export async function submitScore() {
  ensureFirebaseReady();
  throw new Error("Firebase ranking provider is prepared but not wired yet.");
}
