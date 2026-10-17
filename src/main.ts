import "./style.css";
import QRCode from "qrcode";
import { createTestnetAccount, restoreTestnetAccount, syncTestnetWallet, getTestnetHistory, prepareTestnetTransfer, cancelPendingTestnetTransfer, authorizeAndBroadcastTestnetTransfer, getTestnetDatabase, releaseTestnetWallet } from "./wallet/zcash-engine.js";

const WALLET_META_KEY = "veylora.testnet-wallet-meta.v1";
let engineState: { accountId: number; unifiedAddress: string; transparentAddress: string; chainHeight: string; scannedHeight: string; birthdayHeight: number; database: Uint8Array } | null = null;
let engineBusy = false;
let lifecycleGeneration = 0;
let syncVerified = false;
let pendingTransferDetails: any = null;
let transferRecipient = "";
let transferAmountZatoshis = 0n;
let lastTransferResult: { txids: string[]; broadcastCompleted: boolean; broadcastError: string | null } | null = null;
import {
  createRecoveryPhrase,
  validateRecoveryPhrase,
  vaultExists,
  createEncryptedVault,
  restoreEncryptedVault,
  unlockVault,
  getUnlockedRecoveryPhrase,
  lockVault,
  persistEncryptedWalletDatabase,
  getUnlockedWalletDatabase,
  verifyWalletPassword,
} from "./wallet/lifecycle.js";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Wallet root element is missing");

type Screen = "home" | "create-phrase" | "create-password" | "restore" | "unlock" | "vault" | "receive" | "send" | "send-review" | "send-result";
let screen: Screen = "home";
let pendingPhrase = "";
let phraseVisible = false;
let busy = false;

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char] ?? char));

function shell(content: string) {
  root!.innerHTML = `
    <div class="layout">
      <aside class="rail">
        <div class="brand"><img src="./assets/veylora-mark.svg" alt="" /><span>VEY LORA</span></div>
        <div class="rail-label">WALLET</div>
        <button class="nav ${screen === "home" ? "active" : ""}" data-action="home"><span>◈</span> Overview</button>
        <button class="nav ${screen === "send" || screen === "send-review" ? "active" : ""} ${syncVerified ? "" : "disabled-nav"}" data-action="send" ${syncVerified ? "" : "disabled"} title="${syncVerified ? "Review a testnet transaction" : "Sync the testnet wallet before sending"}><span>↗</span> Send</button>
        <button class="nav ${screen === "receive" ? "active" : ""} ${syncVerified ? "" : "disabled-nav"}" data-action="receive" ${syncVerified ? "" : "disabled"} title="${syncVerified ? "Show verified testnet receive address" : "Sync the testnet wallet before receiving funds"}><span>＋</span> Receive</button>
        <button class="nav disabled-nav" disabled title="Available after wallet engine integration"><span>↻</span> Activity</button>
        <div class="rail-bottom"><div class="secure-dot"></div><span>Encrypted local vault</span></div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div><div class="eyebrow">ZCASH WALLET</div><h1>Your money. Your keys.</h1></div>
          <div class="network"><span class="dot"></span> TESTNET ONLY</div>
        </header>
        <div id="feedback" class="feedback" role="status" aria-live="polite"></div>
        ${content}
        <footer><span>VEY LORA <b>·</b> TESTNET DEVELOPMENT</span><a href="https://github.com/Lordprolific/veylora-testnet-wallet/blob/main/docs/PRODUCT-SCOPE.md" target="_blank" rel="noreferrer">Product scope ↗</a></footer>
      </main>
    </div>`;
}

