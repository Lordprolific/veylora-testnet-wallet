import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("receive view requires a derived address, not a completed chain sync", () => {
  const receiveView = source.match(/async function receiveView\(\) \{([\s\S]*?)\n\}\n\nasync function runSync/);
  assert.ok(receiveView, "receiveView function should exist");
  assert.match(receiveView[1], /if \(!engineState \|\| !getUnlockedRecoveryPhrase\(\)\)/);
  assert.doesNotMatch(receiveView[1], /syncVerified/);
});

test("receive navigation follows address readiness, while send remains scan-gated", () => {
  const receiveNav = source.split("\n").find((line) => line.includes('data-action="receive"') && line.includes('<button class="nav'));
  assert.ok(receiveNav);
  assert.match(receiveNav, /engineState/);
  assert.doesNotMatch(receiveNav, /syncVerified/);
  assert.match(source, /function sendView\(\) \{\s*if \(!syncVerified \|\| !engineState/);
});

test("sync completion and failure preserve receive access when an address exists", () => {
  assert.match(source, /receiveNav\.disabled = !engineState/);
  assert.match(source, /if \(receiveNav\) \{ receiveNav\.disabled = false; receiveNav\.classList\.remove\("disabled-nav"\)/);
});

test("homepage does not show the blanket deposit warning", () => {
  assert.doesNotMatch(source, /Do not deposit testnet funds yet/);
  assert.match(source, /Testnet workspace/);
});

test("premium styles respect reduced-motion preferences", () => {
  assert.match(styles, /prefers-reduced-motion:reduce/);
  assert.match(styles, /\.info-notice/);
});

test("WebZjs engine dependency is declared", () => {
  assert.equal(packageJson.dependencies["@chainsafe/webzjs-wallet"], "0.1.0");
});
