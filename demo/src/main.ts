import { getNoirWallet } from "@noir-wallet/sdk";
import "./style.css";
import { formatBalance, isSupportedTestnetAddress, isValidZecAmount, memoByteLength, shortenAddress, supportsPrivateMemo } from "./presentation";

const connectButton = document.querySelector<HTMLButtonElement>("#connect-button")!;
const refreshButton = document.querySelector<HTMLButtonElement>("#refresh-button")!;
const stateBadge = document.querySelector<HTMLElement>("#state-badge")!;
const providerMessage = document.querySelector<HTMLElement>("#provider-message")!;
const feedback = document.querySelector<HTMLElement>("#feedback")!;
const transparentAddress = document.querySelector<HTMLElement>("#transparent-address")!;
const shieldedAddress = document.querySelector<HTMLElement>("#shielded-address")!;
const accountCount = document.querySelector<HTMLElement>("#account-count")!;
const balance = document.querySelector<HTMLElement>("#balance")!;
const paymentForm = document.querySelector<HTMLFormElement>("#payment-form")!;
const recipientInput = document.querySelector<HTMLInputElement>("#recipient")!;
const amountInput = document.querySelector<HTMLInputElement>("#amount")!;
const fundingSourceInput = document.querySelector<HTMLSelectElement>("#funding-source")!;
const memoInput = document.querySelector<HTMLTextAreaElement>("#memo")!;
const testnetConfirm = document.querySelector<HTMLInputElement>("#testnet-confirm")!;
const sendButton = document.querySelector<HTMLButtonElement>("#send-button")!;
const paymentFeedback = document.querySelector<HTMLElement>("#payment-feedback")!;
const txResult = document.querySelector<HTMLElement>("#tx-result")!;
const historyRefresh = document.querySelector<HTMLButtonElement>("#history-refresh")!;
const historyContent = document.querySelector<HTMLElement>("#history-content")!;

type Account = { id?: string; label?: string; walletId?: string; accountId?: string };
type ConnectionResult = { transparent: string; shielded: string; accounts: Account[] };
type HistoryEntry = { txid?: string; type?: string; amount?: string; status?: string; timestamp?: number; memo?: string };

let connectedWallet: ReturnType<typeof getNoirWallet> = null;
let activeConnection: ConnectionResult | null = null;
let subscribedWallet: ReturnType<typeof getNoirWallet> = null;
let busy = false;

function setState(label: string, connected: boolean) {
  stateBadge.textContent = label;
  stateBadge.dataset.connected = String(connected);
}

function updateActionAvailability() {
  const connected = Boolean(connectedWallet && activeConnection);
  sendButton.disabled = !connected || busy || !testnetConfirm.checked;
  historyRefresh.disabled = !connected || busy;
  refreshButton.disabled = busy;
  connectButton.disabled = busy || !connectedWallet;
}

function renderConnection(connection: ConnectionResult | null) {
  activeConnection = connection;
  const copyButtons = document.querySelectorAll<HTMLButtonElement>("[data-copy]");
  if (!connection) {
    setState("NOT CONNECTED", false);
    transparentAddress.textContent = "Not shared";
    shieldedAddress.textContent = "Not shared";
    accountCount.textContent = "—";
    balance.textContent = "Not requested";
    copyButtons.forEach(button => button.disabled = true);
    updateActionAvailability();
    return;
  }
  setState("CONNECTED", true);
  transparentAddress.textContent = shortenAddress(connection.transparent);
  shieldedAddress.textContent = shortenAddress(connection.shielded);
  accountCount.textContent = String(Array.isArray(connection.accounts) ? connection.accounts.length : 0);
  copyButtons.forEach(button => button.disabled = false);
  updateActionAvailability();
}

async function refreshBalance() {
  const wallet = connectedWallet;
  const connection = activeConnection;
  if (!wallet || !connection) {
    balance.textContent = "Not requested";
    return;
  }
  balance.textContent = "Loading…";
  try {
    const selectedAccountId = connection.accounts?.[0]?.id;
    const result = selectedAccountId
      ? await wallet.zcash.getBalance(selectedAccountId)
      : await wallet.zcash.getBalance();
    balance.textContent = formatBalance(result);
  } catch {
    balance.textContent = "Balance unavailable. Unlock or sync your wallet, then refresh.";
  }
}

