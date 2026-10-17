# Veylora Testnet Wallet

**A developer-first starting point for building and testing Zcash dApps on testnet.**

Veylora Testnet Wallet is a public developer-tooling project for the Veylora ecosystem and the wider Zcash developer community. The goal is to make it easier for developers to connect dApps, inspect testnet account state, and test supported transaction flows without accidentally interacting with mainnet.

> **Current status: prototype scaffold.** This repository contains an extension interface and an integration contract, not a functioning self-custody wallet. No private keys are generated or stored, and no Zcash transactions are signed or broadcast by this prototype.

## Principles

- **Testnet-first:** mainnet actions are out of scope for the initial prototype.
- **Honest status:** the UI must never imply a wallet is connected when no compatible provider is available.
- **Reusable tooling:** document the provider contract and integration steps so other Zcash dApp teams can adopt them.
- **Security before claims:** wallet engine, key handling, shielded transaction support, and signing must be verified before being described as implemented.
- **Independent project:** Veylora Market is an initial potential integration client, not the only intended user.

## What's here

- Manifest V3 browser-extension scaffold.
- Read-only dApp demo in `demo/`, integrating the documented Noir Wallet SDK ([live demo](https://veylora-zcash-dapp-lab.vercel.app)).
- Dark, compact popup UI designed for a developer wallet.
- Explicit “wallet engine not connected” state.
- Popup shortcut to the deployed read-only Zcash dApp Lab.
- Initial provider integration contract in docs/provider-contract.md.

## Run locally

1. Clone this repository.
2. Open chrome://extensions in Chrome or a Chromium-based browser.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the repository folder.
5. Open the extension popup.

This loads the prototype UI only. It does **not** create a wallet, manage keys, connect to a network, or send transactions.

## Current verification

- The dApp demo uses the official Noir Wallet SDK for explicit account access and read-only balance display.
- GitHub Actions runs presentation tests and a TypeScript/Vite production build.
- The demo cannot independently verify which Noir extension build is installed. Confirm the official testnet build before connecting.
- The browser extension popup remains a prototype interface; it is not the wallet engine.
- The hosted demo is currently deployed from a reviewed source snapshot. Automatic deployment from GitHub will be enabled once the Vercel GitHub integration is authorized for this repository.

## Roadmap

1. Verify the official testnet extension end-to-end in a Chromium browser.
2. Connect Veylora Market to the reusable dApp integration path.
3. Review source licensing, extension permissions, dependency health, and release packaging.
4. Add transaction flows only when supported by the provider, with explicit user confirmation and tests.

## Contributing

Please open an issue before proposing a new provider API or transaction flow. Never share seed phrases, private keys, recovery phrases, or wallet passwords in issues, logs, screenshots, or support requests.

## License status

No explicit license has been selected yet. Until a license is added, do not assume the repository grants permission to redistribute or reuse its code. See [LICENSE-STATUS.md](LICENSE-STATUS.md).

## Disclaimer

Experimental developer tooling. Not audited, not intended to hold funds, and not suitable for production use. Testnet assets have no intended monetary value. Features are implemented only when the code and tests demonstrate them.
