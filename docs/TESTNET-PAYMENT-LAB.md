# Testnet Payment Lab: Verification Guide

This guide describes the Veylora dApp lab's Noir Wallet integration. It is not a security audit.

## Safety boundary

- The dApp cannot independently attest that the wallet extension is running on testnet.
- The testnet checkbox is a user acknowledgement, not a network attestation.
- Address-prefix validation is a usability guard, not proof of network or full address validity.
- Every payment request must be reviewed and approved inside Noir Wallet.
- Never use mainnet funds or disclose wallet recovery material.

## Payment flow

1. Connect the official Noir Wallet testnet extension.
2. Confirm the extension's selected network independently.
3. Paste a recipient address and enter a positive ZEC amount with at most eight decimal places.
4. Select the funding source. Shielded funding is the default. Transparent funding may publicly link selected UTXOs.
5. Add a memo only for a shielded recipient. The memo must be no more than 512 UTF-8 bytes.
6. Acknowledge testnet use and submit the form.
7. Review network, recipient, amount, funding source, and memo in the wallet. Reject the request if anything differs.
8. After approval, record the transaction ID and independently confirm status. A returned ID is not proof of mining.

## Manual end-to-end checklist

- [ ] No provider: clear error and no send action.
- [ ] Provider but no authorization: connection prompt only after user click.
- [ ] Connection rejected: do not show a connected session.
- [ ] Existing authorization: restore silently.
- [ ] Locked or syncing wallet: explain unavailable balance; do not invent one.
- [ ] Account changes: re-read authorization and refresh account state.
- [ ] Invalid address or amount: reject before calling the SDK.
- [ ] Memo with transparent recipient: reject before calling the SDK.
- [ ] Memo over 512 UTF-8 bytes: reject before calling the SDK.
- [ ] Testnet acknowledgement unchecked: send button remains disabled.
- [ ] Payment rejected: do not claim success or retry automatically.
- [ ] Payment approved: independently check transaction status.
- [ ] History unavailable: show an error state without fabricating records.

## Known limitations

- Active wallet network cannot be verified by this app.
- Address checks do not prove that a recipient exists or that the wallet is on testnet.
- SDK/extension compatibility must be verified in a real browser; optional `fundingSource` support depends on Noir Wallet version.
- A real testnet transaction and browser verification are required before claiming end-to-end verification.
- The separate extension UI scaffold is not a wallet engine.
