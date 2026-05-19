export async function fetchRankings({ season = 1 } = {}) {
  return {
    season,
    rankings: []
  };
}

export async function fetchAllRankings({ season = 1 } = {}) {
  return {
    season,
    rankings: []
  };
}

export async function checkNicknameAvailability() {
  return {
    available: true
  };
}

export async function submitScore({ season = 1, playerId = "", uid = "", name = "", score = 0 } = {}) {
  return {
    season,
    accepted: false,
    currentEntry: {
      playerId,
      uid,
      nicknameSnapshot: name,
      name,
      score,
      submittedAt: new Date().toISOString()
    },
    rank: null,
    totalPlayers: 0,
    rankings: []
  };
}
