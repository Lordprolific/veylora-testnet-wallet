/* Veylora testnet dApp provider. No key material is exposed to the page. */
(() => {
  if (window.veylora) return;
  const pending = new Map();
  let seq = 0;
  const provider = {
    isVeylora: true,
    request({ method, params } = {}) {
      if (!['zcash_requestAccounts', 'zcash_getAccounts'].includes(method)) {
        return Promise.reject(new Error('Unsupported Veylora wallet method: ' + String(method)));
      }
      const id = 'v' + Date.now().toString(36) + (++seq).toString(36);
      return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
          if (!pending.has(id)) return;
          pending.delete(id);
          reject(new Error('Veylora wallet request timed out.'));
        }, 120000);
        pending.set(id, (response) => {
          window.clearTimeout(timer);
          if (response && response.error) reject(new Error(String(response.error)));
          else resolve(response ? response.result : undefined);
        });
        window.postMessage({
          type: 'VEY LORA_DAPP_REQUEST',
          id,
          method,
          params: params === undefined ? null : params
        }, window.location.origin);
      });
    },
    on() { return this; },
    removeListener() { return this; }
  };
  Object.defineProperty(window, 'veylora', {
    value: Object.freeze(provider), configurable: false, writable: false
  });
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || data.type !== 'VEY LORA_DAPP_RESPONSE' || typeof data.id !== 'string') return;
    const resolve = pending.get(data.id);
    if (!resolve) return;
    pending.delete(data.id);
    resolve(data);
  });
})();
