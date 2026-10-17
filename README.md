# Veylora Testnet Wallet

**A developer-first starting point for building and testing Zcash dApps on testnet.**

Veylora Testnet Wallet is an independent developer-tooling project for the Veylora ecosystem and the wider Zcash developer community. The goal is to make it easier for developers to connect dApps, inspect testnet account state, and test supported transaction flows without accidentally interacting with mainnet.

> **Current status: prototype scaffold.** This repository contains an extension interface and an integration contract, not a functioning self-custody wallet. No private keys are generated or stored, and no Zcash transactions are signed or broadcast by this prototype.

## Principles

- **Testnet-first:** mainnet actions are out of scope for the initial prototype.
- **Honest status:** the UI must never imply a wallet is connected when no compatible provider is available.
- **Reusable tooling:** document the provider contract and integration steps so other Zcash dApp teams can adopt them.
- **Security before claims:** wallet engine, key handling, shielded transaction support, and signing must be verified before being described as implemented.
- **Independent project:** Veylora Market is an initial potential integration client, not the only intended user.

## What's here

- Manifest V3 browser-extension scaffold.
- Dark, compact popup UI designed for a developer wallet.
- Explicit “wallet engine not connected” state.
- Initial provider integration contract in docs/provider-contract.md.

## Run locally

1. Clone this repository.
2. Open chrome://extensions in Chrome or a Chromium-based browser.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the repository folder.
5. Open the extension popup.

This loads the prototype UI only. It does **not** create a wallet, manage keys, connect to a network, or send transactions.

## Roadmap

1. **Provider research:** choose a maintained Zcash testnet wallet engine/provider and verify its API, source availability, and license.
2. **Connection adapter:** implement a typed adapter against the provider's documented API; do not guess method names.
3. **Testnet dApp demo:** connect, request account access, and display only provider-returned information.
4. **Transaction testing:** add supported testnet flows with explicit confirmation and clear error handling.
5. **Security and release:** review key isolation, permissions, dependencies, recovery flows, and packaging before calling this a wallet release.

## Contributing

Please open an issue before proposing a new provider API or transaction flow. Never share seed phrases, private keys, recovery phrases, or wallet passwords in issues, logs, screenshots, or support requests.

## Disclaimer

Experimental developer tooling. Not audited, not intended to hold funds, and not suitable for production use. Testnet assets have no intended monetary value. Features are implemented only when the code and tests demonstrate them.
