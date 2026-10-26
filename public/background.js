const pendingRequests = new Map();
const approvedOrigins = new Map();

chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: chrome.runtime.getURL("wallet.html"), active: true }));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "VEY LORA_DAPP_REQUEST") {
    let origin = "";
    try { origin = sender.url ? new URL(sender.url).origin : ""; } catch {}
    if (!origin.startsWith("https://") || sender.tab?.id == null) {
      sendResponse({ error: "Veylora connections require a secure HTTPS website.", code: 4100 }); return;
    }
    const method = message.method;
    if (!["zcash_requestAccounts","zcash_getAccounts","zcash_signMessage","zcash_getAddresses","zcash_getPublicKey","zcash_disconnect"].includes(method)) {
      sendResponse({ error: "This Veylora wallet method is not supported.", code: 4200 }); return;
    }
    // An origin that has already been approved should not be sent back to the wallet just to reconnect.
    if (method === "zcash_requestAccounts" && approvedOrigins.has(origin)) {
      sendResponse({ result: approvedOrigins.get(origin) });
      return;
    }
    if (method === "zcash_getAccounts" || method === "zcash_getAddresses" || method === "zcash_getPublicKey") {
      const account = approvedOrigins.get(origin);
      if (!account) { sendResponse({ result: null }); return; }
      if (method === "zcash_getAccounts") { sendResponse({ result: account }); return; }
      if (method === "zcash_getAddresses") { sendResponse({ result: {shielded:account.shielded,transparent:account.transparent} }); return; }
      sendResponse({ result: account.publicKey || null }); return;
    }
    if (method === "zcash_disconnect") {
      approvedOrigins.delete(origin);
      sendResponse({ result: null });
      return;
    }
    if (method === "zcash_signMessage" && !approvedOrigins.has(origin)) {
      sendResponse({ error: "Connect this site to Veylora Wallet before signing in.", code: 4100 }); return;
    }
    if (method === "zcash_signMessage") {
      const messageText = Array.isArray(message.params) ? message.params[0] : "";
      if (typeof messageText !== "string" || !messageText || messageText.length > 4096) {
        sendResponse({ error: "Invalid sign-in message.", code: -32602 }); return;
      }
    }
    const requestId = crypto.randomUUID();
    const request = { requestId, origin, tabId: sender.tab.id, method, params: Array.isArray(message.params) ? message.params : [], createdAt: Date.now() };
    pendingRequests.set(requestId, request);
    const approvalUrl = chrome.runtime.getURL("wallet.html") + "?dappApproval=" + encodeURIComponent(requestId);
    // Use a compact extension window rather than a full browser tab for dApp approvals.
    chrome.windows.create({ url: approvalUrl, type: "popup", width: 460, height: 700, focused: true }).catch(() => {
      pendingRequests.delete(requestId); sendResponse({ error: "Could not open the wallet approval window.", code: -32603 });
    });
    const timeout = setTimeout(() => {
      if (!pendingRequests.has(requestId)) return;
      pendingRequests.delete(requestId); sendResponse({ error: "Wallet approval expired. Try again.", code: 4001 });
    }, 120000);
    request.timeout = timeout;
    request.respond = (response) => { clearTimeout(timeout); pendingRequests.delete(requestId); sendResponse(response); };
    return true;
  }
  if (message?.type === "VEY LORA_DAPP_GET_PENDING") {
    const request = pendingRequests.get(message.requestId);
    const expected = chrome.runtime.getURL("wallet.html") + "?dappApproval=" + encodeURIComponent(message.requestId);
    if (!request || sender.url !== expected) { sendResponse({ error: "This wallet approval request has expired." }); return; }
    sendResponse({ requestId: request.requestId, origin: request.origin, method: request.method, params: request.params });
    return;
  }
  if (message?.type === "VEY LORA_DAPP_APPROVAL_RESULT") {
    const request = pendingRequests.get(message.requestId);
    if (!request) { sendResponse({ ok: false, error: "This wallet request has expired." }); return; }
    if (message.approved === true && request.method === "zcash_requestAccounts" &&
        typeof message.accounts?.shielded === "string" && typeof message.accounts?.transparent === "string") {
      const account = { shielded: message.accounts.shielded, transparent: message.accounts.transparent, accounts: [{id:"current",label:"Veylora Testnet",walletId:"veylora",accountId:"0",addresses:{shielded:message.accounts.shielded,transparent:message.accounts.transparent}}] };
      approvedOrigins.set(request.origin, account);
      request.respond({ result: account }); sendResponse({ ok: true }); return;
    }
    if (message.approved === true && request.method === "zcash_signMessage" && message.signature &&
        typeof message.signature.signature === "string" && typeof message.signature.pubkey === "string" && typeof message.signature.address === "string") {
      const account = approvedOrigins.get(request.origin);
      const result = {...message.signature};
      if (account) account.publicKey = {pubkey:result.pubkey,address:result.address,signingMode:result.signingMode};
      request.respond({ result }); sendResponse({ ok: true }); return;
    }
    request.respond({ error: message.error || "Wallet request was declined.", code: 4001 });
    sendResponse({ ok: true });
  }
});
