import { promises as fs } from "node:fs";

import { DATA_DIR, MAX_RANKINGS, RANKINGS_FILE } from "./config.mjs";

export async function ensureRankingStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(RANKINGS_FILE);
  } catch {
    await fs.writeFile(RANKINGS_FILE, "[]\n", "utf8");
  }
}

export function normalizeName(input) {
  if (typeof input !== "string") {
    return "";
  }

  const collapsed = input.trim().replace(/\s+/g, " ");
  return Array.from(collapsed).slice(0, 12).join("");
}

function compareRankings(left, right) {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  return String(left.submittedAt).localeCompare(String(right.submittedAt));
}

function sanitizeRankings(rawRankings) {
  const bestByName = new Map();

  for (const entry of Array.isArray(rawRankings) ? rawRankings : []) {
    const name = normalizeName(entry?.name);
    const score = Number(entry?.score);
    const submittedAt = typeof entry?.submittedAt === "string" ? entry.submittedAt : new Date(0).toISOString();

    if (!name || !Number.isFinite(score)) {
      continue;
    }

    const nextEntry = {
      name,
      score: Math.floor(score),
      submittedAt
    };

    const existing = bestByName.get(name);
    if (!existing || compareRankings(nextEntry, existing) < 0) {
      bestByName.set(name, nextEntry);
    }
  }

  return [...bestByName.values()].sort(compareRankings).slice(0, MAX_RANKINGS);
}

export async function readRankings() {
  try {
    const fileContents = await fs.readFile(RANKINGS_FILE, "utf8");
    return sanitizeRankings(JSON.parse(fileContents));
  } catch {
    return [];
  }
}

export async function writeRankings(rankings) {
  const nextRankings = sanitizeRankings(rankings);
  const tempPath = `${RANKINGS_FILE}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(nextRankings, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, RANKINGS_FILE);
  return nextRankings;
}

export async function submitRanking({ name, score }) {
  const safeName = normalizeName(name);
  const safeScore = Math.floor(Number(score));

  if (!safeName) {
    throw new Error("Nickname is required.");
  }

  if (!Number.isFinite(safeScore)) {
    throw new Error("Score is invalid.");
  }

  const rankings = await readRankings();
  const existing = rankings.find((entry) => entry.name === safeName);
  const submittedAt = new Date().toISOString();

  let accepted = false;
  let nextRankings = rankings;

  if (!existing || safeScore > existing.score) {
    const withoutCurrentPlayer = rankings.filter((entry) => entry.name !== safeName);
    nextRankings = await writeRankings([
      ...withoutCurrentPlayer,
      { name: safeName, score: safeScore, submittedAt }
    ]);
    accepted = true;
  } else {
    nextRankings = await writeRankings(rankings);
  }

  return {
    accepted,
    rank: nextRankings.findIndex((entry) => entry.name === safeName) + 1 || null,
    rankings: nextRankings
  };
}
