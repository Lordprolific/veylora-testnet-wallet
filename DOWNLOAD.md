# Veylora Testnet Wallet

**Network:** Zcash testnet  
**Package:** Chrome extension (ZIP)

## Download

**[Download the confirmed Veylora Wallet for Chrome](https://github.com/Lordprolific/veylora-testnet-wallet/releases/latest/download/veylora-chrome-extension-testnet.zip)**

This permanent link downloads the latest published Chrome extension ZIP. Version 0.3.3 keeps the toolbar popup lightweight and opens the full wallet in its own extension tab, where the manifest's cross-origin isolation policies can support WebZjs threaded WebAssembly initialization. The package build verifies the isolation policies and required bridge resources.

## Install

1. Download and extract the ZIP.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the extracted extension folder containing `manifest.json`.
5. Click the Veylora toolbar icon and choose **Open Veylora Wallet**. Keep the full wallet running in its own extension tab.
6. Return to [Veylora Market](https://veylora-market.vercel.app/) and try connecting. The direct Market bridge still requires a real-browser end-to-end check.

## Important

- This wallet is for **Zcash testnet** experimentation only. Do not use mainnet funds.
- Never share your recovery phrase or private keys.
- Verify wallet connection and signature flows in Veylora Market before relying on the integration.

**Build status:** Use the latest successful [Standalone wallet build](https://github.com/Lordprolific/veylora-testnet-wallet/actions/workflows/standalone-wallet-build.yml) and the latest published release linked above. The isolation fix is not a substitute for testing wallet creation, restore, or Market connectivity in Chrome.
