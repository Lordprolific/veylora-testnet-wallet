const guideButton = document.getElementById("guide-button");
const copyButton = document.getElementById("copy-button");
const actionStatus = document.getElementById("action-status");

const guideUrl = "https://github.com/Lordprolific/veylora-testnet-wallet/blob/main/docs/provider-contract.md";
const providerContract = [
  "Veylora Testnet Wallet — provider integration contract",
  "Status: proposed, not an implemented API.",
  "Select a maintained Zcash testnet wallet/provider and use only its documented API.",
  "Verify testnet identification, explicit account-access approval, account/address responses, transaction preview, explicit confirmation, and structured errors.",
  "Never guess provider methods. Never request or expose seed phrases or private keys. Do not enable mainnet in the initial prototype."
].join("\n");

guideButton.addEventListener("click", async () => {
  actionStatus.textContent = "Opening integration plan…";
  try {
    if (typeof chrome !== "undefined" && chrome.tabs?.create) {
      await chrome.tabs.create({ url: guideUrl });
      actionStatus.textContent = "Integration plan opened in a new tab.";
    } else {
      window.open(guideUrl, "_blank", "noopener,noreferrer");
      actionStatus.textContent = "Opening integration plan.";
    }
  } catch {
    actionStatus.textContent = "Could not open the guide. Use the GitHub repository link.";
  }
});

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(providerContract);
    actionStatus.textContent = "Provider contract copied.";
  } catch {
    actionStatus.textContent = "Clipboard access unavailable in this browser.";
  }
});
