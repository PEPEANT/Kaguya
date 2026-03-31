import { getRankingProvider } from "./config/runtime.js";
import * as firebaseRanking from "./services/firebase-ranking.js";
import * as restRanking from "./services/rest-ranking.js";

function getProvider() {
  return getRankingProvider() === "firebase" ? firebaseRanking : restRanking;
}

export async function fetchRankingsFromProvider() {
  return getProvider().fetchRankings();
}

export async function submitScoreToProvider(payload) {
  return getProvider().submitScore(payload);
}
