import test from "node:test";
import assert from "node:assert/strict";
import { createRecoveryPhrase, validateRecoveryPhrase } from "../src/wallet/lifecycle.js";

test("secure generator returns a valid 24-word recovery phrase", () => {
  const phrase = createRecoveryPhrase();
  assert.equal(phrase.split(" ").length, 24);
  assert.equal(validateRecoveryPhrase(phrase), phrase);
});

test("generated recovery phrases are not repeated", () => {
  const first = createRecoveryPhrase();
  const second = createRecoveryPhrase();
  assert.notEqual(first, second);
});

test("invalid phrase is rejected", () => {
  assert.throws(() => validateRecoveryPhrase("one two three"), /must contain 24 words/);
});

test("valid phrase with wrong word count is rejected", () => {
  const phrase = createRecoveryPhrase().split(" ").slice(0, 12).join(" ");
  assert.throws(() => validateRecoveryPhrase(phrase), /valid 24-word BIP-39 phrase/);
});