function homeView() {
  const exists = vaultExists();
  const unlocked = Boolean(getUnlockedRecoveryPhrase());
  shell(`
    <section class="hero compact">
      <div class="hero-mark"><img src="./assets/veylora-mark.svg" alt="" /></div>
      <div class="eyebrow">A WALLET OF YOUR OWN</div>
      <h2>Privacy starts<br/>with <span>ownership.</span></h2>
      <p class="intro">A standalone Zcash wallet, built for self-custody. Your recovery phrase is encrypted locally with your password.</p>
      <div class="status-panel">
        <div class="status-row"><span class="status-indicator ${exists ? "status-ready" : ""}"></span><span>Local encrypted vault</span><strong>${exists ? (unlocked ? "UNLOCKED" : "LOCKED") : "NOT SET UP"}</strong></div>
        <div class="status-row"><span class="status-indicator"></span><span>Zcash testnet engine</span><strong>INTEGRATION IN PROGRESS</strong></div>
      </div>
      <div class="notice"><span class="notice-icon">!</span><div><strong>Do not deposit testnet funds yet</strong><p>The local vault and initial WebZjs testnet adapter are in active verification. Do not deposit funds until Chrome extension initialization, sync, database recovery, receiving, and sending have passed end-to-end tests. Send remains disabled.</p></div></div>
      <div class="actions">
        ${exists
          ? (unlocked
            ? '<button class="primary" data-action="vault">View vault status <span>↗</span></button><button class="secondary" data-action="lock">Lock wallet</button>'
            : '<button class="primary" data-action="unlock">Unlock wallet <span>↗</span></button><button class="secondary" data-action="restore">Restore from recovery phrase</button>')
          : '<button class="primary" data-action="create">Create new wallet <span>↗</span></button><button class="secondary" data-action="restore">Restore with recovery phrase</button>'}
      </div>
      <div class="security-line"><span>⌑</span> Local encryption <i></i><span>◉</span> Testnet only <i></i><span>⌁</span> Self-custody</div>
    </section>
    <section class="bottom-grid">
      <article class="info-card"><div class="card-icon">◈</div><h3>Keys stay yours</h3><p>Your recovery phrase is encrypted in local extension storage. Your password is never saved.</p></article>
      <article class="info-card"><div class="card-icon">◌</div><h3>Recovery matters</h3><p>Write down the recovery phrase and keep it offline. Anyone with the phrase can control the wallet.</p></article>
      <article class="info-card"><div class="card-icon">⌁</div><h3>Built to verify</h3><p>Real addresses, balances, receiving, and payments will only be enabled after engine and network tests pass.</p></article>
    </section>`);
}

function phraseView() {
  const words = pendingPhrase.split(" ");
  shell(`
    <section class="flow-card">
      <button class="back-link" data-action="home">← Back</button>
      <div class="eyebrow">STEP 1 OF 2 · BACKUP</div>
      <h2>Your recovery phrase</h2>
      <p class="flow-copy">These 24 words are the master backup for your wallet. Write them down in order and store them offline. Never share them with anyone.</p>
      <div class="phrase-grid">${words.map((word, index) => `<div class="phrase-word"><span>${index + 1}</span><strong>${escapeHtml(word)}</strong></div>`).join("")}</div>
      <label class="check-row"><input type="checkbox" id="phrase-confirm" /> I have written down all 24 words and stored them somewhere private.</label>
      <div class="notice danger-notice"><span class="notice-icon">!</span><div><strong>Do not take screenshots or share this phrase</strong><p>Anyone who gets these words can take control of the wallet. Veylora will not be able to recover them for you.</p></div></div>
      <div class="actions"><button class="primary" data-action="phrase-next" disabled id="phrase-next">I've backed it up <span>↗</span></button></div>
    </section>`);
  const checkbox = root!.querySelector<HTMLInputElement>("#phrase-confirm");
  const next = root!.querySelector<HTMLButtonElement>("#phrase-next");
  checkbox?.addEventListener("change", () => { if (next) next.disabled = !checkbox.checked; });
}

