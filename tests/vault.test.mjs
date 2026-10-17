import test from "node:test";
import assert from "node:assert/strict";
import { decryptVaultSecret, encryptVaultSecret } from "../src/security/vault.js";

const password = "correct horse battery staple 2026";

test("encrypts a secret and restores it with the same password", async () => {
  const secret = "test-only recovery material — never use a real phrase in tests";
  const envelope = await encryptVaultSecret(secret, password);
  assert.equal(envelope.format, "veylora-vault");
  assert.equal(envelope.version, 1);
  assert.equal("password" in envelope, false);
  assert.equal("secret" in envelope, false);
  assert.notEqual(envelope.ciphertext, secret);
  assert.equal(await decryptVaultSecret(envelope, password), secret);
});

test("uses a fresh salt and IV for every encryption", async () => {
  const a = await encryptVaultSecret("same secret", password);
  const b = await encryptVaultSecret("same secret", password);
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.ciphertext, b.ciphertext);
});

test("rejects a wrong password and modified ciphertext", async () => {
  const envelope = await encryptVaultSecret("private test data", password);
  await assert.rejects(
    decryptVaultSecret(envelope, "wrong password long enough"),
    /Unable to unlock vault/,
  );
  const tampered = { ...envelope, ciphertext: envelope.ciphertext.slice(0, -4) + "AAAA" };
  await assert.rejects(decryptVaultSecret(tampered, password));
});

test("rejects weak passwords, empty secrets, and unknown envelope versions", async () => {
  await assert.rejects(encryptVaultSecret("secret", "short"), /at least 12 characters/);
  await assert.rejects(encryptVaultSecret("", password), /non-empty secret/);
  const envelope = await encryptVaultSecret("private test data", password);
  await assert.rejects(
    decryptVaultSecret({ ...envelope, version: 99 }, password),
    /Unsupported or invalid/,
  );
});
