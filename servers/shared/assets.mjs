import { promises as fs } from "node:fs";
import path from "node:path";

const ALLOWED_ASSET_DIRS = new Set(["scene", "character", "item", "special"]);

export function isAllowedAssetPath(relativePath) {
  const normalized = relativePath.replace(/\\/g, "/");
  const parts = normalized.split("/");

  if (parts.length !== 2) {
    return false;
  }

  const [directory, filename] = parts;
  return ALLOWED_ASSET_DIRS.has(directory) && /^[A-Za-z0-9_-]+\.(png|jpg|jpeg)$/u.test(filename);
}

export async function resolvePublicFile(publicDir, urlPath) {
  const requestedPath = urlPath === "/" ? "/index.html" : urlPath;
  const resolvedPath = path.resolve(publicDir, `.${requestedPath}`);

  if (!resolvedPath.startsWith(publicDir)) {
    return null;
  }

  try {
    const stats = await fs.stat(resolvedPath);
    return stats.isFile() ? resolvedPath : null;
  } catch {
    return null;
  }
}

export async function resolveRootImageFile(baseDir, filename) {
  if (!/^[A-Za-z0-9_-]+\.(png|jpg|jpeg)$/u.test(filename)) {
    return null;
  }

  const absolutePath = path.resolve(baseDir, filename);

  if (!absolutePath.startsWith(baseDir)) {
    return null;
  }

  try {
    const stats = await fs.stat(absolutePath);
    return stats.isFile() ? absolutePath : null;
  } catch {
    return null;
  }
}

export function resolveAssetFile(baseDir, relativePath) {
  if (!isAllowedAssetPath(relativePath)) {
    return null;
  }

  const absolutePath = path.resolve(baseDir, relativePath);
  return absolutePath.startsWith(baseDir) ? absolutePath : null;
}
