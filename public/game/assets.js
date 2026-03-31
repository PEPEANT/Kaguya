import { ASSET_DEFINITIONS } from "./config/assets.js";
import { getAssetBaseUrl, getProcessedAssetBaseUrl } from "./config/runtime.js";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`${src} load failed`));
    image.src = src;
  });
}

function joinUrl(basePath, filePath) {
  if (!basePath) {
    return `/${filePath}`;
  }

  return `${basePath}/${filePath}`;
}

function getAssetUrl(definition) {
  const basePath = definition.chromaKey ? getProcessedAssetBaseUrl() : getAssetBaseUrl();
  return joinUrl(basePath, definition.file);
}

export async function loadAssets() {
  const assets = await Promise.all(
    ASSET_DEFINITIONS.map(async (definition) => [
      definition.key,
      await loadImage(getAssetUrl(definition))
    ])
  );

  return Object.fromEntries(assets);
}
