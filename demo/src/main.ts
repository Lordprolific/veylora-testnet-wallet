import { getNoirWallet } from "@noir-wallet/sdk";
import "./style.css";
import { formatBalance, shortenAddress } from "./presentation";

const connectButton = document.querySelector<HTMLButtonElement>("#connect-button")!;
const refreshButton = document.querySelector<HTMLButtonElement>("#refresh-button")!;
const stateBadge = document.querySelector<HTMLElement>("#state-badge")!;
const providerMessage = document.querySelector<HTMLElement>("#provider-message")!;
const feedback = document.querySelector<HTMLElement>("#feedback")!;
const transparentAddress = document.querySelector<HTMLElement>("#transparent-address")!;
const shieldedAddress = document.querySelector<HTMLElement>("#shielded-address")!;
const accountCount = document.querySelector<HTMLElement>("#account-count")!;
const balance = document.querySelector<HTMLElement>("#balance")!;

type Account = { id?: string; label?: string; walletId?: string; accountId?: string };
type ConnectionResult = {
  transparent: string;
  shielded: string;
  accounts: Account[];
};

let connectedWallet: ReturnType<typeof getNoirWallet> = null;
let activeConnection: ConnectionResult | null = null;
let subscribedWallet: ReturnType<typeof getNoirWallet> = null;

function setState(label: string, connected: boolean) {
  stateBadge.textContent = label;
  stateBadge.dataset.connected = String(connected);
}


function renderConnection(connection: ConnectionResult | null) {
  activeConnection = connection;
  if (!connection) {
    setState("NOT CONNECTED", false);
    transparentAddress.textContent = "Not shared";
    shieldedAddress.textContent = "Not shared";
    accountCount.textContent = "—";
    balance.textContent = "Not requested";
    return;
  }

  setState("CONNECTED", true);
  transparentAddress.textContent = shortenAddress(connection.transparent);
  shieldedAddress.textContent = shortenAddress(connection.shielded);
  accountCount.textContent = String(Array.isArray(connection.accounts) ? connection.accounts.length : 0);
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
    balance.textContent = "Balance unavailable";
  }
}

function subscribeToAccountChanges(wallet: NonNullable<ReturnType<typeof getNoirWallet>>) {
  if (subscribedWallet === wallet) return;
  subscribedWallet = wallet;
  wallet.zcash.on("accountsChanged", () => {
    // Re-read the provider after every event; do not trust cached event payloads.
    void checkExistingConnection("Wallet accounts changed. Refreshing the authorized session…");
  });
}

async function checkExistingConnection(message?: string) {
  connectButton.disabled = true;
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
      return;
    }

    providerMessage.textContent = "Provider detected. Confirm that the installed extension is the official testnet build before use.";
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
    connectButton.disabled = !connectedWallet;
  }
}

connectButton.addEventListener("click", async () => {
  connectButton.disabled = true;
  refreshButton.disabled = true;
  feedback.textContent = "Waiting for wallet approval…";
  balance.textContent = "Not requested";

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
    connectButton.disabled = !connectedWallet;
    refreshButton.disabled = false;
  }
});

refreshButton.addEventListener("click", () => void checkExistingConnection());
void checkExistingConnection();
