import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = path.resolve(__dirname, "../..");
export const PUBLIC_DIR = path.join(ROOT_DIR, "public");
export const DATA_DIR = path.join(ROOT_DIR, "data");
export const PROCESSED_ASSETS_DIR = path.join(ROOT_DIR, "processed-assets");
export const RANKINGS_FILE = path.join(DATA_DIR, "rankings.json");
export const MAX_RANKINGS = 10;
export const DEFAULT_APP_PORT = 3000;
export const DEFAULT_RANKING_PORT = 4000;

export function getAppPort() {
  return Number(process.env.APP_PORT || DEFAULT_APP_PORT);
}

export function getRankingPort() {
  return Number(process.env.RANKING_PORT || DEFAULT_RANKING_PORT);
}

export function getRankingApiBaseUrl() {
  return String(process.env.RANKING_API_BASE_URL || `http://localhost:${getRankingPort()}`).replace(/\/$/, "");
}

export function getRankingCorsOrigin() {
  return process.env.RANKING_CORS_ORIGIN || "*";
}

export function normalizeRankingSeason(input, fallback = 1) {
  const safeSeason = Math.floor(Number(input));
  return Number.isFinite(safeSeason) && safeSeason >= 1 ? safeSeason : fallback;
}

export function getSeasonRankingsFile(season) {
  const safeSeason = normalizeRankingSeason(season);
  return path.join(DATA_DIR, `rankings_season${safeSeason}.json`);
}