function subscribeToAccountChanges(wallet: NonNullable<ReturnType<typeof getNoirWallet>>) {
  if (subscribedWallet === wallet) return;
  subscribedWallet = wallet;
  wallet.zcash.on("accountsChanged", () => {
    void checkExistingConnection("Wallet accounts changed. Refreshing the authorized session…");
  });
}

async function checkExistingConnection(message?: string) {
  busy = true;
  updateActionAvailability();
  feedback.textContent = message ?? "Checking for an existing authorized session…";
  balance.textContent = "Not requested";
  try {
    const wallet = getNoirWallet();
    connectedWallet = wallet;
    if (!wallet) {
      renderConnection(null);
      setState("PROVIDER NOT FOUND", false);
      providerMessage.textContent = "No Noir Wallet provider detected. Install the official testnet extension, then reload this page.";
      feedback.textContent = "No compatible provider is available.";
      historyContent.replaceChildren(makeMessage("Connect Noir Wallet to inspect transaction history."));
      return;
    }
    providerMessage.textContent = "Provider detected. Confirm the installed extension is the official testnet build before use.";
    subscribeToAccountChanges(wallet);
    const connection = await wallet.zcash.getAccounts();
    renderConnection(connection as ConnectionResult | null);
    if (connection) {
      feedback.textContent = "Existing authorized connection restored.";
      await refreshBalance();
    } else {
      feedback.textContent = "No existing authorization. Choose Connect wallet to approve access.";
    }
  } catch {
    renderConnection(null);
    feedback.textContent = "Could not restore the connection. Check the wallet extension and try again.";
  } finally {
    busy = false;
    updateActionAvailability();
  }
}

connectButton.addEventListener("click", async () => {
  busy = true;
  updateActionAvailability();
  feedback.textContent = "Waiting for wallet approval…";
  try {
    const wallet = getNoirWallet();
    connectedWallet = wallet;
    if (!wallet) {
      renderConnection(null);
      setState("PROVIDER NOT FOUND", false);
      providerMessage.textContent = "No Noir Wallet provider detected. Install the official testnet extension, then reload this page.";
      feedback.textContent = "Provider not found. Install the official testnet build.";
      return;
    }
    subscribeToAccountChanges(wallet);
    const connection = await wallet.zcash.connect();
    renderConnection(connection as ConnectionResult);
    feedback.textContent = "Connection approved. No transaction was created or signed.";
    await refreshBalance();
  } catch {
    feedback.textContent = "Connection was rejected or failed. No transaction was sent.";
  } finally {
    busy = false;
    updateActionAvailability();
  }
});

refreshButton.addEventListener("click", () => void checkExistingConnection());

document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach(button => {
  button.addEventListener("click", async () => {
    const target = document.getElementById(button.dataset.copy ?? "");
    const value = target?.textContent ?? "";
    if (!activeConnection || !value || value === "Not shared") return;
    const fullValue = button.dataset.copy === "transparent-address"
      ? activeConnection.transparent : activeConnection.shielded;
    try {
      await navigator.clipboard.writeText(fullValue);
      button.textContent = "Copied";
      window.setTimeout(() => { button.textContent = "Copy"; }, 1200);
    } catch {
      feedback.textContent = "Clipboard access was blocked. Select the address from your wallet to copy it.";
    }
  });
});

testnetConfirm.addEventListener("change", updateActionAvailability);

function showTransactionResult(txid: string) {
  txResult.hidden = false;
  txResult.replaceChildren();
  const heading = document.createElement("strong");
  heading.textContent = "Wallet returned a transaction ID";
  const hash = document.createElement("code");
  hash.textContent = txid;
  const copy = document.createElement("button");
  copy.className = "secondary compact";
  copy.type = "button";
  copy.textContent = "Copy transaction ID";
  copy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(txid); copy.textContent = "Copied"; }
    catch { paymentFeedback.textContent = "Could not access clipboard. Select the transaction ID to copy it."; }
  });
  const note = document.createElement("p");
  note.textContent = "Check the wallet and a trusted testnet explorer for confirmation. A returned ID does not itself mean the transaction is mined.";
  txResult.append(heading, hash, copy, note);
}

