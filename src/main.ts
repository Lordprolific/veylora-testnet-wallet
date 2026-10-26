import "./style.css";
import QRCode from "qrcode";
import { createTestnetAccount, restoreTestnetAccount, getTestnetHistory, prepareTestnetTransfer, cancelPendingTestnetTransfer, authorizeAndBroadcastTestnetTransfer, getTestnetDatabase, releaseTestnetWallet } from "./wallet/zcash-engine.js";

const WALLET_META_KEY = "veylora.testnet-wallet-meta.v1";
let engineState: { accountId: number; unifiedAddress: string; transparentAddress: string; chainHeight: string; scannedHeight: string; birthdayHeight: number; database: Uint8Array; networkError?: string | null } | null = null;
let engineBusy = false;
let lifecycleGeneration = 0;
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

type Screen = "home" | "create-phrase" | "confirm-phrase" | "create-password" | "restore" | "unlock" | "vault" | "receive" | "activity" | "send" | "send-review" | "send-result";
let screen: Screen = "home";
let pendingPhrase = "";
let phraseChallengeIndexes: number[] = [];
let phraseVisible = false;
let busy = false;
const AUTO_LOCK_MS = 5 * 60 * 1000;
let autoLockTimer: number | null = null;
let autoLockListenersAttached = false;

function clearAutoLockTimer() {
  if (autoLockTimer !== null) window.clearTimeout(autoLockTimer);
  autoLockTimer = null;
}

function armAutoLockTimer() {
  clearAutoLockTimer();
  if (!getUnlockedRecoveryPhrase()) return;
  autoLockTimer = window.setTimeout(() => {
    lifecycleGeneration += 1;
    lockVault();
    cancelPendingTestnetTransfer();
    pendingTransferDetails = null;
    releaseTestnetWallet();
    engineState = null;
    phraseVisible = false;
    screen = "home";
    homeView();
    feedback("Wallet locked after 5 minutes of inactivity. Enter your password to unlock it.");
  }, AUTO_LOCK_MS);
}

function setupAutoLock() {
  if (autoLockListenersAttached) return;
  autoLockListenersAttached = true;
  const activity = () => { if (getUnlockedRecoveryPhrase()) armAutoLockTimer(); };
  ["pointerdown", "keydown", "touchstart", "wheel"].forEach((eventName) => {
    window.addEventListener(eventName, activity, { passive: true });
  });
}

function setupRecoveryPhraseInputs() {
  const grid = root!.querySelector<HTMLDivElement>("#recovery-phrase-grid");
  if (!grid) return;
  grid.addEventListener("paste", (event) => {
    const clipboard = event as ClipboardEvent;
    const raw = clipboard.clipboardData?.getData("text") ?? "";
    const words = raw.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length !== 24) return;
    clipboard.preventDefault();
    grid.querySelectorAll<HTMLInputElement>("input[data-word-index]").forEach((input, index) => { input.value = words[index] ?? ""; });
    feedback("All 24 recovery words were filled in. Check the order before continuing.");
  });
  grid.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.matches("input[data-word-index]")) return;
    if (/\s/.test(target.value.trim())) {
      const words = target.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const inputs = Array.from(grid.querySelectorAll<HTMLInputElement>("input[data-word-index]"));
      const start = Number(target.dataset.wordIndex);
      if (words.length > 1 && start + words.length <= inputs.length) words.forEach((word, offset) => { inputs[start + offset].value = word; });
    }
  });
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char] ?? char));

