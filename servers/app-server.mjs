import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { handleAdminApiRequest } from "./admin-api.mjs";
import {
  getAppPort,
  getRankingApiBaseUrl,
  PROCESSED_ASSETS_DIR,
  PUBLIC_DIR,
  RANKING_CLOSURE_NOTICE,
  RANKING_CURRENT_SEASON_ID,
  RANKING_CURRENT_SEASON_PERIOD,
  RANKING_OPERATIONS_CLOSED,
  ROOT_DIR
} from "./shared/config.mjs";
import { resolveAssetFile, resolvePublicFile } from "./shared/assets.mjs";
import { sendFile, sendJavaScript, sendJson, sendText } from "./shared/http.mjs";

function isDirectRun(moduleUrl) {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(moduleUrl);
}

function shouldRedirectLoopbackHost(requestUrl) {
  return ["127.0.0.1", "[::1]", "::1"].includes(requestUrl.hostname);
}

function getCanonicalLoopbackUrl(requestUrl, fallbackPort) {
  const redirectUrl = new URL(requestUrl.toString());
  redirectUrl.hostname = "localhost";
  redirectUrl.port = requestUrl.port || String(fallbackPort);
  return redirectUrl.toString();
}

function buildAppConfigScript(rankingApiBaseUrl) {
  return `window.__APP_CONFIG__ = Object.freeze(${JSON.stringify({
    rankingProvider: "firebase",
    rankingApiBaseUrl,
    adminApiBaseUrl: "",
    assetBaseUrl: "",
    processedAssetBaseUrl: "/processed-assets",
    rankingClosed: RANKING_OPERATIONS_CLOSED,
    rankingClosureNotice: RANKING_CLOSURE_NOTICE,
    rankingSeasons: {
      currentSeason: RANKING_CURRENT_SEASON_ID,
      seasons: [
        {
          id: 2,
          kind: "season",
          displayName: "시즌 1",
          status: "archived",
          period: RANKING_CURRENT_SEASON_PERIOD,
          firebaseCollection: "rankings_season2"
        },
        {
          id: 1,
          kind: "preseason",
          displayName: "시즌 0",
          status: "archived",
          period: "2026.03.31 ~ 2026.04.01",
          firebaseCollection: "rankings"
        }
      ]
    },
    gameContent: {
      currentSeasonId: "s2",
      seasons: [
        {
          id: "s1",
          displayName: "시즌 1",
          notes: "Current live gameplay snapshot"
        },
        {
          id: "s2",
          displayName: "시즌 2",
          notes: "Upcoming gameplay workspace"
        }
      ]
    },
    adminAccess: {
      requiresSignIn: true,
      allowedEmails: String(process.env.ADMIN_ALLOWED_EMAILS || "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    },
    firebase: {
      apiKey: "AIzaSyCVk-H_DkZfbo_KaEg9C3Kq1ij4ziHmW6M",
      authDomain: "kaguya-snack-rush.firebaseapp.com",
      projectId: "kaguya-snack-rush",
      storageBucket: "kaguya-snack-rush.firebasestorage.app",
      messagingSenderId: "594120586215",
      appId: "1:594120586215:web:c7e8a99519d6b4335e0342",
      measurementId: "G-GRSREBV6S9"
    }
  })});\n`;
}

export async function startAppServer({
  port = getAppPort(),
  rankingApiBaseUrl = getRankingApiBaseUrl()
} = {}) {
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const { pathname } = requestUrl;
    const publicPathname = pathname.startsWith("/public/")
      ? pathname.slice("/public".length)
      : pathname;

    const handle = async () => {
      if (["GET", "HEAD"].includes(request.method || "GET") && shouldRedirectLoopbackHost(requestUrl)) {
        response.writeHead(307, {
          Location: getCanonicalLoopbackUrl(requestUrl, port),
          "Cache-Control": "no-store"
        });
        response.end();
        return;
      }

      if (pathname === "/api/health" && request.method === "GET") {
        sendJson(response, 200, {
          ok: true,
          service: "app",
          rankingApiBaseUrl,
          now: new Date().toISOString()
        });
        return;
      }

      if (pathname === "/api/admin/action") {
        await handleAdminApiRequest(request, response, requestUrl);
        return;
      }

      if ((pathname === "/app-config.js" || pathname === "/public/app-config.js") && request.method === "GET") {
        sendJavaScript(response, 200, buildAppConfigScript(rankingApiBaseUrl));
        return;
      }

      if (pathname.startsWith("/assets/") && request.method === "GET") {
        const relativePath = decodeURIComponent(pathname.slice("/assets/".length)).replace(/\\/g, "/");
        const assetPath = resolveAssetFile(ROOT_DIR, relativePath);

        if (!assetPath) {
          sendText(response, 404, "Asset not found.");
          return;
        }

        await sendFile(response, assetPath);
        return;
      }

      const directAssetMatch = pathname.match(/^\/(scene|character|item|special)\/(.+)$/u);
      if (directAssetMatch && request.method === "GET") {
        const relativePath = `${directAssetMatch[1]}/${directAssetMatch[2]}`;
        const assetPath = resolveAssetFile(ROOT_DIR, relativePath);

        if (!assetPath) {
          sendText(response, 404, "Asset not found.");
          return;
        }

        await sendFile(response, assetPath);
        return;
      }

      if (pathname.startsWith("/processed-assets/") && request.method === "GET") {
        const relativePath = decodeURIComponent(pathname.slice("/processed-assets/".length)).replace(/\\/g, "/");
        const assetPath = resolveAssetFile(PROCESSED_ASSETS_DIR, relativePath);

        if (!assetPath) {
          sendText(response, 404, "Processed asset not found.");
          return;
        }

        await sendFile(response, assetPath);
        return;
      }

      if (request.method === "GET") {
        const publicFile = await resolvePublicFile(PUBLIC_DIR, publicPathname);

        if (publicFile) {
          await sendFile(response, publicFile);
          return;
        }
      }

      sendText(response, 404, "Not found.");
    };

    handle().catch((error) => {
      console.error(error);
      sendJson(response, 500, { error: "App server error." });
    });
  });

  await new Promise((resolve) => server.listen(port, resolve));
  return server;
}

if (isDirectRun(import.meta.url)) {
  const port = Number(process.env.PORT || getAppPort());
  const rankingApiBaseUrl = getRankingApiBaseUrl();
  await startAppServer({ port, rankingApiBaseUrl });
  console.log(`App server is running on http://localhost:${port}`);
  console.log(`App server points ranking requests to ${rankingApiBaseUrl}`);
}
