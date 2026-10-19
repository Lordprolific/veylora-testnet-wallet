# Veylora Market dApp Provider Design

Status: integration work in progress; not yet implemented or tested.

## Goals
- Recommend Veylora Wallet first on Veylora Market.
- Preserve Noir Wallet and other compatible Zcash wallets.
- Never disclose recovery phrases or private keys to the website.
- Separate account connection, identity message signing, and transaction authorization.
- Require explicit origin-aware user approval for account access and the exact login challenge.
- Keep server-side signature verification strict.

## Confirmed compatibility gap
The extension currently has no website-facing provider, origin-scoped connection permissions, account-change events, or arbitrary-message signing operation. Its existing transaction-signing flow is not a login-signature API. Adding address discovery alone would make the wallet appear connected without completing verified Market authentication.

## Required implementation
1. Add a narrow extension provider bridge with strict message schemas and origin checks.
2. Add explicit approval screens for connecting a site and signing the exact challenge.
3. Implement message signing with a supported signing primitive and a derivation format compatible with Market verification; never export secrets.
4. Test origin rejection, cancellation, malformed requests, secret non-disclosure, signature verification and replay resistance.
5. Add a Veylora provider adapter to Market while preserving the Noir SDK path and other compatible wallet choices.
6. Build and test the extension, then validate an end-to-end login on the deployed Market before claiming completion.

## Safety constraints
Testnet only. No seed/private key exposure. No auto-approval. No weakened server verification. No claims of successful connection until the full login passes.
