import { describe, expect, it } from "vitest";
import { formatBalance, isSupportedTestnetAddress, isValidZecAmount, memoByteLength, shortenAddress, supportsPrivateMemo } from "./presentation";

describe("shortenAddress", () => {
  it("does not alter short values", () => expect(shortenAddress("t1short")).toBe("t1short"));
  it("shortens long values without losing their ends", () => {
    expect(shortenAddress("t1abcdefghijklmnoqrstuvwxyz")).toBe("t1abcdefghij…stuvwxyz");
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

describe("payment input guards", () => {
  it("recognizes the address formats used by this testnet lab", () => {
    expect(isSupportedTestnetAddress("utest1rz33qqexample")).toBe(true);
    expect(isSupportedTestnetAddress("tmERzYmExample123")).toBe(true);
    expect(isSupportedTestnetAddress("zs1mainnet-looking-address")).toBe(false);
    expect(isSupportedTestnetAddress("")).toBe(false);
  });
  it("accepts positive decimal ZEC amounts with at most 8 decimals", () => {
    expect(isValidZecAmount("0.001")).toBe(true);
    expect(isValidZecAmount("1")).toBe(true);
    expect(isValidZecAmount("0")).toBe(false);
    expect(isValidZecAmount("-1")).toBe(false);
    expect(isValidZecAmount("1.123456789")).toBe(false);
    expect(isValidZecAmount("1e-3")).toBe(false);
  });
  it("limits memo bytes and only enables private memos for shielded testnet addresses", () => {
    expect(memoByteLength("hello")).toBe(5);
    expect(memoByteLength("🙂")).toBe(4);
    expect(supportsPrivateMemo("utest1receiver")).toBe(true);
    expect(supportsPrivateMemo("tmTransparentReceiver")).toBe(false);
  });
});
