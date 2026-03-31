import { getAppPort, getRankingApiBaseUrl, getRankingPort } from "./servers/shared/config.mjs";
import { startAppServer } from "./servers/app-server.mjs";
import { startRankingServer } from "./servers/ranking-server.mjs";

const rankingPort = getRankingPort();
const rankingApiBaseUrl = getRankingApiBaseUrl();
const appPort = getAppPort();

await startRankingServer({ port: rankingPort });
await startAppServer({ port: appPort, rankingApiBaseUrl });

console.log(`App server is running on http://localhost:${appPort}`);
console.log(`Ranking server is running on ${rankingApiBaseUrl}`);
