import { getRankingApiUrl } from "../config/runtime.js";

function appendSeason(path, season) {
  const params = new URLSearchParams();
  params.set("season", String(season));
  return `${path}?${params.toString()}`;
}

export async function fetchRankings({ season }) {
  const response = await fetch(getRankingApiUrl(appendSeason("/api/rankings", season)), { cache: "no-store" });

  if (!response.ok) {
    throw new Error("ranking fetch failed");
  }

  return response.json();
}

export async function fetchAllRankings({ season }) {
  const response = await fetch(getRankingApiUrl(appendSeason("/api/rankings/all", season)), { cache: "no-store" });

  if (!response.ok) {
    throw new Error("ranking fetch failed");
  }

  return response.json();
}

export async function checkNicknameAvailability({ season, playerId, name }) {
  const params = new URLSearchParams();
  params.set("season", String(season));
  params.set("name", String(name || ""));
  params.set("playerId", String(playerId || ""));

  const response = await fetch(getRankingApiUrl(`/api/rankings/name-available?${params.toString()}`), { cache: "no-store" });

  if (!response.ok) {
    throw new Error("nickname validation failed");
  }

  return response.json();
}

export async function submitScore({ season, playerId, uid = "", name, score }) {
  const response = await fetch(getRankingApiUrl("/api/rankings"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ season, playerId, uid, name, score })
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "save failed");
  }

  return payload;
}
