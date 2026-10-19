import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("receive view requires a derived address, not a completed chain sync", () => {
  const receiveView = source.match(/async function receiveView\(\) \{([\s\S]*?)
\}

async function activityView/);
  assert.ok(receiveView, "receiveView function should exist");
  assert.match(receiveView[1], /if \(!engineState \|\| !getUnlockedRecoveryPhrase\(\)\)/);
  assert.doesNotMatch(receiveView[1], /syncVerified/);
});

test("receive and send navigation are available after address initialization without scan gating", () => {
  const receiveNav = source.split("
").find((line) => line.includes('data-action="receive"') && line.includes('<button class="nav'));
  assert.ok(receiveNav);
  assert.match(receiveNav, /engineState/);
  assert.doesNotMatch(receiveNav, /syncVerified/);
  assert.match(source, /function sendView\(\) \{\s*if \(!engineState \|\| !getUnlockedRecoveryPhrase\(\)\)/);
});

test("wallet navigation is not blocked by sync state", () => {
  assert.doesNotMatch(source, /receiveNav\.disabled = !engineState/);
  assert.doesNotMatch(source, /syncVerified/);
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
  assert.match(workflow, /cp -R \.engine\/packages\/webzjs-wallet node_modules\/@chainsafe\/webzjs-wallet/);
});


test("wallet dashboard opens without history scan UI and includes activity view", () => {
  assert.match(source, /wallet-dashboard/);
  assert.doesNotMatch(source, /sync-progress-copy/);
  assert.match(source, /async function activityView/);
  assert.doesNotMatch(source, /Still scanning wallet history/);
});

test("recovery does not ask users to choose a history scan mode", () => {
  assert.doesNotMatch(source, /new-testnet-wallet/);
  assert.doesNotMatch(source, /Full-history recovery can take significantly longer/);
});
