# Provider integration contract

**Status: proposal only.** This document is a checklist for evaluating a real provider. It is not an API specification and does not claim any particular wallet implements these methods.

## Why this comes first

A browser extension that looks like a wallet is not, by itself, a wallet. Before account access or transaction signing is implemented, we must select a maintained Zcash wallet engine/provider and verify its source availability, license, documented interface, supported network, and security model.

## Capabilities to verify

- [ ] The provider explicitly identifies Zcash testnet and cannot silently fall back to mainnet.
- [ ] A dApp must request permission before it can read an account.
- [ ] The user can approve or reject each connection request.
- [ ] Account and network responses follow the provider's documented schema.
- [ ] Transaction details are previewed before the user confirms signing.
- [ ] Rejections and provider errors are returned clearly and safely.
- [ ] Shielded-address and shielded-transaction support is documented rather than inferred.
- [ ] The project license permits the intended integration and distribution.

## Integration rules

1. Do not invent provider object names or method names.
2. Keep provider calls behind a small typed adapter so the rest of the app is provider-agnostic.
3. Treat provider output as untrusted input and validate it at the boundary.
4. Never request a seed phrase or private key from a dApp.
5. Do not store keys in extension local storage or page-accessible JavaScript.
6. Ask for the minimum browser permissions required.
7. Make network identity visible before any transaction confirmation.
8. Start with read-only connection and account display; add signing only after the engine and user-confirmation path are verified.

## Conceptual internal adapter

The eventual adapter should expose a small internal interface such as:

- getProviderStatus() — report whether a verified provider is available.
- requestAccountAccess() — request explicit user permission.
- getNetwork() — return the provider-reported network.
- getAccounts() — return accounts only after permission.
- requestTransaction() — only when the provider documents and supports the transaction type.

These are **internal Veylora names**, not claims about an existing Zcash provider API. Their implementation must map to real documented methods.

## Definition of done for the first dApp demo

- The dApp detects the verified provider without throwing when it is absent.
- The user explicitly approves account access.
- The UI displays the actual network and provider-returned account information.
- The demo clearly rejects or warns if the network is not testnet.
- No fake balances, transactions, signatures, or success states are displayed.
- Tests cover absent provider, rejected access, malformed responses, and wrong-network states.
