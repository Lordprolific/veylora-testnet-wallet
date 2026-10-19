# Veylora Product Scope — Source of Truth

## First release

Veylora is a standalone self-custodial Zcash wallet distributed first as a **Chrome browser extension via the Chrome Web Store**.

- **Initial network:** Zcash testnet only, intended for testnet funds.
- **Initial platform:** Chrome extension only.
- **Not in this launch:** mobile app, mobile browser support, PWA, or a mobile-first release.
- **Not a dependency:** Noir Wallet. Veylora must operate as its own wallet.
- **Mainnet:** out of scope for the initial release; do not expose a mainnet switch. Mainnet requires a separate security and release gate.

## Product requirements

Build a real wallet, not a UI mock: secure wallet creation and recovery, encrypted local secret storage, real Zcash address derivation, testnet synchronization and balances, receive address/QR, transaction review, send/broadcast, transaction status/history, lock/unlock, and recovery testing.

Do not fabricate balances, addresses, transaction status, seed phrases, or successful sends. Do not label the wallet ready for testnet funds until create/restore, sync, receive, send, and recovery have been tested end to end in the actual Chrome extension environment.

## Delivery priority

1. Integrate and validate the pinned WebZjs engine in Manifest V3.
2. Implement secure seed generation and recovery compatible with the engine. Do not use WebZjs's browser seed generator until its randomness warning is resolved.
3. Complete encrypted storage and lock/unlock lifecycle.
4. Complete testnet address derivation, sync, balances, receive, and send.
5. Run end-to-end and security tests; package and prepare the Chrome Web Store listing.
6. Keep mainnet disabled until a separate, stricter release review.

This document is the source of truth for platform and release scope. Do not redirect this project to a mobile app unless the owner explicitly changes scope.
