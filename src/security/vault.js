/**
 * Veylora local vault primitive.
 *
 * Browser Web Crypto only. This module encrypts an already-created secret; it
 * does NOT generate mnemonics, derive Zcash keys, or prove transactions.
 */
const ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const VAULT_CONTEXT = new TextEncoder().encode("veylora-local-vault:v1");

function webCrypto() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error("Secure Web Crypto is unavailable in this environment.");
  }
  return globalThis.crypto;
}

function toBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < 12) {
    throw new Error("Use a wallet password with at least 12 characters.");
  }
  if (password.length > 1024) throw new Error("Password is too long.");
}

async function deriveKey(password, salt) {
  const crypto = webCrypto();
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt a secret string for local persistence. Store only the returned
 * envelope; never store the password or plaintext alongside it.
 */
export async function encryptVaultSecret(secret, password) {
  if (typeof secret !== "string" || secret.length === 0) {
    throw new Error("A non-empty secret is required.");
  }
  if (secret.length > 100_000) throw new Error("Secret is too large.");
  validatePassword(password);

  const crypto = webCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: VAULT_CONTEXT, tagLength: 128 },
    key,
    new TextEncoder().encode(secret),
  );

  return Object.freeze({
    format: "veylora-vault",
    version: 1,
    kdf: "PBKDF2-SHA-256",
    iterations: ITERATIONS,
    cipher: "AES-256-GCM",
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  });
}

/** Decrypt an envelope. Wrong passwords and tampering fail closed. */
export async function decryptVaultSecret(envelope, password) {
  validatePassword(password);
  if (
    !envelope ||
    envelope.format !== "veylora-vault" ||
    envelope.version !== 1 ||
    envelope.kdf !== "PBKDF2-SHA-256" ||
    envelope.iterations !== ITERATIONS ||
    envelope.cipher !== "AES-256-GCM" ||
    typeof envelope.salt !== "string" ||
    typeof envelope.iv !== "string" ||
    typeof envelope.ciphertext !== "string"
  ) {
    throw new Error("Unsupported or invalid vault envelope.");
  }

  const salt = fromBase64(envelope.salt);
  const iv = fromBase64(envelope.iv);
  const ciphertext = fromBase64(envelope.ciphertext);
  if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES || ciphertext.length < 16) {
    throw new Error("Invalid vault envelope encoding.");
  }

  const crypto = webCrypto();
  const key = await deriveKey(password, salt);
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: VAULT_CONTEXT, tagLength: 128 },
      key,
      ciphertext,
    );
    return new TextDecoder("utf-8", { fatal: true }).decode(plaintext);
  } catch {
    throw new Error("Unable to unlock vault: password is incorrect or data was modified.");
  }
}
