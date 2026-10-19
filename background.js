chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("wallet.html"),
    active: true,
  });
});

// Do not return account information here yet: account access must first be
// approved in the wallet UI. The UI approval/signature flow is still pending.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "VEY LORA_DAPP_REQUEST") return;
  if (!sender.url || !sender.url.startsWith("https://")) {
    sendResponse({ error: "Veylora dApp connections require a secure HTTPS origin." });
    return;
  }
  if (!["zcash_requestAccounts", "zcash_getAccounts"].includes(message.method)) {
    sendResponse({ error: "Unsupported Veylora wallet method." });
    return;
  }
  // Fail closed until the explicit approval surface is implemented.
  sendResponse({ error: "Veylora dApp connection approval is not available in this build yet." });
});
