/* Noir SDK-compatible Veylora testnet provider. Secrets never leave the extension. */
(() => {
  if (window.noirwallet) return;
  const listeners = new Map();
  let seq = 0;
  const request = (method, params = []) => new Promise((resolve, reject) => {
    const id = "v" + Date.now().toString(36) + (++seq).toString(36);
    const timer = window.setTimeout(() => { pending.delete(id); reject(new Error("Veylora wallet request timed out.")); }, 120000);
    pending.set(id, (response) => {
      window.clearTimeout(timer);
      if (response?.error) reject(Object.assign(new Error(String(response.error)), { code: response.code || 4001 }));
      else resolve(response?.result);
    });
    window.postMessage({ type: "VEY LORA_DAPP_REQUEST", id, method, params }, window.location.origin);
  });
  const pending = new Map();
  const zcash = {
    request: ({method, params} = {}) => request(method, params || []),
    connect: () => request("zcash_requestAccounts"),
    getAccounts: () => request("zcash_getAccounts"),
    getAddresses: () => request("zcash_getAddresses"),
    signMessage: (message, options) => request("zcash_signMessage", [message, options || {}]),
    getPublicKey: (options) => request("zcash_getPublicKey", [options || {}]),
    disconnect: () => request("zcash_disconnect"),
    on: (event, handler) => { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event).add(handler); },
    removeListener: (event, handler) => listeners.get(event)?.delete(handler)
  };
  Object.defineProperty(window, "noirwallet", {value: Object.freeze({isNoirWallet:true, version:"0.3.2-veylora-testnet", zcash:Object.freeze(zcash)}), configurable:false, writable:false});
  Object.defineProperty(window, "veylora", {value:Object.freeze({isVeylora:true, request:({method,params}={})=>request(method,params||[])}), configurable:false, writable:false});
  window.dispatchEvent(new Event("noirwallet#initialized"));
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || data.type !== "VEY LORA_DAPP_RESPONSE" || typeof data.id !== "string") return;
    const resolve = pending.get(data.id);
    if (!resolve) return;
    pending.delete(data.id);
    resolve(data);
  });
})();