function passwordView(mode: "create" | "restore") {
  shell(`
    <section class="flow-card narrow">
      <button class="back-link" data-action="${mode === "create" ? "phrase-back" : "home"}">← Back</button>
      <div class="eyebrow">${mode === "create" ? "STEP 2 OF 2 · ENCRYPTION" : "WALLET RECOVERY"}</div>
      <h2>${mode === "create" ? "Protect your wallet" : "Restore your wallet"}</h2>
      <p class="flow-copy">${mode === "create" ? "Create a strong password to encrypt your recovery phrase on this device. Use at least 12 characters." : "Enter your 24-word recovery phrase and choose a new local encryption password."}</p>
      ${mode === "restore" ? '<label class="field-label" for="recovery">24-word recovery phrase</label><textarea id="recovery" rows="4" autocomplete="off" spellcheck="false" placeholder="Enter your 24 words in order"></textarea>' : ""}
      <form id="password-form">
        ${mode === "restore" && vaultExists() ? '<label class="check-row destructive-check"><input type="checkbox" id="replace-existing" required /> I understand this will replace the existing encrypted vault on this device.</label>' : ""}
        <label class="field-label" for="password">${mode === "restore" ? "New wallet password" : "Wallet password"}</label>
        <input id="password" type="password" minlength="12" maxlength="1024" autocomplete="new-password" required placeholder="At least 12 characters" />
        <label class="field-label" for="password-confirm">Confirm password</label>
        <input id="password-confirm" type="password" minlength="12" maxlength="1024" autocomplete="new-password" required placeholder="Enter it again" />
        <div class="password-hint">This password encrypts your local vault. If you forget it, you must restore with your recovery phrase.</div>
        <button class="primary form-submit" type="submit" ${busy ? "disabled" : ""}>${mode === "create" ? "Encrypt and create vault" : "Restore and encrypt vault"} <span>↗</span></button>
      </form>
    </section>`);
  root!.querySelector<HTMLFormElement>("#password-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = root!.querySelector<HTMLInputElement>("#password")?.value ?? "";
    const confirm = root!.querySelector<HTMLInputElement>("#password-confirm")?.value ?? "";
    if (password.length < 12) return feedback("Use at least 12 characters for the password.", true);
    if (password !== confirm) return feedback("The passwords do not match.", true);
    let phrase = pendingPhrase;
    if (mode === "restore") {
      const raw = root!.querySelector<HTMLTextAreaElement>("#recovery")?.value ?? "";
      try { phrase = validateRecoveryPhrase(raw); } catch (error) { return feedback(error instanceof Error ? error.message : "Invalid recovery phrase.", true); }
    }
    busy = true;
    try {
      if (mode === "create") await createEncryptedVault(phrase, password);
      else await restoreEncryptedVault(phrase, password, !vaultExists() || Boolean(root!.querySelector<HTMLInputElement>("#replace-existing")?.checked));
      localStorage.setItem(WALLET_META_KEY, JSON.stringify({ birthdayHeight: mode === "restore" ? 0 : null }));
      pendingPhrase = "";
      screen = "vault";
      await vaultView(password);
      feedback(mode === "create" ? "Encrypted vault created. Initializing the testnet account…" : "Recovery phrase encrypted. Restoring the testnet account…");
    } catch (error) {
      feedback(error instanceof Error ? error.message : "Could not save the encrypted vault.", true);
    } finally { busy = false; }
  });
}

function unlockView() {
  shell(`
    <section class="flow-card narrow">
      <button class="back-link" data-action="home">← Back</button>
      <div class="eyebrow">LOCAL SECURITY</div><h2>Unlock Veylora</h2>
      <p class="flow-copy">Your encrypted vault stays on this device. Enter the password you created for it.</p>
      <form id="unlock-form">
        <label class="field-label" for="unlock-password">Wallet password</label>
        <input id="unlock-password" type="password" autocomplete="current-password" required />
        <button class="primary form-submit" type="submit">Unlock vault <span>↗</span></button>
      </form>
    </section>`);
  root!.querySelector<HTMLFormElement>("#unlock-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = root!.querySelector<HTMLInputElement>("#unlock-password")?.value ?? "";
    try {
      await unlockVault(password);
      screen = "vault";
      await vaultView(password);
      feedback("Vault unlocked for this browser session.");
    } catch (error) { feedback(error instanceof Error ? error.message : "Could not unlock the vault.", true); }
  });
}

async function vaultView(password?: string) {
  const phrase = getUnlockedRecoveryPhrase();
  if (!phrase) { screen = "home"; return homeView(); }
  shell(`
    <section class="flow-card narrow">
      <div class="eyebrow">LOCAL VAULT</div><h2>Vault unlocked</h2>
      <p class="flow-copy">Your recovery phrase is decrypted for this browser session. Veylora will attempt to derive a testnet address locally; balances and payments remain gated on verified synchronization and transaction testing.</p>
      <div class="status-panel">
        <div class="status-row"><span class="status-indicator status-ready"></span><span>Encrypted recovery phrase</span><strong>UNLOCKED</strong></div>
        <div class="status-row"><span class="status-indicator"></span><span>Zcash account/address</span><strong>INITIALIZING</strong></div>
        <div class="status-row"><span class="status-indicator"></span><span>Chain sync and payments</span><strong>NOT YET VERIFIED</strong></div>
      </div>
      <div id="engine-panel" class="engine-panel"><div class="engine-panel-head"><span class="status-indicator"></span><strong>TESTNET ENGINE</strong><span id="engine-status">Initializing WebZjs…</span></div><p>Addresses are derived locally by the pinned WebZjs engine. Do not send funds until synchronization and transaction flows are verified.</p><div id="address-content"></div><div id="balance-content"></div><div id="history-content"></div><button class="secondary full-button" data-action="sync" id="sync-button" disabled>Sync testnet <span>↻</span></button></div>
      <button class="secondary full-button" data-action="reveal">${phraseVisible ? "Hide recovery phrase" : "Reveal recovery phrase"}</button>
      ${phraseVisible ? `<div class="phrase-reveal"><p>Keep this phrase private. Anyone who sees it can control the wallet.</p><div>${phrase.split(" ").map((word, i) => `<span><small>${i + 1}</small>${escapeHtml(word)}</span>`).join("")}</div></div>` : ""}
      <div class="actions"><button class="secondary" data-action="lock">Lock wallet</button><button class="secondary" data-action="home">Overview</button></div>
    </section>`);
  void initializeEngineForPhrase(phrase, password);
}

