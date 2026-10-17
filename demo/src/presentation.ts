export function shortenAddress(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "Not shared";
  return value.length <= 24 ? value : value.slice(0, 12) + "…" + value.slice(-8);
}

export function formatBalance(result: {
  available?: unknown;
  shielded?: unknown;
}): string {
  const available = result.available == null ? "Unavailable" : String(result.available);
  const shielded = result.shielded == null ? "Unavailable" : String(result.shielded);
  return "Available: " + available + " · Shielded: " + shielded;
}

export function isSupportedTestnetAddress(address: string): boolean {
  // Format guard only; the dApp cannot prove the wallet's active network.
  return /^(utest1[0-9a-z]+|tm[1-9A-HJ-NP-Za-km-z]+|t2[1-9A-HJ-NP-Za-km-z]+|t3[1-9A-HJ-NP-Za-km-z]+)$/i.test(address.trim());
}

export function isValidZecAmount(amount: string): boolean {
  return /^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(amount.trim()) && Number(amount) > 0 && Number.isFinite(Number(amount));
}

export function memoByteLength(memo: string): number {
  return new TextEncoder().encode(memo).length;
}

export function supportsPrivateMemo(address: string): boolean {
  return address.trim().toLowerCase().startsWith("utest1");
}
