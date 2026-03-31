import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { CHROMA_KEY_CONFIG } from "../config/chroma-key.config.mjs";
import { ASSET_DEFINITIONS } from "../public/game/config/assets.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT_DIR, "processed-assets");

function applyChromaKey(pixelBuffer) {
  let transparentPixels = 0;

  for (let index = 0; index < pixelBuffer.length; index += 4) {
    const red = pixelBuffer[index];
    const green = pixelBuffer[index + 1];
    const blue = pixelBuffer[index + 2];
    const strongestOther = Math.max(red, blue);

    if (green > CHROMA_KEY_CONFIG.minGreen && green > strongestOther * CHROMA_KEY_CONFIG.dominanceRatio) {
      const distance = green - strongestOther;
      const nextAlpha = distance > CHROMA_KEY_CONFIG.fullTransparentDistance
        ? 0
        : Math.max(0, 255 - distance * CHROMA_KEY_CONFIG.fadeMultiplier);

      if (nextAlpha !== pixelBuffer[index + 3]) {
        transparentPixels += 1;
      }

      pixelBuffer[index + 3] = nextAlpha;
    }
  }

  return transparentPixels;
}

async function processAsset(definition) {
  const inputPath = path.join(ROOT_DIR, definition.file);
  const outputPath = path.join(OUTPUT_DIR, definition.file);
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelBuffer = Buffer.from(data);
  const transparentPixels = applyChromaKey(pixelBuffer);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(pixelBuffer, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels
    }
  }).png().toFile(outputPath);

  return {
    key: definition.key,
    file: definition.file,
    transparentPixels
  };
}

async function main() {
  const targets = ASSET_DEFINITIONS.filter((definition) => definition.chromaKey);
  const report = [];

  for (const definition of targets) {
    report.push(await processAsset(definition));
  }

  const reportPath = path.join(OUTPUT_DIR, "chroma-key-report.json");
  await fs.writeFile(reportPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    config: CHROMA_KEY_CONFIG,
    assets: report
  }, null, 2)}\n`, "utf8");

  console.log(`Processed ${report.length} chroma-key assets into ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
