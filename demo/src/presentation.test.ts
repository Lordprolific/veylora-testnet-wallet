import { describe, expect, it } from "vitest";
import { formatBalance, shortenAddress } from "./presentation";

describe("shortenAddress", () => {
  it("does not alter short values", () => {
    expect(shortenAddress("t1short")).toBe("t1short");
  });

  it("shortens long values without losing the ends", () => {
    expect(shortenAddress("t1abcdefghijklmnoqrstuvwxyz")).toBe("t1abcdefghij…qrstuvwxyz".replace("qrstuvwxyz", "stuvwxyz"));
  });

  it("does not render non-string values as addresses", () => {
    expect(shortenAddress(undefined)).toBe("Not shared");
    expect(shortenAddress("")).toBe("Not shared");
    expect(shortenAddress(123)).toBe("Not shared");
  });
});

describe("formatBalance", () => {
  it("formats values returned by the provider", () => {
    expect(formatBalance({ available: "1.25", shielded: "0.5" })).toBe("Available: 1.25 · Shielded: 0.5");
  });

  it("does not invent missing balances", () => {
    expect(formatBalance({})).toBe("Available: Unavailable · Shielded: Unavailable");
  });
});