function shell(content: string) {
  root!.innerHTML = `
    <div class="layout">
      <aside class="rail">
        <div class="brand"><img src="./assets/veylora-mark.svg" alt="" /><span>VEY LORA</span></div>
        <div class="rail-label">WALLET</div>
        <button class="nav ${screen === "home" || screen === "vault" ? "active" : ""}" data-action="${getUnlockedRecoveryPhrase() ? "vault" : "home"}"><span>▦</span> Overview</button>
        <button class="nav ${screen === "send" || screen === "send-review" ? "active" : ""} " data-action="send"  title="Review a testnet transaction"><span>↗</span> Send</button>
        <button class="nav ${screen === "receive" ? "active" : ""} ${engineState ? "" : "disabled-nav"}" data-action="receive" ${engineState ? "" : "disabled"} title="${engineState ? "Show your testnet receive address" : "Create or unlock the wallet to derive an address"}"><span>＋</span> Receive</button>
        <button class="nav ${screen === "activity" ? "active" : ""} ${engineState ? "" : "disabled-nav"}" data-action="activity" ${engineState ? "" : "disabled"} title="${engineState ? "View wallet activity" : "Unlock your wallet to view activity"}"><span>≋</span> Activity</button>
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
      <div class="notice info-notice"><span class="notice-icon">i</span><div><strong>Testnet workspace</strong><p>Testnet coins have no monetary value. Your receive address is available as soon as it is derived. No history scan is required to open the wallet. Balance and activity appear when available from the network.</p></div></div>
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

function confirmPhraseView() {
  const words = pendingPhrase.split(" ");
  if (words.length !== 24) { screen = "create-phrase"; return phraseView(); }
  if (phraseChallengeIndexes.length !== 3) {
    const selected = new Set<number>();
    while (selected.size < 3) {
      const value = new Uint32Array(1);
      crypto.getRandomValues(value);
      selected.add(value[0] % words.length);
    }
    phraseChallengeIndexes = Array.from(selected).sort((a, b) => a - b);
  }
  screen = "confirm-phrase";
  shell(`
    <section class="flow-card narrow">
      <button class="back-link" data-action="phrase-confirm-back">← Back to recovery phrase</button>
      <div class="eyebrow">BACKUP CHECK · STEP 2 OF 3</div>
      <h2>Confirm your recovery phrase</h2>
      <p class="flow-copy">Enter the three words requested below. This verifies that you have a usable backup before the wallet is encrypted.</p>
      <form id="phrase-challenge-form">
        ${phraseChallengeIndexes.map((index) => `<label class="field-label" for="phrase-word-${index}">Word ${index + 1}</label><input id="phrase-word-${index}" name="word-${index}" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" required />`).join("")}
        <button class="primary form-submit" type="submit">Confirm backup <span>↗</span></button>
      </form>
    </section>`);
  root!.querySelector<HTMLFormElement>("#phrase-challenge-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const valid = phraseChallengeIndexes.every((index) =>
      (root!.querySelector<HTMLInputElement>(`#phrase-word-${index}`)?.value ?? "").trim().toLowerCase() === words[index].toLowerCase()
    );
    if (!valid) return feedback("One or more words did not match. Check your written backup and try again.", true);
    screen = "create-password";
    passwordView("create");
  });
}

