import { promises as fs } from "node:fs";
import path from "node:path";

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

export function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(payload));
}

export function sendJavaScript(response, statusCode, code) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "text/javascript; charset=utf-8",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(code);
}

export function sendText(response, statusCode, text) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(text);
}

export async function sendFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || "application/octet-stream";
  const fileBuffer = await fs.readFile(filePath);

  response.writeHead(200, {
    "Cache-Control": [".png", ".jpg", ".jpeg"].includes(extension) ? "public, max-age=3600" : "no-store",
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff"
  });
  response.end(fileBuffer);
}
