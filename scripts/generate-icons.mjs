import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const svgPath = resolve(root, "public/assets/veylora-mark.svg");
const outputDir = resolve(root, "public/icons");
const svg = readFileSync(svgPath);
mkdirSync(outputDir, { recursive: true });

for (const size of [16, 48, 128]) {
  await sharp(svg)
    .resize(size, size, { fit: "contain" })
    .flatten({ background: "#090a0c" })
    .png()
    .toFile(resolve(outputDir, `icon${size}.png`));
}

console.log("Generated Chrome extension icons from the official Veylora mark.");
