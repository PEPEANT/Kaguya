import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  getRankingCorsOrigin,
  getRankingPort,
  normalizeRankingSeason,
  RANKING_CLOSURE_NOTICE,
  RANKING_OPERATIONS_CLOSED
} from "./shared/config.mjs";
import { sendJson, sendText } from "./shared/http.mjs";
import { ensureRankingStorage, isNicknameAvailable, readAllRankings, readRankings, submitRanking } from "./shared/rankings-store.mjs";

function isDirectRun(moduleUrl) {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(moduleUrl);
}

function setCorsHeaders(response, corsOrigin) {
  response.setHeader("Access-Control-Allow-Origin", corsOrigin);
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getRequestedSeason(requestUrl, fallback = 1) {
  return normalizeRankingSeason(requestUrl.searchParams.get("season"), fallback);
}

async function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 10_000) {
        reject(new Error("Request body too large."));
        request.destroy();
      }
    });

    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON payload."));
      }
    });

    request.on("error", reject);
  });
}

export async function startRankingServer({
  port = getRankingPort(),
  corsOrigin = getRankingCorsOrigin()
} = {}) {
  await ensureRankingStorage();

  const server = createServer((request, response) => {
    setCorsHeaders(response, corsOrigin);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const { pathname } = requestUrl;

    const handle = async () => {
      if (pathname === "/api/health" && request.method === "GET") {
        sendJson(response, 200, { ok: true, service: "ranking", now: new Date().toISOString() });
        return;
      }

      if (pathname === "/api/rankings" && request.method === "GET") {
        const season = getRequestedSeason(requestUrl);
        sendJson(response, 200, {
          season,
          rankings: await readRankings({ season })
        });
        return;
      }

      if (pathname === "/api/rankings/all" && request.method === "GET") {
        const season = getRequestedSeason(requestUrl);
        sendJson(response, 200, {
          season,
          rankings: await readAllRankings({ season })
        });
        return;
      }

      if (pathname === "/api/rankings/name-available" && request.method === "GET") {
        const season = getRequestedSeason(requestUrl);
        sendJson(response, 200, await isNicknameAvailable({
          season,
          playerId: requestUrl.searchParams.get("playerId"),
          name: requestUrl.searchParams.get("name")
        }));
        return;
      }

      if (pathname === "/api/rankings" && request.method === "POST") {
        if (RANKING_OPERATIONS_CLOSED) {
          sendJson(response, 403, {
            error: "Ranking submissions are closed.",
            notice: RANKING_CLOSURE_NOTICE
          });
          return;
        }

        const payload = await readJsonBody(request);
        sendJson(response, 200, await submitRanking({
          ...payload,
          season: normalizeRankingSeason(payload.season, 1)
        }));
        return;
      }

      sendText(response, 404, "Not found.");
    };

    handle().catch((error) => {
      const statusCode = error.message === "Nickname is required."
        || error.message === "Nickname is already taken."
        || error.message === "Score is invalid."
        || error.message === "Invalid JSON payload."
        ? 400
        : 500;

      sendJson(response, statusCode, {
        error: statusCode === 500 ? "Ranking server error." : error.message
      });
    });
  });

  await new Promise((resolve) => server.listen(port, resolve));
  return server;
}

if (isDirectRun(import.meta.url)) {
  const port = Number(process.env.PORT || getRankingPort());
  await startRankingServer({ port });
  console.log(`Ranking server is running on http://localhost:${port}`);
}
