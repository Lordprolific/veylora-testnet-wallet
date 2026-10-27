import { cpSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const publicDir = resolve(root, "public");
const distDir = resolve(root, "dist");
mkdirSync(distDir, { recursive: true });

// These files are referenced by manifest.json at the extension ZIP root.
// Keep every declared extension resource beside the manifest, not only in public/.
for (const file of ["manifest.json", "background.js", "dapp-content.js", "dapp-provider.js"]) {
  const source = resolve(publicDir, file);
  if (!existsSync(source)) throw new Error(`Required extension file is missing: public/${file}`);
  copyFileSync(source, resolve(distDir, file));
}

for (const directory of ["assets", "licenses", "icons"]) {
  const source = resolve(publicDir, directory);
  if (existsSync(source)) cpSync(source, resolve(distDir, directory), { recursive: true, force: true });
}

for (const file of ["wallet.html", "popup.html", "dapp-content.js", "dapp-provider.js", "background.js", "manifest.json"]) {
  if (!existsSync(resolve(distDir, file))) throw new Error(`Required extension file is missing from dist: ${file}`);
}

const manifest = JSON.parse(await (await import("node:fs/promises")).readFile(resolve(distDir, "manifest.json"), "utf8"));
const contentScripts = (manifest.content_scripts || []).flatMap((entry) => entry.js || []);
if (contentScripts.includes("dapp-content.js") && !existsSync(resolve(distDir, "dapp-content.js"))) {
  throw new Error("manifest.json references dapp-content.js but it is absent from dist/");
}
for (const resource of (manifest.web_accessible_resources || []).flatMap((entry) => entry.resources || [])) {
  if (!existsSync(resolve(distDir, resource))) throw new Error(`Manifest web-accessible resource is missing from dist: ${resource}`);
}

console.log("Copied and verified Manifest V3 metadata, service worker, dApp bridge, wallet entries, and local assets into dist/");
