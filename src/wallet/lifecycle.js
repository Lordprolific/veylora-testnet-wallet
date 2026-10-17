import { generateMnemonic, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { encryptVaultSecret, decryptVaultSecret } from "../security/vault.js";

const VAULT_KEY = "veylora.encrypted-vault.v1";
const SESSION_KEY = "veylora.session-seed.v1";
const DB_KEY = "veylora.encrypted-wallet-db.v1";
const DB_SESSION_KEY = "veylora.session-wallet-db.v1";

/** Generate 24 BIP-39 words using the browser's cryptographically secure RNG. */
export function createRecoveryPhrase() {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Secure randomness is unavailable. Wallet creation is blocked.");
  }
  return generateMnemonic(wordlist, 256);
}

export function validateRecoveryPhrase(phrase) {
  const normalized = String(phrase ?? "").trim().toLowerCase().split(/\s+/).join(" ");
  if (!validateMnemonic(normalized, wordlist)) {
    throw new Error("That recovery phrase is not a valid 24-word BIP-39 phrase.");
  }
  if (normalized.split(" ").length !== 24) {
    throw new Error("Veylora recovery phrases must contain 24 words.");
  }
  return normalized;
}

export function vaultExists() {
  return Boolean(localStorage.getItem(VAULT_KEY));
}

export async function createEncryptedVault(phrase, password) {
  if (vaultExists()) throw new Error("A local vault already exists. Unlock it or restore only after removing the existing vault.");
  const normalized = validateRecoveryPhrase(phrase);
  const envelope = await encryptVaultSecret(normalized, password);
  localStorage.setItem(VAULT_KEY, JSON.stringify(envelope));
  sessionStorage.setItem(SESSION_KEY, normalized);
  return true;
}

export async function persistEncryptedWalletDatabase(database, accountId, password) {
  if (!(database instanceof Uint8Array) || database.length === 0) throw new Error("The wallet database is empty; nothing was persisted.");
  if (!Number.isInteger(accountId) || accountId < 0) throw new Error("Invalid wallet account identifier.");
  let binary = "";
  for (const byte of database) binary += String.fromCharCode(byte);
  const payload = JSON.stringify({ accountId, database: btoa(binary) });
  const envelope = await encryptVaultSecret(payload, password);
  localStorage.setItem(DB_KEY, JSON.stringify(envelope));
  sessionStorage.setItem(DB_SESSION_KEY, payload);
}

export function getUnlockedWalletDatabase() {
  const payload = sessionStorage.getItem(DB_SESSION_KEY);
  if (!payload) return null;
  try {
    const parsed = JSON.parse(payload);
    const binary = atob(parsed.database);
    const database = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    if (!Number.isInteger(parsed.accountId) || parsed.accountId < 0 || database.length === 0) return null;
    return { accountId: parsed.accountId, database };
  } catch { return null; }
}

export async function restoreEncryptedVault(phrase, password, replaceExisting = false) {
  if (vaultExists() && !replaceExisting) throw new Error("A vault already exists. Confirm replacement before overwriting it.");
  const normalized = validateRecoveryPhrase(phrase);
  const envelope = await encryptVaultSecret(normalized, password);
  localStorage.setItem(VAULT_KEY, JSON.stringify(envelope));
  sessionStorage.setItem(SESSION_KEY, normalized);
  sessionStorage.removeItem(DB_SESSION_KEY);
  localStorage.removeItem(DB_KEY);
  return true;
}

export async function unlockVault(password) {
  const serialized = localStorage.getItem(VAULT_KEY);
  if (!serialized) throw new Error("No local vault was found. Create or restore a wallet first.");
  let envelope;
  try {
    envelope = JSON.parse(serialized);
  } catch {
    throw new Error("The local vault is damaged. Do not overwrite it; restore from your recovery phrase.");
  }
  const phrase = validateRecoveryPhrase(await decryptVaultSecret(envelope, password));
  sessionStorage.setItem(SESSION_KEY, phrase);
  sessionStorage.removeItem(DB_SESSION_KEY);
  const databaseEnvelope = localStorage.getItem(DB_KEY);
  if (databaseEnvelope) {
    try {
      const databasePayload = await decryptVaultSecret(JSON.parse(databaseEnvelope), password);
      const parsed = JSON.parse(databasePayload);
      if (Number.isInteger(parsed.accountId) && parsed.accountId >= 0 && typeof parsed.database === "string") {
        sessionStorage.setItem(DB_SESSION_KEY, databasePayload);
      }
    } catch {
      throw new Error("The encrypted wallet database could not be unlocked. Do not overwrite it; restore using your recovery phrase.");
    }
  }
  return phrase;
}

export function getUnlockedRecoveryPhrase() {
  const phrase = sessionStorage.getItem(SESSION_KEY);
  return phrase ? validateRecoveryPhrase(phrase) : null;
}

export function lockVault() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(DB_SESSION_KEY);
}

export function deleteLocalVault() {
  lockVault();
  localStorage.removeItem(VAULT_KEY);
}