function passwordView(mode: "create" | "restore") {
  shell(`
    <section class="flow-card narrow">
      <button class="back-link" data-action="${mode === "create" ? "phrase-back" : "home"}">← Back</button>
      <div class="eyebrow">${mode === "create" ? "STEP 2 OF 2 · ENCRYPTION" : "WALLET RECOVERY"}</div>
      <h2>${mode === "create" ? "Protect your wallet" : "Restore your wallet"}</h2>
      <p class="flow-copy">${mode === "create" ? "Create a strong password to encrypt your recovery phrase on this device. Use at least 8 characters." : "Enter your 24-word recovery phrase and choose a new local encryption password."}</p>
      ${mode === "restore" ? '<label class="field-label">24-word recovery phrase</label><p class="password-hint recovery-template-hint">Paste the complete phrase into any word box. All 24 positions fill automatically.</p><div id="recovery-phrase-grid" class="recovery-phrase-grid">' + Array.from({length:24},(_,i)=>'<label class="recovery-word-field"><span>'+(i+1)+'</span><input data-word-index="'+i+'" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Recovery word '+(i+1)+'" placeholder="Word '+(i+1)+'" /></label>').join('') + '</div>' : ""}

      <form id="password-form">
        ${mode === "restore" && vaultExists() ? '<label class="check-row destructive-check"><input type="checkbox" id="replace-existing" required /> I understand this will replace the existing encrypted vault on this device.</label>' : ""}
        <label class="field-label" for="password">${mode === "restore" ? "New wallet password" : "Wallet password"}</label>
        <input id="password" type="password" minlength="8" maxlength="1024" autocomplete="new-password" required placeholder="At least 8 characters" />
        <label class="field-label" for="password-confirm">Confirm password</label>
        <input id="password-confirm" type="password" minlength="8" maxlength="1024" autocomplete="new-password" required placeholder="Enter it again" />
        <div class="password-hint">This password encrypts your local vault. If you forget it, you must restore with your recovery phrase.</div>
        <button class="primary form-submit" type="submit" ${busy ? "disabled" : ""}>${mode === "create" ? "Encrypt and create vault" : "Restore and encrypt vault"} <span>↗</span></button>
      </form>
    </section>`);
  if (mode === "restore") setupRecoveryPhraseInputs();
  root!.querySelector<HTMLFormElement>("#password-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = root!.querySelector<HTMLInputElement>("#password")?.value ?? "";
    const confirm = root!.querySelector<HTMLInputElement>("#password-confirm")?.value ?? "";
    if (password.length < 8) return feedback("Use at least 8 characters for the password.", true);
    if (password !== confirm) return feedback("The passwords do not match.", true);
    let phrase = pendingPhrase;
    if (mode === "restore") {
      const raw = Array.from(root!.querySelectorAll<HTMLInputElement>("#recovery-phrase-grid input[data-word-index]"), (input) => input.value.trim().toLowerCase()).join(" ");
      try { phrase = validateRecoveryPhrase(raw); } catch (error) { return feedback(error instanceof Error ? error.message : "Invalid recovery phrase.", true); }
    }
    busy = true;
    try {
      if (mode === "create") await createEncryptedVault(phrase, password);
      else await restoreEncryptedVault(phrase, password, !vaultExists() || Boolean(root!.querySelector<HTMLInputElement>("#replace-existing")?.checked));
      localStorage.setItem(WALLET_META_KEY, JSON.stringify({ birthdayHeight: null }));
      pendingPhrase = "";
      screen = "vault";
      await vaultView(password);
      setupAutoLock();
      armAutoLockTimer();
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
      setupAutoLock();
      armAutoLockTimer();
      feedback("Vault unlocked. It will lock after 5 minutes without activity.");
    } catch (error) { feedback(error instanceof Error ? error.message : "Could not unlock the vault.", true); }
  });
}

