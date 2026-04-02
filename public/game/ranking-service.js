import { getCurrentRankingSeason, getRankingProvider } from "./config/runtime.js";

async function getProvider() {
  return getRankingProvider() === "firebase"
    ? import("./services/firebase-ranking.js")
    : import("./services/rest-ranking.js");
}

function withDefaultSeason(payload = {}) {
  return {
    ...payload,
    season: payload?.season ?? getCurrentRankingSeason()
  };
}

export async function fetchRankingsFromProvider(options = {}) {
  return (await getProvider()).fetchRankings(withDefaultSeason(options));
}

export async function fetchAllRankingsFromProvider(options = {}) {
  return (await getProvider()).fetchAllRankings(withDefaultSeason(options));
}

export async function checkNicknameAvailabilityFromProvider(payload) {
  return (await getProvider()).checkNicknameAvailability(withDefaultSeason(payload));
}

export async function submitScoreToProvider(payload) {
  return (await getProvider()).submitScore(withDefaultSeason(payload));
}