async function initializeEngineForPhrase(phrase: string, password?: string) {
  const generation = lifecycleGeneration;
  const status = root!.querySelector<HTMLElement>("#engine-status");
  const panel = root!.querySelector<HTMLElement>("#engine-panel");
  const addressContent = root!.querySelector<HTMLElement>("#address-content");
  const syncButton = root!.querySelector<HTMLButtonElement>("#sync-button");
  if (!status || !panel || !addressContent || !syncButton) return;
  if (engineState) {
    status.textContent = "Address derived · sync not verified";
    addressContent.innerHTML = `<div class="address-block"><label>Unified testnet address</label><code>${escapeHtml(engineState.unifiedAddress)}</code><button class="copy-address" data-action="copy-address">Copy address</button></div><div class="address-block"><label>Transparent testnet address</label><code>${escapeHtml(engineState.transparentAddress)}</code><button class="copy-address" data-action="copy-transparent">Copy address</button></div><p class="small-note">Address derivation succeeded locally. No balance is displayed until chain sync is independently verified.</p>`;
    syncButton.disabled = false;
    return;
  }
  status.textContent = "Initializing local WASM…";
  syncButton.disabled = true;
  try {
    let meta: { birthdayHeight?: number; accountId?: number } = {};
    try { meta = JSON.parse(localStorage.getItem(WALLET_META_KEY) || "{}"); } catch { meta = {}; }
    const savedDatabase = getUnlockedWalletDatabase();
    if (savedDatabase) {
      engineState = await restoreTestnetAccount(savedDatabase.database, savedDatabase.accountId);
    } else {
      engineState = await createTestnetAccount(phrase, typeof meta.birthdayHeight === "number" ? meta.birthdayHeight : undefined);
      if (generation !== lifecycleGeneration) { releaseTestnetWallet(); engineState = null; return; }
      if (password) await persistEncryptedWalletDatabase(engineState.database, engineState.accountId, password);
    }
    if (generation !== lifecycleGeneration) { releaseTestnetWallet(); engineState = null; return; }
    localStorage.setItem(WALLET_META_KEY, JSON.stringify({ birthdayHeight: engineState.birthdayHeight, accountId: engineState.accountId, unifiedAddress: engineState.unifiedAddress, transparentAddress: engineState.transparentAddress }));
    status.textContent = "Address derived · sync not verified";
    const statusLabels = root!.querySelectorAll<HTMLElement>(".status-panel .status-row strong");
    if (statusLabels[1]) statusLabels[1].textContent = "DERIVED LOCALLY";
    if (statusLabels[2]) statusLabels[2].textContent = "NOT YET VERIFIED";
    panel.querySelector(".engine-panel-head .status-indicator")?.classList.add("status-ready");
    addressContent.innerHTML = `<div class="address-block"><label>Unified testnet address</label><code>${escapeHtml(engineState.unifiedAddress)}</code><button class="copy-address" data-action="copy-address">Copy address</button></div><div class="address-block"><label>Transparent testnet address</label><code>${escapeHtml(engineState.transparentAddress)}</code><button class="copy-address" data-action="copy-transparent">Copy address</button></div><p class="small-note">Address derivation succeeded locally. No balance is displayed until chain sync is independently verified.</p>`;
    syncButton.disabled = false;
  } catch (error) {
    if (generation !== lifecycleGeneration) return;
    status.textContent = "Engine unavailable";
    addressContent.innerHTML = `<p class="engine-error">${escapeHtml(error instanceof Error ? error.message : "WebZjs could not initialize in this extension context.")}</p><p class="small-note">Keep your recovery phrase safe. Do not send funds until initialization and synchronization work in Chrome.</p>`;
    feedback("The recovery phrase is encrypted, but the Zcash engine did not initialize. Do not deposit funds.", true);
  }
}



