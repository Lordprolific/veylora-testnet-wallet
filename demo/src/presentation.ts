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
