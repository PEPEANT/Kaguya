import { getRankingApiUrl } from "../config/runtime.js";

export async function fetchRankings() {
  const response = await fetch(getRankingApiUrl("/api/rankings"), { cache: "no-store" });

  if (!response.ok) {
    throw new Error("ranking fetch failed");
  }

  return response.json();
}

export async function submitScore({ name, score }) {
  const response = await fetch(getRankingApiUrl("/api/rankings"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name, score })
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "save failed");
  }

  return payload;
}