function formatZatoshis(value: unknown): string {
  const amount = BigInt(String(value ?? "0"));
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const whole = absolute / 100_000_000n;
  const fraction = (absolute % 100_000_000n).toString().padStart(8, "0");
  return `${negative ? "-" : ""}${whole.toString()}.${fraction}`;
}

function sendView() {
  if (!syncVerified || !engineState || !getUnlockedRecoveryPhrase()) {
    screen = "vault";
    void vaultView();
    return;
  }
  screen = "send";
  shell(`
    <section class="flow-card narrow">
      <button class="back-link" data-action="vault">← Back to wallet</button>
      <div class="eyebrow">ZCASH TESTNET · SEND</div>
      <h2>Send ZEC</h2>
      <p class="flow-copy">Enter the recipient and amount. Veylora will ask WebZjs to calculate the exact transaction fee, then show the complete proposal for your approval before signing or broadcasting.</p>
      <form id="send-form">
        <label class="field-label" for="send-address">Recipient Zcash address</label>
        <textarea id="send-address" rows="3" autocomplete="off" spellcheck="false" required placeholder="Paste a Zcash testnet address"></textarea>
        <label class="field-label" for="send-amount">Amount (ZEC)</label>
        <input id="send-amount" type="text" inputmode="decimal" autocomplete="off" required placeholder="0.00000000" pattern="(?:0|[1-9][0-9]*)(?:\\.[0-9]{1,8})?" />
        <div class="notice"><span class="notice-icon">!</span><div><strong>Testnet only</strong><p>Check the recipient carefully. Zcash transactions cannot be reversed. Mainnet addresses and funds are not supported in this build.</p></div></div>
        <button class="primary form-submit" type="submit">Calculate fee and review <span>↗</span></button>
      </form>
    </section>`);
  root!.querySelector<HTMLFormElement>("#send-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const address = root!.querySelector<HTMLTextAreaElement>("#send-address")?.value.trim() ?? "";
    const amountText = root!.querySelector<HTMLInputElement>("#send-amount")?.value.trim() ?? "";
    if (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,8})?$/.test(amountText)) return feedback("Enter a valid ZEC amount with no more than 8 decimal places.", true);
    const [whole, fractional = ""] = amountText.split(".");
    const zatoshis = BigInt(whole) * 100_000_000n + BigInt((fractional + "00000000").slice(0, 8));
    if (zatoshis <= 0n) return feedback("The amount must be greater than zero.", true);
    if (engineBusy) return;
    engineBusy = true;
    const submit = root!.querySelector<HTMLButtonElement>('#send-form button[type="submit"]');
    if (submit) { submit.disabled = true; submit.textContent = "Calculating exact fee…"; }
    try {
      transferRecipient = address;
      transferAmountZatoshis = zatoshis;
      pendingTransferDetails = await prepareTestnetTransfer(address, zatoshis);
      reviewTransferView();
    } catch (error) {
      feedback(error instanceof Error ? error.message : "Could not prepare a reviewable transfer.", true);
      if (submit) { submit.disabled = false; submit.innerHTML = 'Calculate fee and review <span>↗</span>'; }
    } finally { engineBusy = false; }
  });
}

function reviewTransferView() {
  if (!pendingTransferDetails) { screen = "send"; return sendView(); }
  screen = "send-review";
  const steps = pendingTransferDetails.steps as Array<any>;
  const payments = steps.flatMap((step) => step.payments ?? []);
  const totalFee = BigInt(String(pendingTransferDetails.total_fee_zatoshis));
  const totalAmount = payments.reduce((sum: bigint, payment: any) => sum + BigInt(String(payment.amount_zatoshis ?? "0")), 0n);
  shell(`
    <section class="flow-card narrow">
      <button class="back-link" data-action="cancel-transfer">← Cancel review</button>
      <div class="eyebrow">TRANSACTION REVIEW · STEP 1 OF 2</div>
      <h2>Review before signing</h2>
      <p class="flow-copy">These values come from the WebZjs transaction proposal. Nothing has been signed or broadcast yet.</p>
      <div class="review-panel">
        <div class="review-line"><span>Network</span><strong>Zcash Testnet</strong></div>
        <div class="review-line"><span>Recipient</span><code>${escapeHtml(transferRecipient)}</code></div>
        ${payments.map((payment: any) => `<div class="review-line"><span>Payment amount</span><strong>${formatZatoshis(payment.amount_zatoshis)} ZEC</strong></div>${payment.memo_base64 ? `<div class="review-line"><span>Memo (base64)</span><code>${escapeHtml(String(payment.memo_base64))}</code></div>` : ""}`).join("")}
        <div class="review-line"><span>Exact fee from wallet engine</span><strong>${formatZatoshis(totalFee)} ZEC</strong></div>
        <div class="review-line total-line"><span>Total debit (amount + fee)</span><strong>${formatZatoshis(totalAmount + totalFee)} ZEC</strong></div>
      </div>
      <label class="check-row"><input type="checkbox" id="confirm-transfer-details" /> I checked the network, recipient, amount, and exact fee. I understand this testnet transaction cannot be reversed.</label>
      <div class="notice danger-notice"><span class="notice-icon">!</span><div><strong>Final approval</strong><p>The next step uses your recovery phrase to authorize the transfer and asks WebZjs to broadcast it. Do not proceed if any detail is wrong.</p></div></div>
      <button class="primary form-submit" data-action="confirm-send" id="confirm-send" disabled>Authorize and broadcast <span>↗</span></button>
    </section>`);
  const checkbox = root!.querySelector<HTMLInputElement>("#confirm-transfer-details");
  const button = root!.querySelector<HTMLButtonElement>("#confirm-send");
  checkbox?.addEventListener("change", () => { if (button) button.disabled = !checkbox.checked; });
}

