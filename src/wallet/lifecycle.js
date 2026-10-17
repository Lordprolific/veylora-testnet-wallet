import { generateMnemonic, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { encryptVaultSecret, decryptVaultSecret } from "../security/vault.js";

const VAULT_KEY = "veylora.encrypted-vault.v1";
const DB_KEY = "veylora.encrypted-wallet-db.v1";
let unlockedPhrase = null;
let unlockedDatabase = null;

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
  unlockedPhrase = normalized;
  unlockedDatabase = null;
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
  unlockedDatabase = { accountId, database: new Uint8Array(database) };
}

export function getUnlockedWalletDatabase() {
  if (!unlockedDatabase) return null;
  return { accountId: unlockedDatabase.accountId, database: new Uint8Array(unlockedDatabase.database) };
}

export async function restoreEncryptedVault(phrase, password, replaceExisting = false) {
  if (vaultExists() && !replaceExisting) throw new Error("A vault already exists. Confirm replacement before overwriting it.");
  const normalized = validateRecoveryPhrase(phrase);
  const envelope = await encryptVaultSecret(normalized, password);
  localStorage.setItem(VAULT_KEY, JSON.stringify(envelope));
  localStorage.removeItem(DB_KEY);
  unlockedPhrase = normalized;
  unlockedDatabase = null;
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
  unlockedPhrase = phrase;
  unlockedDatabase = null;
  const databaseEnvelope = localStorage.getItem(DB_KEY);
  if (databaseEnvelope) {
    try {
      const databasePayload = await decryptVaultSecret(JSON.parse(databaseEnvelope), password);
      const parsed = JSON.parse(databasePayload);
      if (!Number.isInteger(parsed.accountId) || parsed.accountId < 0 || typeof parsed.database !== "string") {
        throw new Error("Invalid encrypted wallet database payload.");
      }
      const binary = atob(parsed.database);
      const database = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      if (database.length === 0) throw new Error("Empty wallet database.");
      unlockedDatabase = { accountId: parsed.accountId, database };
    } catch {
      unlockedPhrase = null;
      throw new Error("The encrypted wallet database could not be unlocked. Do not overwrite it; restore using your recovery phrase.");
    }
  }
  return phrase;
}

export async function verifyWalletPassword(password) {
  const serialized = localStorage.getItem(VAULT_KEY);
  if (!serialized) throw new Error("No local vault was found.");
  let envelope;
  try { envelope = JSON.parse(serialized); } catch { throw new Error("The local vault is damaged."); }
  const phrase = validateRecoveryPhrase(await decryptVaultSecret(envelope, password));
  const current = getUnlockedRecoveryPhrase();
  if (current && phrase !== current) throw new Error("That password does not unlock the currently active wallet.");
  return true;
}

export function getUnlockedRecoveryPhrase() {
  return unlockedPhrase ? validateRecoveryPhrase(unlockedPhrase) : null;
}

export function lockVault() {
  unlockedPhrase = null;
  unlockedDatabase = null;
}

export function deleteLocalVault() {
  lockVault();
  localStorage.removeItem(VAULT_KEY);
  localStorage.removeItem(DB_KEY);
}
