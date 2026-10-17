# Veylora Standalone Zcash Wallet: Engineering Plan

## Product definition

Veylora is intended to become a standalone, self-custodial Zcash wallet distributed as a Chrome Manifest V3 extension. It must not require Noir Wallet, and it must not be a dApp scanner or a provider wrapper.

The extension should eventually support wallet creation and recovery, local encrypted key storage, transparent and shielded addresses, balance synchronization, receive QR codes, reviewed outgoing payments, transaction history, network separation, account locking, and secure recovery.

## Engine decision

Candidate: [ChainSafe WebZjs](https://github.com/ChainSafe/WebZjs), an open-source JavaScript/WebAssembly Zcash wallet engine. Its documentation describes browser wallet support, seed-based account creation, lightwalletd synchronization, and shielded transaction proving. The repository offers MIT/Apache-2.0 licensing options.

Upstream README explicitly warns that the library is under development and unaudited. Its issue tracker also contains an open Manifest V3 content-security-policy/sync compatibility issue. Therefore, adopting WebZjs is a starting point for engineering and testing, not proof that a secure production wallet is ready.

Reference material:
- https://github.com/ChainSafe/WebZjs
- https://chainsafe.github.io/WebZjs/
- https://github.com/ChainSafe/WebZjs/issues/141
- https://github.com/ChainSafe/WebZjs/issues/149
- https://developer.chrome.com/docs/webstore/program-policies/policies

## Non-negotiable security rules

1. No seed phrase, private key, password, viewing key, or plaintext wallet database may leave the device.
2. Encrypt persisted secrets using a reviewed key-derivation and authenticated-encryption design; never treat Chrome local storage as encrypted secret storage.
3. Lock the wallet on explicit user action and after a configurable inactivity timeout.
4. Recovery words are shown only during a deliberate creation/recovery flow. Never put them in logs, analytics, error messages, URLs, clipboard automatically, or telemetry.
5. Transaction details must be displayed and explicitly confirmed before signing or broadcasting.
6. Do not claim a transaction is mined just because a broadcast returned a transaction ID.
7. Keep mainnet and testnet state, endpoints, and accounts strictly separated. Make network selection obvious and never silently switch networks.
8. Do not use real funds during development or automated testing.
9. Do not ship a seed-generation mock, fake balance, simulated transaction, or silent fallback that makes a failed engine look successful.
10. No public Chrome Web Store release before reproducible build checks, security review, end-to-end tests, and a clear privacy policy.

## Build sequence

### Phase 1 — wallet shell and reproducible build
- Replace the old provider-demo action with a standalone full-tab wallet.
- Establish a build pipeline that bundles all extension scripts locally; no remotely hosted executable code.
- Keep the existing dApp lab as a separate developer tool, not as the wallet's backend.
- Pin dependencies and add software-license notices.

### Phase 2 — cryptographic wallet lifecycle
- Initialize the WebAssembly engine once.
- Implement create/import and seed phrase verification using the engine's supported key derivation.
- Add password-based encryption and encrypted local persistence.
- Verify unlock, lock, restart, backup, and restore behavior with test vectors.

### Phase 3 — Zcash network engine
- Add testnet-only configuration first.
- Implement wallet database persistence, background sync, birthday-height handling, and clear sync status.
- Verify transparent and shielded address derivation and balances against known test vectors.
- Validate gRPC-web/lightwalletd behavior in an actual MV3 extension environment.

### Phase 4 — payments
- Receive screens and QR codes.
- Amount, address, memo, fee, and balance checks.
- Explicit review/approval, local proving, broadcast, pending state, and independent confirmation.
- Test success, rejection, cancellation, offline state, duplicate submission, and ambiguous broadcast outcomes.

### Phase 5 — release readiness
- Automated unit, integration, browser, and recovery tests.
- Dependency and license audit, threat model, independent security review, and documented limitations.
- Chrome Web Store screenshots, single-purpose description, privacy declarations, support URL, and privacy policy.
- Release to testnet testers first. Mainnet is a separate gate after successful verification.

## Current status

This branch starts the standalone extension entry point and build foundation. It does not yet constitute a functional wallet. Wallet creation, recovery, encrypted persistence, address derivation, synchronization, transaction proving, and sending must be implemented and verified before public release.
