const pendingRequests = new Map();

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("wallet.html"), active: true });
});

function replyToOrigin(tabId, origin, message) {
  chrome.tabs.sendMessage(tabId, { type: "VEY LORA_DAPP_RESPONSE", origin, ...message }).catch(() => {});
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "VEY LORA_DAPP_REQUEST") {
    const origin = sender.url ? new URL(sender.url).origin : "";
    if (!origin.startsWith("https://")) {
      sendResponse({ error: "Veylora connections require a secure HTTPS website." });
      return;
    }
    if (!["zcash_requestAccounts", "zcash_getAccounts"].includes(message.method)) {
      sendResponse({ error: "This Veylora wallet method is not supported yet." });
      return;
    }
    // Never disclose an address until the wallet has an explicit approval and
    // a live unlocked account response. This build deliberately fails closed
    // rather than reading a stale address from local storage.
    sendResponse({
      error: "Wallet account approval is not connected to the unlocked wallet yet. Open the wallet and unlock it; dApp access is not available in this build."
    });
    return;
  }
  if (message?.type === "VEY LORA_DAPP_APPROVAL_RESULT") {
    const request = pendingRequests.get(message.requestId);
    if (!request) {
      sendResponse({ ok: false, error: "This wallet request has expired." });
      return;
    }
    pendingRequests.delete(message.requestId);
    sendResponse({ ok: true });
    return;
  }
});