function sendResultView() {
  screen = "send-result";
  const result = lastTransferResult;
  const txids = result?.txids ?? [];
  shell(`
    <section class="flow-card narrow">
      <div class="eyebrow">ZCASH TESTNET · SEND RESULT</div>
      <h2>${result?.broadcastCompleted ? "Broadcast requested" : "Broadcast outcome unclear"}</h2>
      <p class="flow-copy">${result?.broadcastCompleted ? "The wallet's broadcast call returned successfully. This does not mean the transaction is mined or confirmed." : "The wallet could not confirm the broadcast outcome. Do not immediately retry; sync and inspect transaction history first to avoid duplicate payments."}</p>
      ${txids.map((txid) => `<div class="txid-card"><label>Transaction ID</label><code>${escapeHtml(txid)}</code><button class="copy-address" data-action="copy-txid" data-txid="${escapeHtml(txid)}">Copy transaction ID</button></div>`).join("")}
      ${result?.broadcastError ? `<p class="engine-error">${escapeHtml(result.broadcastError)}</p>` : ""}
      <div class="notice"><span class="notice-icon">!</span><div><strong>Not yet confirmed</strong><p>Return to the wallet and sync again to check the transaction's actual status. The displayed ID is not proof of confirmation.</p></div></div>
      <button class="primary form-submit" data-action="vault">Return to wallet</button>
    </section>`);
}

async function confirmSend() {
  if (!pendingTransferDetails || !getUnlockedRecoveryPhrase()) return feedback("Unlock the wallet and prepare a transfer first.", true);
  if (engineBusy) return;
  const password = window.prompt("Enter your wallet password to authorize the transfer and encrypt updated wallet state.");
  if (!password) return;
  engineBusy = true;
  const button = root!.querySelector<HTMLButtonElement>("#confirm-send");
  if (button) { button.disabled = true; button.textContent = "Proving and authorizing…"; }
  let authorizationStarted = false;
  try {
    await verifyWalletPassword(password);
    const phrase = getUnlockedRecoveryPhrase();
    if (!phrase) throw new Error("The wallet was locked before authorization.");
    authorizationStarted = true;
    const result = await authorizeAndBroadcastTestnetTransfer(phrase);
    await persistEncryptedWalletDatabase(result.database, engineState?.accountId ?? -1, password);
    lastTransferResult = result;
    pendingTransferDetails = null;
    syncVerified = false;
    sendResultView();
  } catch (error) {
    try {
      const database = await getTestnetDatabase();
      await persistEncryptedWalletDatabase(database, engineState?.accountId ?? -1, password);
    } catch { /* Preserve the original transfer error; the last encrypted snapshot remains intact. */ }
    const message = error instanceof Error ? error.message : "Transfer authorization failed.";
    if (authorizationStarted) {
      lastTransferResult = { txids: [], broadcastCompleted: false, broadcastError: message };
      pendingTransferDetails = null;
      syncVerified = false;
      cancelPendingTestnetTransfer();
      sendResultView();
    } else {
      feedback(message, true);
      if (button) { button.disabled = false; button.textContent = "Authorize and broadcast"; }
    }
  } finally { engineBusy = false; }
}

