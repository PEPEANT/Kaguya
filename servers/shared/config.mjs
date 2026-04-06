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
export const RANKING_OPERATIONS_CLOSED = true;
export const RANKING_CURRENT_SEASON_ID = 2;
export const RANKING_CURRENT_SEASON_PERIOD = "2026.04.01 ~ 2026.04.06";
export const RANKING_CLOSURE_NOTICE = "\uC2DC\uBBAC\uB77C\uD06C DIS\uB294 \uC6D0\uC791 \uBC0F \uC6D0\uC791\uC790\uC758 \uAD8C\uB9AC\uB97C \uC874\uC911\uD569\uB2C8\uB2E4. \uAD00\uB828 \uAC00\uC774\uB4DC\uB77C\uC778\uC744 \uC900\uC218\uD558\uAE30 \uC704\uD574 \uC5C5\uB370\uC774\uD2B8 \uBC30\uD3EC\uB97C \uC911\uB2E8\uD558\uBA70, \uC2DC\uC98C 1 \uB7AD\uD0B9 \uC6B4\uC601 \uB610\uD55C \uD568\uAED8 \uC885\uB8CC\uB429\uB2C8\uB2E4. \uADF8\uB3D9\uC548 \uD568\uAED8\uD574\uC8FC\uC154\uC11C \uAC10\uC0AC\uD569\uB2C8\uB2E4.";

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
