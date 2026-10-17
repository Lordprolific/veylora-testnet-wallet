import { getNoirWallet } from "@noir-wallet/sdk";
import "./style.css";

const connectButton = document.querySelector<HTMLButtonElement>("#connect-button")!;
const refreshButton = document.querySelector<HTMLButtonElement>("#refresh-button")!;
const stateBadge = document.querySelector<HTMLElement>("#state-badge")!;
const providerMessage = document.querySelector<HTMLElement>("#provider-message")!;
const feedback = document.querySelector<HTMLElement>("#feedback")!;
const transparentAddress = document.querySelector<HTMLElement>("#transparent-address")!;
const shieldedAddress = document.querySelector<HTMLElement>("#shielded-address")!;
const accountCount = document.querySelector<HTMLElement>("#account-count")!;
const balance = document.querySelector<HTMLElement>("#balance")!;

type ConnectionResult = { transparent?: string; shielded?: string; accounts?: unknown[] };

function setState(label: string, connected: boolean) {
  stateBadge.textContent = label;
  stateBadge.dataset.connected = String(connected);
}
function shortAddress(value: unknown): string {
  if (typeof value !== "string" || !value) return "Not shared";
  return value.length <= 24 ? value : value.slice(0, 12) + "…" + value.slice(-8);
}
function renderConnection(result: ConnectionResult | null) {
  if (!result) {
    setState("NOT CONNECTED", false);
    transparentAddress.textContent = "Not shared";
    shieldedAddress.textContent = "Not shared";
    accountCount.textContent = "—";
    balance.textContent = "Not requested";
    return;
  }
  setState("CONNECTED", true);
  transparentAddress.textContent = shortAddress(result.transparent);
  shieldedAddress.textContent = shortAddress(result.shielded);
  accountCount.textContent = String(Array.isArray(result.accounts) ? result.accounts.length : 1);
}
async function findWallet() {
  try {
    const wallet = getNoirWallet();
    if (!wallet) {
      providerMessage.textContent = "No Noir Wallet provider detected. Install the official testnet extension, then reload this page.";
      setState("PROVIDER NOT FOUND", false);
      connectButton.disabled = true;
      return null;
    }
    providerMessage.textContent = "Provider detected. Confirm the installed extension is the official testnet build before use.";
    connectButton.disabled = false;
    return wallet;
  } catch {
    providerMessage.textContent = "The wallet provider could not be checked in this browser context.";
    setState("UNAVAILABLE", false);
    connectButton.disabled = true;
    return null;
  }
}
async function checkExistingConnection() {
  feedback.textContent = "Checking for an existing authorized session…";
  balance.textContent = "Not requested";
  try {
    const wallet = await findWallet();
    if (!wallet) { renderConnection(null); feedback.textContent = "No compatible provider is available."; return; }
    const connection = await wallet.zcash.getAccounts();
    renderConnection(connection as ConnectionResult | null);
    feedback.textContent = connection ? "Existing authorized connection restored." : "No existing authorization. Choose Connect wallet to approve access.";
  } catch {
    renderConnection(null);
    feedback.textContent = "Could not restore the connection. Check the wallet extension and try again.";
  }
}
connectButton.addEventListener("click", async () => {
  connectButton.disabled = true;
  feedback.textContent = "Waiting for wallet approval…";
  balance.textContent = "Not requested";
  try {
    const wallet = await findWallet();
    if (!wallet) { feedback.textContent = "Provider not found. Install the official testnet build."; return; }
    const connection = await wallet.zcash.connect();
    renderConnection(connection as ConnectionResult);
    feedback.textContent = "Connection approved. No transaction was created or signed.";
    try {
      const currentBalance = await wallet.zcash.getBalance();
      const available = "available" in currentBalance ? String(currentBalance.available) : "Unavailable";
      const shielded = "shielded" in currentBalance ? String(currentBalance.shielded) : "Unavailable";
      balance.textContent = "Available: " + available + " · Shielded: " + shielded;
    } catch { balance.textContent = "Balance unavailable"; }
  } catch { feedback.textContent = "Connection was rejected or failed. No transaction was sent."; }
  finally { connectButton.disabled = false; }
});
refreshButton.addEventListener("click", () => void checkExistingConnection());
void checkExistingConnection();