async function receiveView() {
  if (!syncVerified || !engineState) { screen = "vault"; return void vaultView(); }
  screen = "receive";
  shell(`
    <section class="flow-card narrow receive-card">
      <button class="back-link" data-action="vault">← Back to wallet</button>
      <div class="eyebrow">ZCASH TESTNET · RECEIVE</div>
      <h2>Receive ZEC</h2>
      <p class="flow-copy">Only share this address for Zcash testnet funds. Veylora has completed a scan to the current reported tip, but the first release remains under testing.</p>
      <div class="qr-frame"><div id="receive-qr" class="qr-placeholder">Generating QR…</div></div>
      <label class="field-label">Unified address</label>
      <div class="receive-address"><code>${escapeHtml(engineState.unifiedAddress)}</code></div>
      <button class="primary form-submit" data-action="copy-address">Copy unified address</button>
      <div class="notice"><span class="notice-icon">!</span><div><strong>Testnet only</strong><p>Never send mainnet ZEC to this address. Testnet coins have no mainnet value.</p></div></div>
    </section>`);
  try {
    const dataUrl = await QRCode.toDataURL(engineState.unifiedAddress, { errorCorrectionLevel: "M", margin: 1, width: 260, color: { dark: "#f2f3f5", light: "#090a0c" } });
    const target = root!.querySelector<HTMLElement>("#receive-qr");
    if (target) target.innerHTML = `<img alt="QR code for Veylora testnet receive address" src="${dataUrl}" />`;
  } catch {
    const target = root!.querySelector<HTMLElement>("#receive-qr");
    if (target) target.textContent = "QR generation failed. Use the copy-address control instead.";
  }
}

async function runSync() {
  const status = root!.querySelector<HTMLElement>("#engine-status");
  const button = root!.querySelector<HTMLButtonElement>("#sync-button");
  if (!status || !button || engineBusy) return;
  engineBusy = true; syncVerified = false; button.disabled = true; status.textContent = "Syncing testnet…";
  const receiveNav = root!.querySelector<HTMLButtonElement>('[data-action="receive"]');
  if (receiveNav) { receiveNav.disabled = true; receiveNav.classList.add("disabled-nav"); }
  const sendNav = root!.querySelector<HTMLButtonElement>('[data-action="send"]');
  if (sendNav) { sendNav.disabled = true; sendNav.classList.add("disabled-nav"); }
  try {
    const password = window.prompt("Enter your wallet password to encrypt and save the updated testnet wallet database on this device.");
    if (!password) { status.textContent = "Sync cancelled"; return; }
    await verifyWalletPassword(password);
    const result = await syncTestnetWallet();
    await persistEncryptedWalletDatabase(result.database, engineState?.accountId ?? -1, password);
    const history = await getTestnetHistory();
    status.textContent = `Sync returned · tip ${result.chainHeight} · scanned ${result.scannedHeight}`;
    const balanceContent = root!.querySelector<HTMLElement>("#balance-content");
    if (balanceContent) {
      const zec = (value: number) => (value / 100_000_000).toLocaleString("en-US", { minimumFractionDigits: 8, maximumFractionDigits: 8 });
      const fullyScanned = Number(result.scannedHeight) >= Number(result.chainHeight);
      syncVerified = fullyScanned;
      const receiveNav = root!.querySelector<HTMLButtonElement>('[data-action="receive"]');
      if (receiveNav) { receiveNav.disabled = !fullyScanned; receiveNav.classList.toggle("disabled-nav", !fullyScanned); receiveNav.title = fullyScanned ? "Show verified testnet receive address" : "Sync the testnet wallet before receiving funds"; }
      const sendNav = root!.querySelector<HTMLButtonElement>('[data-action="send"]');
      if (sendNav) { sendNav.disabled = !fullyScanned; sendNav.classList.toggle("disabled-nav", !fullyScanned); sendNav.title = fullyScanned ? "Review a testnet transaction" : "Sync the testnet wallet before sending"; }
      balanceContent.innerHTML = `<div class="balance-panel"><div class="balance-title">Observed testnet balance <span>${fullyScanned ? "SCAN AT TIP" : "PARTIAL SCAN"}</span></div><div class="balance-total">${zec(result.shieldedBalance + result.transparentBalance + result.pendingBalance)} <small>ZEC</small></div><div class="balance-breakdown"><div><span>Shielded</span><strong>${zec(result.shieldedBalance)}</strong></div><div><span>Transparent</span><strong>${zec(result.transparentBalance)}</strong></div><div><span>Pending</span><strong>${zec(result.pendingBalance)}</strong></div></div><p class="small-note">${fullyScanned ? "The wallet reports its scan at the current chain tip. Verify with transaction history before relying on this balance." : "This is a partial scan and may not include all incoming activity. Keep syncing until the scanned height catches up."}</p></div>`;
    }
    const historyContent = root!.querySelector<HTMLElement>("#history-content");
    if (historyContent) {
      const zec = (value: string) => (Number(value) / 100_000_000).toFixed(8);
      const typeLabel = (type: number) => type === 0 ? "Received" : type === 1 ? "Sent" : type === 2 ? "Shielded" : "Transaction";
      const statusLabel = (value: number) => value === 0 ? "Confirmed" : value === 1 ? "Pending" : value === 2 ? "Expired" : "Unknown";
      historyContent.innerHTML = `<div class="history-panel"><div class="balance-title">Recent activity <span>${history.totalCount} TOTAL</span></div>${history.transactions.length ? history.transactions.map((tx) => `<div class="history-row"><div class="history-main"><strong>${typeLabel(tx.type)}</strong><span>${statusLabel(tx.status)} · ${tx.confirmations} confirmations</span><code>${escapeHtml(tx.txid.slice(0, 14))}…${escapeHtml(tx.txid.slice(-8))}</code></div><div class="history-value">${zec(tx.value)}<small>ZEC</small></div></div>`).join("") : '<p class="small-note">No transactions returned for this account yet. A partial scan may not include all activity.</p>'}</div>`;
    }
    feedback("The latest testnet scan result and transaction history were loaded. Verify scan completeness before relying on this data.");
  } catch (error) {
    status.textContent = "Sync failed";
    feedback(error instanceof Error ? error.message : "Testnet synchronization failed.", true);
  } finally { engineBusy = false; button.disabled = false; }
}