async function vaultView(password?: string) {
  const phrase = getUnlockedRecoveryPhrase();
  if (!phrase) { screen = "home"; return homeView(); }
  screen = "vault";
  shell(`
    <section class="wallet-dashboard">
      <div class="dashboard-heading"><div><div class="eyebrow">YOUR WALLET</div><h2>Overview</h2><p>Self-custody, without the clutter.</p></div><div class="account-chip"><img class="account-avatar" src="./assets/veylora-mark.svg" alt="" /><span><strong>Veylora wallet</strong><small>Local vault · Testnet</small></span><span class="live-dot"></span></div></div>
      <section class="balance-hero">
        <div class="balance-hero-top"><span>Total testnet balance</span><span class="network-pill"><i></i> ZCASH TESTNET</span></div>
        <div id="dashboard-balance"><div class="balance-skeleton">— <small>ZEC</small></div><p>Balance will appear when network data is available.</p></div><div id="balance-content" hidden></div>
        <div class="dashboard-actions"><button class="primary action-large" data-action="receive"><span class="action-symbol">↓</span><span><strong>Receive</strong><small>Get a testnet address</small></span></button><button class="secondary action-large" data-action="send" ${true ? "" : "disabled"}><span class="action-symbol">↗</span><span><strong>Send</strong><small>Transfer testnet ZEC</small></span></button></div>
        <div class="balance-foot"><span class="secure-dot"></span><span>Encrypted locally</span><span class="foot-separator"></span><span>Testnet only</span><span class="small-note">Network data loads independently</span></div>
      </section>
      <div class="dashboard-grid">
        <section class="dashboard-card network-card">
          <div class="section-heading"><div><span class="section-kicker">NETWORK</span><h3>Wallet status</h3></div><span class="status-chip" id="wallet-state-chip">INITIALIZING</span></div>
          <div class="wallet-state-row"><span class="state-icon">◈</span><span><strong>Encrypted vault</strong><small>Your recovery phrase is unlocked locally</small></span><b class="state-good">Unlocked</b></div>
          <div class="wallet-state-row"><span class="state-icon">⌁</span><span><strong>Account address</strong><small>Derived on this device</small></span><b id="address-state">Loading</b></div>
          <div class="wallet-state-row"><span class="state-icon">●</span><span><strong>Network</strong><small id="sync-description">Wallet opened locally</small></span><b id="sync-state">Ready</b></div>
          <div id="engine-status" class="sync-status-line"><span class="status-indicator"></span> Initializing testnet engine…</div>
          
          <div id="engine-error" class="engine-error" hidden></div>
        </section>
        <section class="dashboard-card quick-card">
          <div class="section-heading"><div><span class="section-kicker">QUICK ACCESS</span><h3>Manage wallet</h3></div></div>
          <button class="manage-row" data-action="receive"><span class="manage-icon">↓</span><span><strong>Receive ZEC</strong><small>QR code and address details</small></span><span class="manage-chevron">↗</span></button>
          <button class="manage-row" data-action="activity" ${engineState ? "" : "disabled"}><span class="manage-icon">≋</span><span><strong>Recent activity</strong><small>Incoming and outgoing transactions</small></span><span class="manage-chevron">↗</span></button>
          <button class="manage-row" data-action="reveal"><span class="manage-icon">⌑</span><span><strong>Recovery phrase</strong><small>View your private backup</small></span><span class="manage-chevron">↗</span></button>
          <button class="manage-row" data-action="lock"><span class="manage-icon">⏻</span><span><strong>Lock wallet</strong><small>Close this unlocked session</small></span><span class="manage-chevron">↗</span></button>
        </section>
      </div>
      <section class="dashboard-card address-summary"><div class="section-heading"><div><span class="section-kicker">RECEIVE</span><h3>Your testnet address</h3></div><button class="text-action" data-action="receive">View details ↗</button></div><div id="address-content"><div class="address-placeholder">Deriving your address locally…</div></div></section>
      <section class="dashboard-card activity-summary"><div class="section-heading"><div><span class="section-kicker">ACTIVITY</span><h3>Recent transactions</h3></div><button class="text-action" data-action="activity">View all ↗</button></div><div id="history-content"><div class="empty-activity"><span class="empty-activity-icon">≋</span><strong>Activity will appear here</strong><p>Activity is shown when the wallet engine has data available.</p></div></div></section>
      ${phraseVisible ? `<section class="dashboard-card phrase-reveal"><div class="section-heading"><div><span class="section-kicker">PRIVATE BACKUP</span><h3>Recovery phrase</h3></div><button class="text-action" data-action="reveal">Hide phrase</button></div><p>Keep this phrase private. Anyone who sees it can control the wallet.</p><div>${phrase.split(" ").map((word, i) => `<span><small>${i + 1}</small>${escapeHtml(word)}</span>`).join("")}</div></section>` : ""}
      <div class="dashboard-footer-actions"><span><span class="secure-dot"></span> Keys stay on this device</span><button class="text-action" data-action="lock">Lock wallet</button></div>
    </section>`);
  void initializeEngineForPhrase(phrase, password);
}
async function initializeEngineForPhrase(phrase: string, password?: string) {
  const generation = lifecycleGeneration;
  const status = root!.querySelector<HTMLElement>("#engine-status");
  const panel = root!.querySelector<HTMLElement>("#engine-panel");
  const addressContent = root!.querySelector<HTMLElement>("#address-content");
  if (!status || !addressContent) return;
  if (engineState) {
    status.textContent = engineState.networkError ? "Address ready · network unavailable" : "Address ready";
    const walletChip = root!.querySelector<HTMLElement>("#wallet-state-chip");
    if (walletChip) walletChip.textContent = engineState.networkError ? "NETWORK LIMITED" : "ADDRESS READY";
    const addressState = root!.querySelector<HTMLElement>("#address-state");
    if (addressState) addressState.textContent = "Ready";
    const accountLabels = root!.querySelectorAll<HTMLElement>(".status-panel .status-row strong");
    if (accountLabels[1]) accountLabels[1].textContent = "DERIVED LOCALLY";
    if (accountLabels[2]) accountLabels[2].textContent = engineState.networkError ? "NETWORK UNAVAILABLE" : "NETWORK DATA";
    const indicator = root!.querySelector(".sync-status-line .status-indicator");
    indicator?.classList.add("status-ready");
    const engineError = root!.querySelector<HTMLElement>("#engine-error");
    if (engineError && engineState.networkError) { engineError.hidden = false; engineError.textContent = `Address is ready, but the testnet service is unavailable: ${engineState.networkError}`; }
    addressContent.innerHTML = `<div class="address-block"><label>Unified testnet address</label><code>${escapeHtml(engineState.unifiedAddress)}</code><button class="copy-address" data-action="copy-address">Copy address</button></div><div class="address-block"><label>Transparent testnet address</label><code>${escapeHtml(engineState.transparentAddress)}</code><button class="copy-address" data-action="copy-transparent">Copy address</button></div><p class="small-note">${engineState.networkError ? "Your address was derived locally. Network balances and activity are temporarily unavailable; retry network access before syncing or sending." : "Your address is ready to receive testnet coins. Balance and incoming activity are shown when available from the network."}</p>${engineState.networkError ? '<button class="secondary" data-action="retry-engine">Retry network connection</button>' : ""}`;
    const receiveNav = root!.querySelector<HTMLButtonElement>('[data-action="receive"]');
    if (receiveNav) { receiveNav.disabled = false; receiveNav.classList.remove("disabled-nav"); receiveNav.title = "Show your testnet receive address"; }
    root!.querySelectorAll<HTMLButtonElement>('[data-action="activity"]').forEach((activityButton) => { activityButton.disabled = false; activityButton.classList.remove("disabled-nav"); });
    return;
  }
  status.textContent = "Initializing local WASM…";
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
    status.textContent = engineState.networkError ? "Address ready · network unavailable" : "Address ready";
    const walletChip = root!.querySelector<HTMLElement>("#wallet-state-chip");
    if (walletChip) walletChip.textContent = engineState.networkError ? "NETWORK LIMITED" : "ADDRESS READY";
    const addressState = root!.querySelector<HTMLElement>("#address-state");
    if (addressState) addressState.textContent = "Ready";
    const statusLabels = root!.querySelectorAll<HTMLElement>(".status-panel .status-row strong");
    if (statusLabels[1]) statusLabels[1].textContent = "DERIVED LOCALLY";
    if (statusLabels[2]) statusLabels[2].textContent = engineState.networkError ? "NETWORK UNAVAILABLE" : "SCAN DISABLED";
    root!.querySelector(".sync-status-line .status-indicator")?.classList.add("status-ready");
    const engineError = root!.querySelector<HTMLElement>("#engine-error");
    if (engineError && engineState.networkError) { engineError.hidden = false; engineError.textContent = `Address is ready, but the testnet service is unavailable: ${engineState.networkError}`; }
    addressContent.innerHTML = `<div class="address-block"><label>Unified testnet address</label><code>${escapeHtml(engineState.unifiedAddress)}</code><button class="copy-address" data-action="copy-address">Copy address</button></div><div class="address-block"><label>Transparent testnet address</label><code>${escapeHtml(engineState.transparentAddress)}</code><button class="copy-address" data-action="copy-transparent">Copy address</button></div><p class="small-note">${engineState.networkError ? "Your address was derived locally. Network balances and activity are temporarily unavailable; retry network access before syncing or sending." : "Your address is ready to receive testnet coins. Balance and activity update when network data is available."}</p>`;
    const receiveNav = root!.querySelector<HTMLButtonElement>('[data-action="receive"]');
    if (receiveNav) { receiveNav.disabled = false; receiveNav.classList.remove("disabled-nav"); receiveNav.title = "Show your testnet receive address"; }
    root!.querySelectorAll<HTMLButtonElement>('[data-action="activity"]').forEach((activityButton) => { activityButton.disabled = false; activityButton.classList.remove("disabled-nav"); });
    if (engineState.networkError) feedback("Your address is ready, but the testnet service is currently unavailable. Do not sync or send until network access is restored.", false);
  } catch (error) {
    if (generation !== lifecycleGeneration) return;
    status.textContent = "Engine unavailable";
    const walletChip = root!.querySelector<HTMLElement>("#wallet-state-chip");
    if (walletChip) walletChip.textContent = "UNAVAILABLE";
    const engineError = root!.querySelector<HTMLElement>("#engine-error");
    if (engineError) { engineError.hidden = false; engineError.textContent = error instanceof Error ? error.message : "WebZjs could not initialize in this extension context."; }
    addressContent.innerHTML = `<p class="engine-error">${escapeHtml(error instanceof Error ? error.message : "WebZjs could not initialize in this extension context.")}</p><p class="small-note">Your encrypted vault remains saved. Receiving becomes available when address derivation succeeds; balances depend on network data.</p>`;
    feedback("The vault is encrypted, but the testnet engine could not initialize. Review the engine error and retry.", true);
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
  if (engineState?.networkError) {
    feedback("The testnet service is unavailable. Retry the network connection before preparing or sending a transaction.", true);
    screen = "vault";
    void vaultView();
    return;
  }
  if (!engineState || !getUnlockedRecoveryPhrase()) {
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
      
      cancelPendingTestnetTransfer();
      sendResultView();
    } else {
      feedback(message, true);
      if (button) { button.disabled = false; button.textContent = "Authorize and broadcast"; }
    }
  } finally { engineBusy = false; }
}

