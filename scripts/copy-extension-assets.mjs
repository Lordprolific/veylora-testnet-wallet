import { cpSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const publicDir = resolve(root, "public");
const distDir = resolve(root, "dist");
mkdirSync(distDir, { recursive: true });

for (const file of ["manifest.json", "background.js"]) {
  const source = resolve(publicDir, file);
  if (!existsSync(source)) throw new Error(`Required extension file is missing: public/${file}`);
  copyFileSync(source, resolve(distDir, file));
}

for (const directory of ["assets", "licenses"]) {
  const source = resolve(publicDir, directory);
  if (existsSync(source)) cpSync(source, resolve(distDir, directory), { recursive: true, force: true });
}

console.log("Copied Manifest V3 metadata, service worker, and local assets into dist/");