function feedback(message: string, error = false) {
  const element = root!.querySelector<HTMLDivElement>("#feedback");
  if (!element) return;
  element.textContent = message;
  element.className = `feedback visible ${error ? "error" : "success"}`;
}

root.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (engineBusy && action && ["home", "vault", "receive", "send", "cancel-transfer", "create", "restore", "unlock", "reveal"].includes(action)) {
    feedback("Wait for the active wallet operation to finish before navigating away.", true);
    return;
  }
  if (action === "home") { screen = "home"; phraseVisible = false; homeView(); }
  else if (action === "create") {
    if (vaultExists()) return feedback("A vault already exists. Unlock it or restore only after safely removing the existing vault.", true);
    try { pendingPhrase = createRecoveryPhrase(); screen = "create-phrase"; phraseView(); }
    catch (error) { feedback(error instanceof Error ? error.message : "Secure wallet creation is unavailable.", true); }
  } else if (action === "phrase-next") { screen = "create-password"; passwordView("create"); }
  else if (action === "phrase-back") { screen = "create-phrase"; phraseView(); }
  else if (action === "restore") { screen = "restore"; passwordView("restore"); }
  else if (action === "unlock") { screen = "unlock"; unlockView(); }
  else if (action === "vault") { screen = "vault"; void vaultView(); }
  else if (action === "receive") { void receiveView(); }
  else if (action === "send") { sendView(); }
  else if (action === "cancel-transfer") { cancelPendingTestnetTransfer(); pendingTransferDetails = null; screen = "send"; sendView(); }
  else if (action === "confirm-send") { void confirmSend(); }
  else if (action === "copy-txid") { const txid = button.dataset.txid; if (txid) navigator.clipboard.writeText(txid).then(() => feedback("Transaction ID copied."), () => feedback("Could not copy transaction ID.", true)); }
  else if (action === "send-result-back") { screen = "vault"; void vaultView(); }
  else if (action === "reveal") { phraseVisible = !phraseVisible; void vaultView(); }
  else if (action === "copy-address" || action === "copy-transparent") { const address = action === "copy-address" ? engineState?.unifiedAddress : engineState?.transparentAddress; if (address) navigator.clipboard.writeText(address).then(() => feedback("Address copied."), () => feedback("Could not copy address. Select and copy it manually.", true)); }
  else if (action === "sync") { void runSync(); }
  else if (action === "lock") { if (engineBusy) { feedback("Wait for the active sync to finish before locking.", true); return; } lifecycleGeneration += 1; lockVault(); cancelPendingTestnetTransfer(); pendingTransferDetails = null; releaseTestnetWallet(); engineState = null; syncVerified = false; phraseVisible = false; screen = "home"; homeView(); feedback("Vault locked for this browser session."); }
});

homeView();
