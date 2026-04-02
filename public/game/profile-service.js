import { fetchAccountIdentity, fetchSeasonSummary } from "./account-service.js";
import { fetchAllRankingsFromProvider } from "./ranking-service.js";

function normalizePlayerId(playerId) {
  const trimmed = String(playerId || "").trim();
  return /^[A-Za-z0-9_-]{16,64}$/u.test(trimmed) ? trimmed : "";
}

function dedupePlayerIds(playerIds = []) {
  return [...new Set(
    playerIds
      .map((playerId) => normalizePlayerId(playerId))
      .filter(Boolean)
  )];
}

export async function fetchSeasonProfile({ user, currentPlayerId, season = 1 } = {}) {
  if (!user?.uid) {
    throw new Error("Authenticated user is required.");
  }

  const [accountIdentity, seasonSummary] = await Promise.all([
    fetchAccountIdentity({ uid: user.uid }),
    fetchSeasonSummary({ uid: user.uid, season })
  ]);
  const candidatePlayerIds = dedupePlayerIds([
    currentPlayerId,
    accountIdentity.firstLinkedPlayerId,
    accountIdentity.lastSeenPlayerId,
    seasonSummary.playerId,
    ...accountIdentity.linkedPlayerIds
  ]);

  const { rankings } = await fetchAllRankingsFromProvider({ season });
  const topRankings = rankings.slice(0, 10);
  const liveRecord = candidatePlayerIds.length
    ? rankings.find((entry) => candidatePlayerIds.includes(entry.playerId)) || null
    : null;
  const record = liveRecord
    ? {
      ...liveRecord,
      rank: rankings.findIndex((entry) => entry.playerId === liveRecord.playerId) + 1
    }
    : seasonSummary.bestScore !== null
      ? {
        playerId: seasonSummary.playerId,
        name: seasonSummary.bestNickname || seasonSummary.lastNickname,
        score: seasonSummary.bestScore,
        submittedAt: seasonSummary.bestSubmittedAt || seasonSummary.lastSubmittedAt,
        rank: seasonSummary.bestRank
      }
      : null;

  return {
    season,
    topRankings,
    totalPlayers: rankings.length,
    linkedPlayerIds: candidatePlayerIds,
    identity: accountIdentity,
    seasonSummary,
    record
  };
}
