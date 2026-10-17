import "./style.css";
import {
  createRecoveryPhrase,
  validateRecoveryPhrase,
  vaultExists,
  createEncryptedVault,
  restoreEncryptedVault,
  unlockVault,
  getUnlockedRecoveryPhrase,
  lockVault,
} from "./wallet/lifecycle.js";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Wallet root element is missing");

type Screen = "home" | "create-phrase" | "create-password" | "restore" | "unlock" | "vault";
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
        <button class="nav disabled-nav" disabled title="Available after wallet engine integration"><span>↗</span> Send</button>
        <button class="nav disabled-nav" disabled title="Available after wallet engine integration"><span>＋</span> Receive</button>
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
      <div class="notice"><span class="notice-icon">!</span><div><strong>Do not deposit testnet funds yet</strong><p>Recovery phrase vault setup is implemented, but address derivation, chain synchronization, balances, and sending still require WebZjs integration and end-to-end tests. Send and Receive remain disabled until then.</p></div></div>
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
      else await restoreEncryptedVault(phrase, password);
      pendingPhrase = "";
      screen = "vault";
      vaultView();
      feedback("Encrypted vault created on this device.");
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
      vaultView();
      feedback("Vault unlocked for this browser session.");
    } catch (error) { feedback(error instanceof Error ? error.message : "Could not unlock the vault.", true); }
  });
}

function vaultView() {
  const phrase = getUnlockedRecoveryPhrase();
  if (!phrase) { screen = "home"; return homeView(); }
  shell(`
    <section class="flow-card narrow">
      <div class="eyebrow">LOCAL VAULT</div><h2>Vault unlocked</h2>
      <p class="flow-copy">Your recovery phrase is decrypted in this browser session. The Zcash network engine is not connected yet, so no address or balance is available in this build.</p>
      <div class="status-panel">
        <div class="status-row"><span class="status-indicator status-ready"></span><span>Encrypted recovery phrase</span><strong>UNLOCKED</strong></div>
        <div class="status-row"><span class="status-indicator"></span><span>Zcash account/address</span><strong>NOT YET DERIVED</strong></div>
        <div class="status-row"><span class="status-indicator"></span><span>Chain sync and payments</span><strong>NOT AVAILABLE</strong></div>
      </div>
      <button class="secondary full-button" data-action="reveal">${phraseVisible ? "Hide recovery phrase" : "Reveal recovery phrase"}</button>
      ${phraseVisible ? `<div class="phrase-reveal"><p>Keep this phrase private. Anyone who sees it can control the wallet.</p><div>${phrase.split(" ").map((word, i) => `<span><small>${i + 1}</small>${escapeHtml(word)}</span>`).join("")}</div></div>` : ""}
      <div class="actions"><button class="secondary" data-action="lock">Lock wallet</button><button class="secondary" data-action="home">Overview</button></div>
    </section>`);
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
  if (action === "home") { screen = "home"; phraseVisible = false; homeView(); }
  else if (action === "create") {
    if (vaultExists()) return feedback("A vault already exists. Unlock it or restore only after safely removing the existing vault.", true);
    try { pendingPhrase = createRecoveryPhrase(); screen = "create-phrase"; phraseView(); }
    catch (error) { feedback(error instanceof Error ? error.message : "Secure wallet creation is unavailable.", true); }
  } else if (action === "phrase-next") { screen = "create-password"; passwordView("create"); }
  else if (action === "phrase-back") { screen = "create-phrase"; phraseView(); }
  else if (action === "restore") { screen = "restore"; passwordView("restore"); }
  else if (action === "unlock") { screen = "unlock"; unlockView(); }
  else if (action === "vault") { screen = "vault"; vaultView(); }
  else if (action === "reveal") { phraseVisible = !phraseVisible; vaultView(); }
  else if (action === "lock") { lockVault(); phraseVisible = false; screen = "home"; homeView(); feedback("Vault locked for this browser session."); }
});

homeView();
