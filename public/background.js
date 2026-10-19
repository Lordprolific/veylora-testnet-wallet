const pendingRequests = new Map();

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("wallet.html"), active: true });
});

function replyToOrigin(tabId, message) {
  chrome.tabs.sendMessage(tabId, { type: "VEY LORA_DAPP_RESPONSE", ...message }).catch(() => {});
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "VEY LORA_DAPP_REQUEST") {
    const origin = sender.url ? new URL(sender.url).origin : "";
    if (!origin.startsWith("https://") || sender.tab?.id == null) {
      sendResponse({ error: "Veylora connections require a secure HTTPS website." });
      return;
    }
    if (!["zcash_requestAccounts", "zcash_getAccounts"].includes(message.method)) {
      sendResponse({ error: "This Veylora wallet method is not supported yet." });
      return;
    }

    if (message.method === "zcash_getAccounts") {
      // getAccounts is intentionally silent: disclose nothing unless this origin
      // has already been approved during this browser session.
      sendResponse({ result: [] });
      return;
    }

    const requestId = crypto.randomUUID();
    const request = {
      requestId,
      origin,
      tabId: sender.tab.id,
      method: message.method,
      createdAt: Date.now()
    };
    pendingRequests.set(requestId, request);
    const approvalUrl = chrome.runtime.getURL("wallet.html") + "?dappApproval=" + encodeURIComponent(requestId);
    chrome.tabs.create({ url: approvalUrl, active: true }).then(() => {
      // The wallet page retrieves the pending request after it has loaded.
    }).catch(() => {
      pendingRequests.delete(requestId);
      sendResponse({ error: "Could not open the wallet approval screen." });
    });
    const timeout = setTimeout(() => {
      if (!pendingRequests.has(requestId)) return;
      pendingRequests.delete(requestId);
      sendResponse({ error: "Wallet approval expired. Try connecting again." });
    }, 120000);
    request.timeout = timeout;
    request.respond = (response) => {
      clearTimeout(timeout);
      pendingRequests.delete(requestId);
      sendResponse(response);
    };
    return true;
  }

  if (message?.type === "VEY LORA_DAPP_GET_PENDING") {
    const request = pendingRequests.get(message.requestId);
    if (!request || sender.url !== chrome.runtime.getURL("wallet.html") + "?dappApproval=" + encodeURIComponent(message.requestId)) {
      sendResponse({ error: "This wallet approval request has expired." });
      return;
    }
    sendResponse({ requestId: request.requestId, origin: request.origin, method: request.method });
    return;
  }

  if (message?.type === "VEY LORA_DAPP_APPROVAL_RESULT") {
    const request = pendingRequests.get(message.requestId);
    if (!request) {
      sendResponse({ ok: false, error: "This wallet request has expired." });
      return;
    }
    if (message.approved === true && message.accounts &&
        typeof message.accounts.shielded === "string" &&
        typeof message.accounts.transparent === "string") {
      request.respond({ result: [message.accounts.shielded, message.accounts.transparent] });
      sendResponse({ ok: true });
      return;
    }
    request.respond({ error: message.error || "Wallet connection was declined." });
    sendResponse({ ok: true });
  }
});
