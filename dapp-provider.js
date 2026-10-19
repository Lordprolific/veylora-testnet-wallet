/**
 * Veylora dApp bridge — minimal, origin-scoped provider transport.
 * This bridge never exposes seeds, keys, or transaction APIs to websites.
 * Requests are relayed to the extension service worker for explicit approval.
 */
(() => {
  if (window !== window.top || window.veylora) return;
  const pending = new Map<string, (result: any) => void>();
  let seq = 0;
  const provider = {
    isVeylora: true,
    request<T = unknown>({ method, params }: { method: string; params?: unknown }): Promise<T> {
      if (!['zcash_requestAccounts', 'zcash_getAccounts'].includes(method)) {
        return Promise.reject(new Error('Unsupported Veylora wallet method: ' + method));
      }
      const id = 'v' + Date.now().toString(36) + (++seq).toString(36);
      return new Promise<T>((resolve, reject) => {
        pending.set(id, (response) => {
          if (response?.error) reject(new Error(String(response.error)));
          else resolve(response?.result as T);
        });
        window.postMessage({ type: 'VEY LORA_DAPP_REQUEST', id, method, params }, window.location.origin);
        window.setTimeout(() => {
          if (pending.has(id)) {
            pending.delete(id);
            reject(new Error('Veylora wallet request timed out.'));
          }
        }, 120000);
      });
    },
    on(_event: string, _listener: (...args: unknown[]) => void) {
      // Account-change events will be added alongside persistent connection handling.
      return this;
    },
    removeListener(_event: string, _listener: (...args: unknown[]) => void) { return this; }
  };
  Object.defineProperty(window, 'veylora', { value: provider, configurable: false, writable: false });
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const data = event.data;
    if (data?.type !== 'VEY LORA_DAPP_RESPONSE' || typeof data.id !== 'string') return;
    const done = pending.get(data.id);
    if (!done) return;
    pending.delete(data.id);
    done(data);
  });
})();
