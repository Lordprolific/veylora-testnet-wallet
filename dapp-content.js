(() => {
 const s = document.createElement('script');
 s.src = chrome.runtime.getURL('dapp-provider.js');
 s.onload = () => s.remove();
 (document.documentElement || document.head).appendChild(s);
})();

// Relays only explicitly supported dApp account requests to the extension worker.
(() => {
  const allowed = new Set(['zcash_requestAccounts', 'zcash_getAccounts']);
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const data = event.data;
    if (data?.type !== 'VEY LORA_DAPP_REQUEST' || typeof data.id !== 'string' || !allowed.has(data.method)) return;
    chrome.runtime.sendMessage({
      type: 'VEY LORA_DAPP_REQUEST',
      id: data.id,
      method: data.method,
      origin: window.location.origin
    }).then((response) => {
      window.postMessage({ type: 'VEY LORA_DAPP_RESPONSE', id: data.id, ...(response || {}) }, window.location.origin);
    }).catch((error) => {
      window.postMessage({ type: 'VEY LORA_DAPP_RESPONSE', id: data.id, error: error?.message || 'Wallet request failed.' }, window.location.origin);
    });
  });
})();