async function receiveView() {
  if (!engineState || !getUnlockedRecoveryPhrase()) { screen = "vault"; return void vaultView(); }
  screen = "receive";
  shell(`
    <section class="flow-card narrow receive-card">
      <button class="back-link" data-action="vault">← Back to wallet</button>
      <div class="eyebrow">ZCASH TESTNET · RECEIVE</div>
      <h2>Receive ZEC</h2>
      <p class="flow-copy">Share this address to receive Zcash testnet coins. Incoming activity and balances appear when network data is available. Testnet coins have no monetary value.</p>
      <div class="qr-frame"><div id="receive-qr" class="qr-placeholder">Generating QR…</div></div>
      <label class="field-label">Unified address</label>
      <div class="receive-address"><code>${escapeHtml(engineState.unifiedAddress)}</code></div>
      <button class="primary form-submit" data-action="copy-address">Copy unified address</button>
      <div class="notice info-notice"><span class="notice-icon">i</span><div><strong>Testnet address</strong><p>Only use this address with Zcash testnet funds. Never send mainnet ZEC here.</p></div></div>
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

async function activityView() {
  if (!engineState || !getUnlockedRecoveryPhrase()) { screen = "vault"; return void vaultView(); }
  screen = "activity";
  shell(`
    <section class="activity-page">
      <button class="back-link" data-action="vault">← Back to overview</button>
      <div class="dashboard-heading"><div><div class="eyebrow">WALLET HISTORY</div><h2>Activity</h2><p>Transactions returned by the Zcash testnet wallet engine.</p></div><span class="network-pill"><i></i> TESTNET</span></div>
      <section class="dashboard-card activity-full"><div class="section-heading"><div><span class="section-kicker">TRANSACTIONS</span><h3>Recent activity</h3></div><button class="text-action" data-action="vault">Back to overview ↗</button></div><div id="activity-list"><div class="empty-activity"><span class="empty-activity-icon">≋</span><strong>Loading activity…</strong><p>Reading local wallet history.</p></div></div></section>
    </section>`);
    try {
    const history = await getTestnetHistory();
    const target = root!.querySelector<HTMLElement>("#activity-list");
    if (!target) return;
    const zec = (value: string) => (Number(value) / 100_000_000).toFixed(8);
    const typeLabel = (type: number) => type === 0 ? "Received" : type === 1 ? "Sent" : type === 2 ? "Shielded" : "Transaction";
    const statusLabel = (value: number) => value === 0 ? "Confirmed" : value === 1 ? "Pending" : value === 2 ? "Expired" : "Unknown";
    target.innerHTML = history.transactions.length ? history.transactions.map((tx) => `<div class="history-row"><div class="history-main"><strong>${typeLabel(tx.type)}</strong><span>${statusLabel(tx.status)} · ${tx.confirmations} confirmations</span><code>${escapeHtml(tx.txid.slice(0, 14))}…${escapeHtml(tx.txid.slice(-8))}</code></div><div class="history-value">${zec(tx.value)}<small>ZEC</small></div></div>`).join("") : '<div class="empty-activity"><span class="empty-activity-icon">≋</span><strong>No transactions found</strong><p>No activity was returned for this account yet. No activity has been returned for this account yet.</p></div>';
  } catch (error) {
    const target = root!.querySelector<HTMLElement>("#activity-list");
    if (target) target.innerHTML = `<p class="small-note">${escapeHtml(error instanceof Error ? error.message : "Could not read wallet history.")}</p>`;
  }
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
  if (engineBusy && action && ["home", "vault", "receive", "activity", "send", "cancel-transfer", "create", "restore", "unlock", "reveal"].includes(action)) {
    feedback("Wait for the active wallet operation to finish before navigating away.", true);
    return;
  }
  if (action === "home") { screen = "home"; phraseVisible = false; homeView(); }
  else if (action === "create") {
    if (vaultExists()) return feedback("A vault already exists. Unlock it or restore only after safely removing the existing vault.", true);
    try { pendingPhrase = createRecoveryPhrase(); screen = "create-phrase"; phraseView(); }
    catch (error) { feedback(error instanceof Error ? error.message : "Secure wallet creation is unavailable.", true); }
  } else if (action === "phrase-next") { phraseChallengeIndexes = []; screen = "confirm-phrase"; confirmPhraseView(); }
  else if (action === "phrase-confirm-back") { screen = "create-phrase"; phraseView(); }
  else if (action === "phrase-back") { screen = "create-phrase"; phraseView(); }
  else if (action === "restore") { screen = "restore"; passwordView("restore"); }
  else if (action === "unlock") { screen = "unlock"; unlockView(); }
  else if (action === "vault") { screen = "vault"; void vaultView(); }
  else if (action === "retry-engine") {
    lifecycleGeneration += 1;
    releaseTestnetWallet();
    engineState = null;
    screen = "vault";
    void vaultView();
    feedback("Retrying the testnet connection. Your encrypted vault is unchanged.");
  }
  else if (action === "receive") { void receiveView(); }
  else if (action === "activity") { void activityView(); }
  else if (action === "send") { sendView(); }
  else if (action === "cancel-transfer") { cancelPendingTestnetTransfer(); pendingTransferDetails = null; screen = "send"; sendView(); }
  else if (action === "confirm-send") { void confirmSend(); }
  else if (action === "copy-txid") { const txid = button.dataset.txid; if (txid) navigator.clipboard.writeText(txid).then(() => feedback("Transaction ID copied."), () => feedback("Could not copy transaction ID.", true)); }
  else if (action === "send-result-back") { screen = "vault"; void vaultView(); }
  else if (action === "reveal") { phraseVisible = !phraseVisible; void vaultView(); }
  else if (action === "copy-address" || action === "copy-transparent") { const address = action === "copy-address" ? engineState?.unifiedAddress : engineState?.transparentAddress; if (address) navigator.clipboard.writeText(address).then(() => feedback("Address copied."), () => feedback("Could not copy address. Select and copy it manually.", true)); }
  
  else if (action === "lock") { if (engineBusy) { feedback("Wait for the active wallet operation to finish before locking.", true); return; } clearAutoLockTimer(); lifecycleGeneration += 1; lockVault(); cancelPendingTestnetTransfer(); pendingTransferDetails = null; releaseTestnetWallet(); engineState = null;  phraseVisible = false; screen = "home"; homeView(); feedback("Vault locked for this browser session."); }
});

homeView();
