import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync } from "@scure/bip39";
import { secp256k1 } from "@noble/curves/secp256k1";
import { ripemd160 } from "@noble/hashes/ripemd160";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import bs58 from "bs58";

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
};
const doubleSha256 = (v: Uint8Array) => sha256(sha256(v));
const compactSize = (n: number) => n <= 252 ? new Uint8Array([n]) : new Uint8Array([253, n & 255, (n >> 8) & 255]);

/** Derive the Noir-compatible Zcash testnet identity only to sign a site challenge. */
export function signMarketChallenge(phrase: string, message: string) {
  if (!phrase || !message || message.length > 4096) throw new Error("Invalid wallet sign-in challenge.");
  const seed = mnemonicToSeedSync(phrase);
  const node = HDKey.fromMasterSeed(seed).derive("m/44'/133'/2147483647'/0/0");
  if (!node.privateKey) throw new Error("Could not derive the wallet identity key.");
  const privateKey = node.privateKey;
  const pubkey = secp256k1.getPublicKey(privateKey, false);
  const pubkeyHex = bytesToHex(pubkey);
  const compressed = secp256k1.getPublicKey(privateKey, true);
  const pubkeyHash = ripemd160(sha256(compressed));
  const payload = concat(new Uint8Array([0x1d, 0x25]), pubkeyHash);
  const address = bs58.encode(concat(payload, doubleSha256(payload).slice(0, 4)));
  const prefix = "Zcash Signed Message:\n";
  const prefixBytes = new TextEncoder().encode(prefix);
  const msgBytes = new TextEncoder().encode(message);
  const hash = doubleSha256(concat(compactSize(prefix.length), prefixBytes, compactSize(message.length), msgBytes));
  const signature = secp256k1.sign(hash, privateKey, { lowS: true });
  const recovery = signature.recovery;
  if (recovery === undefined || recovery < 0 || recovery > 3) throw new Error("Could not produce a recoverable wallet signature.");
  const signatureHex = bytesToHex(concat(new Uint8Array([27 + recovery + 4]), signature.toCompactRawBytes()));
  return { signature: signatureHex, pubkey: pubkeyHex, address, signingMode: "derived", originAddress: "" };
}
