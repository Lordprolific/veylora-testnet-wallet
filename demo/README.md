# Veylora Zcash dApp Lab

A small, read-only integration demo using the official Noir Wallet SDK. It is separate from the extension popup scaffold and demonstrates how a dApp can request account access and display provider-returned information.

## Requirements

- Node.js 20.19+ or 22.12+.
- A Chromium browser.
- The official Noir Wallet testnet extension installed from its official distribution channel.

Noir documents separate mainnet and testnet extension builds with separate extension IDs and wallet data. This demo cannot independently attest which build is installed. Confirm the testnet build yourself before connecting.

## Hosted demo

Open https://veylora-zcash-dapp-lab.vercel.app to use the deployed read-only demo. A compatible Noir Wallet testnet extension must be installed in the same browser for provider-based connection testing.

## Run

From this directory:

1. Install dependencies with npm install.
2. Start the app with npm run dev.
3. Open the local URL shown by Vite.
4. Use Connect wallet and approve the request in the wallet.

Run npm test for the presentation-helper tests and npm run build to type-check and create the production build.

## Current scope

- Detects the Noir provider using the official SDK.
- Checks for an existing authorized connection.
- Requests account access only after a deliberate click.
- Displays shortened provider-returned transparent and shielded addresses and a balance summary.
- Does not create, sign, or broadcast transactions.

The app does not ask for seed phrases or private keys, does not send wallet data to analytics services, and does not load third-party fonts.

## References

- Noir developer documentation: https://docs.zknoir.com/developers/
- Noir provider API: https://docs.zknoir.com/developers/provider-api/
- SDK package: https://www.npmjs.com/package/@noir-wallet/sdk

This is experimental developer tooling, not audited and not for holding or transferring funds.