paymentForm.addEventListener("submit", async event => {
  event.preventDefault();
  const wallet = connectedWallet;
  if (!wallet || !activeConnection) {
    paymentFeedback.textContent = "Connect Noir Wallet first.";
    return;
  }
  if (!testnetConfirm.checked) {
    paymentFeedback.textContent = "Confirm testnet in the wallet before preparing a payment.";
    return;
  }
  const to = recipientInput.value.trim();
  const amount = amountInput.value.trim();
  const memo = memoInput.value;
  if (!isSupportedTestnetAddress(to)) {
    paymentFeedback.textContent = "That address format is not recognized as a supported Zcash testnet address. Check the full address and network.";
    recipientInput.focus();
    return;
  }
  if (!isValidZecAmount(amount)) {
    paymentFeedback.textContent = "Enter a positive ZEC amount with up to 8 decimal places.";
    amountInput.focus();
    return;
  }
  if (memo && !supportsPrivateMemo(to)) {
    paymentFeedback.textContent = "A private memo is only supported for a shielded recipient address.";
    memoInput.focus();
    return;
  }
  if (memoByteLength(memo) > 512) {
    paymentFeedback.textContent = "The memo must be no more than 512 UTF-8 bytes.";
    memoInput.focus();
    return;
  }

  busy = true;
  updateActionAvailability();
  txResult.hidden = true;
  paymentFeedback.textContent = "Opening Noir Wallet for transaction review. Verify the network, recipient, amount, and funding source in the wallet.";
  try {
    const txid = await wallet.zcash.sendTransaction({
      to,
      amount,
      fundingSource: fundingSourceInput.value as "shielded" | "transparent",
      ...(memo ? { memo } : {})
    });
    showTransactionResult(txid);
    paymentFeedback.textContent = "Wallet returned a transaction ID. Waiting for you to verify its status.";
    await refreshBalance();
    await loadHistory();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    paymentFeedback.textContent = message.toLowerCase().includes("reject") || message.toLowerCase().includes("cancel")
      ? "Transaction was rejected or cancelled in the wallet. No successful send was reported."
      : "Transaction failed or was not completed. Check the wallet for details; do not retry until you know its status.";
  } finally {
    busy = false;
    updateActionAvailability();
  }
});

function makeMessage(message: string): HTMLParagraphElement {
  const p = document.createElement("p");
  p.className = "empty-state";
  p.textContent = message;
  return p;
}

function formatTime(timestamp: unknown): string {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return "Time unavailable";
  try { return new Date(timestamp).toLocaleString(); } catch { return "Time unavailable"; }
}

async function loadHistory() {
  const wallet = connectedWallet;
  if (!wallet || !activeConnection) {
    historyContent.replaceChildren(makeMessage("Connect your wallet before requesting history."));
    return;
  }
  historyRefresh.disabled = true;
  historyContent.replaceChildren(makeMessage("Requesting history from Noir Wallet…"));
  try {
    const history = await wallet.zcash.getTransactionHistory() as HistoryEntry[];
    if (!Array.isArray(history) || history.length === 0) {
      historyContent.replaceChildren(makeMessage("No transaction history was returned for this wallet."));
      return;
    }
    const table = document.createElement("div");
    table.className = "history-list";
    history.slice(0, 30).forEach(entry => {
      const row = document.createElement("article");
      row.className = "history-item";
      const top = document.createElement("div");
      top.className = "history-top";
      const kind = document.createElement("strong");
      kind.textContent = (entry.type ?? "transaction").replaceAll("_", " ");
      const status = document.createElement("span");
      status.className = "tx-status";
      status.dataset.status = entry.status ?? "unknown";
      status.textContent = entry.status ?? "unknown";
      top.append(kind, status);
      const amount = document.createElement("p");
      amount.className = "history-amount";
      amount.textContent = typeof entry.amount === "string" ? entry.amount + " ZEC" : "Amount unavailable";
      const id = document.createElement("code");
      id.textContent = entry.txid ?? "Transaction ID unavailable";
      const time = document.createElement("span");
      time.className = "history-time";
      time.textContent = formatTime(entry.timestamp);
      row.append(top, amount, id, time);
      table.append(row);
    });
    historyContent.replaceChildren(table);
  } catch {
    historyContent.replaceChildren(makeMessage("History could not be loaded. Unlock or sync the wallet and try again."));
  } finally {
    historyRefresh.disabled = false;
    updateActionAvailability();
  }
}

historyRefresh.addEventListener("click", () => void loadHistory());
void checkExistingConnection();
