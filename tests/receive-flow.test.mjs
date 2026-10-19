import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("receive view is based on a derived address, not completed sync", () => {
  assert.ok(source.includes("async function receiveView()"));
  const start = source.indexOf("async function receiveView()");
  const end = source.indexOf("async function activityView", start);
  assert.ok(end > start, "activity view follows receive view");
  const receiveView = source.slice(start, end);
  assert.match(receiveView, /engineState/);
  assert.doesNotMatch(receiveView, /syncVerified/);
});

test("receive and send navigation are not gated on a history scan", () => {
  assert.doesNotMatch(source, /syncVerified/);
  assert.doesNotMatch(source, /Still scanning wallet history/);
  assert.match(source, /function sendView\(\)/);
});

test("wallet does not show sync progress UI", () => {
  assert.match(source, /wallet-dashboard/);
  assert.doesNotMatch(source, /sync-progress-copy/);
  assert.match(source, /async function activityView/);
});

test("homepage does not show the blanket deposit warning", () => {
  assert.doesNotMatch(source, /Do not deposit testnet funds yet/);
  assert.match(source, /Testnet workspace/);
});

test("premium styles respect reduced-motion preferences", () => {
  assert.match(styles, /prefers-reduced-motion:reduce/);
  assert.match(styles, /\.info-notice/);
});

test("WebZjs engine is supplied by the pinned build workflow, not the npm registry", () => {
  const workflow = readFileSync(new URL("../.github/workflows/standalone-wallet-build.yml", import.meta.url), "utf8");
  assert.equal(packageJson.dependencies["@chainsafe/webzjs-wallet"], undefined);
  assert.match(workflow, /webzjs-wasm-packages-veylora-review-a50df944/);
  assert.match(workflow, /cp -R \.engine\/packages\/webzjs-wallet node_modules\/\@chainsafe\/webzjs-wallet/);
});
