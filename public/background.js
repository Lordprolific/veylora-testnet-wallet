chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("wallet.html"), active: true });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "VEY LORA_DAPP_REQUEST") return;
  if (!sender.url || !sender.url.startsWith("https://") || message.origin !== new URL(sender.url).origin) {
    sendResponse({ error: "Veylora dApp requests require a matching secure HTTPS origin." });
    return;
  }
  if (!["zcash_requestAccounts", "zcash_getAccounts"].includes(message.method)) {
    sendResponse({ error: "Unsupported Veylora wallet method." });
    return;
  }
  // Fail closed until the wallet-origin approval UI is connected to account state.
  sendResponse({ error: "Wallet connection is not enabled yet. No account was shared." });
});
