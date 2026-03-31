import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getAppPort, getRankingApiBaseUrl, PROCESSED_ASSETS_DIR, PUBLIC_DIR, ROOT_DIR } from "./shared/config.mjs";
import { resolveAssetFile, resolvePublicFile, resolveRootImageFile } from "./shared/assets.mjs";
import { sendFile, sendJavaScript, sendJson, sendText } from "./shared/http.mjs";

function isDirectRun(moduleUrl) {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(moduleUrl);
}

function buildAppConfigScript(rankingApiBaseUrl) {
  return `window.__APP_CONFIG__ = Object.freeze(${JSON.stringify({
    rankingApiBaseUrl,
    assetBaseUrl: "",
    processedAssetBaseUrl: "/processed-assets"
  })});\n`;
}

export async function startAppServer({
  port = getAppPort(),
  rankingApiBaseUrl = getRankingApiBaseUrl()
} = {}) {
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const { pathname } = requestUrl;

    const handle = async () => {
      if (pathname === "/api/health" && request.method === "GET") {
        sendJson(response, 200, {
          ok: true,
          service: "app",
          rankingApiBaseUrl,
          now: new Date().toISOString()
        });
        return;
      }

      if (pathname === "/app-config.js" && request.method === "GET") {
        sendJavaScript(response, 200, buildAppConfigScript(rankingApiBaseUrl));
        return;
      }

      if (pathname === "/c0.png" && request.method === "GET") {
        const assetPath = await resolveRootImageFile(ROOT_DIR, "c0.png");

        if (!assetPath) {
          sendText(response, 404, "Asset not found.");
          return;
        }

        await sendFile(response, assetPath);
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
        const publicFile = await resolvePublicFile(PUBLIC_DIR, pathname);

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
