# Veylora Zcash Wallet

![Official Veylora four-petal mark](assets/veylora-mark.svg)

**A standalone, self-custodial Zcash wallet for Chrome.**

Veylora is being developed as an independent Zcash wallet. It is not intended to require Noir Wallet, and it is not a scanner or provider wrapper.

> **Status: experimental Zcash testnet wallet; not audited and not for real funds.** The extension implements local vault creation and recovery, encrypted local persistence, WebZjs testnet address derivation, manual sync, balance/history rendering, receive QR, and a proposal-reviewed send flow. Implementation does not mean end-to-end verification: install and test the extension in real Chrome before relying on address correctness, incoming balance detection, synchronization, or payments. Receive becomes available after an address is derived; Send remains gated until the scan reaches the reported chain tip. Testnet coins have no intended monetary value.

## Official Chrome extension

- **Download latest release:** https://github.com/Lordprolific/veylora-testnet-wallet/releases/latest/download/veylora-chrome-extension-testnet.zip
- **Installation guide:** https://github.com/Lordprolific/veylora-testnet-wallet/blob/main/DOWNLOAD.md
- The toolbar popup is a launcher only. Open the wallet in its own extension tab so WebZjs can initialize with the extension's cross-origin isolation policies.
- If replacing an older installation, keep the existing extension data and local vault intact. Do not remove browser data or reset the vault as part of an update.

## Live demo

- **Hosted lab:** https://veylora-zcash-dapp-lab.vercel.app
- **Source:** https://github.com/Lordprolific/veylora-testnet-wallet
- **Noir SDK guide:** https://docs.zknoir.com/noir-sdk-integration/

## What's included

- Vite + TypeScript dApp lab using `@noir-wallet/sdk`.
- Explicit wallet connection and silent restoration of existing authorization.
- Transparent and shielded address display with copy controls.
- Balance refresh and wallet-provided transaction history.
- Testnet payment form with address-format and amount guards, memo byte checks, explicit testnet acknowledgement, and wallet-mediated approval.
- Tests for presentation helpers and payment input validation.
- Separate Manifest V3 extension UI scaffold.

## Important network limitation

The dApp **cannot independently verify the wallet's active network**. The testnet checkbox is user acknowledgement, not technical proof. Address-prefix checks are only input guards; they do not prove the wallet is on testnet or fully validate an address. Install the official Noir testnet extension and confirm its network state independently. Never use real funds in this lab.

Every payment must be reviewed and approved inside Noir Wallet. A returned transaction ID does not mean a transaction is mined. Transparent funding can publicly link selected UTXOs; shielded funding is the default. Private memos are only offered for shielded recipients and are limited to 512 UTF-8 bytes.

## Run locally

1. Clone this repository.
2. Open a terminal in `demo/`.
3. Run `npm install`.
4. Run `npm test`.
5. Run `npm run build`.
6. Run `npm run dev`.
7. Open the local site in a browser with the official Noir testnet extension installed and independently confirm its network.

To install the extension, download and extract the latest `veylora-chrome-extension-testnet.zip` release, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the extracted extension folder containing `manifest.json`. For an existing install, preserve its extension data and local vault. Click the toolbar icon and choose **Open Veylora Wallet** to run the full wallet in its own tab. Keep the wallet on testnet. The current release still requires real-browser checks for vault restoration, persistence after browser restart, address correctness, scan-to-tip, receiving/balance visibility, and a controlled testnet send with independent transaction confirmation.

## Security principles

- Keep transaction signing and final approval inside Noir Wallet.
- Never request seed phrases, recovery phrases, private keys, or wallet passwords.
- Do not send wallet addresses, balances, history, or account state to analytics or an application backend.
- Validate inputs and treat browser-provided data as untrusted.
- Do not automatically retry a send after an ambiguous error; first check its status.
- Do not describe a transaction as private solely because it uses Zcash. Privacy depends on address type, funding source, wallet behavior, and transaction context.
- The demo is not audited and is not suitable for production use or holding funds.

## Release verification checklist

- [ ] CI tests and production build pass.
- [ ] Real-browser connect, reconnect, revoke, locked-wallet, and account-change checks.
- [ ] A controlled testnet payment approved in the wallet.
- [ ] Transaction status independently confirmed.
- [ ] Rejection, cancellation, and ambiguous-error behavior checked.
- [ ] SDK/extension compatibility, extension permissions, dependency health, and source provenance reviewed.
- [ ] A repository license is selected before redistribution.

## License status

No explicit license has been selected yet. Until a license is added, do not assume the repository grants permission to redistribute or reuse its code. See [LICENSE-STATUS.md](LICENSE-STATUS.md).

## Disclaimer

Experimental developer tooling. Not audited, not intended to hold funds, and not suitable for production use. Testnet assets have no intended monetary value. Features are implemented only when code, tests, and end-to-end verification demonstrate them.
