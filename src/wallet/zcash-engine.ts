import initWebZjsWallet, { initThreadPool, WebWallet } from "@chainsafe/webzjs-wallet";

const TESTNET_LIGHTWALLETD_PROXY = "https://zcash-testnet.chainsafe.dev";
let wasmInitialization: Promise<void> | null = null;
let walletInstance: WebWallet | null = null;
let activeAccountId: number | null = null;

export interface TestnetWalletState {
  accountId: number;
  unifiedAddress: string;
  transparentAddress: string;
  chainHeight: string;
  scannedHeight: string;
}

async function initializeWasmOnce(): Promise<void> {
  if (!wasmInitialization) {
    wasmInitialization = (async () => {
      await initWebZjsWallet();
      const threads = Math.max(1, Math.min(navigator.hardwareConcurrency || 2, 4));
      await initThreadPool(threads);
    })().catch((error) => {
      wasmInitialization = null;
      throw error;
    });
  }
  await wasmInitialization;
}

/**
 * Initialize WebZjs for Zcash testnet only and create the first account.
 * This does not persist the wallet database or start a chain sync; callers
 * must persist the encrypted DB and handle sync status before showing balances.
 */
export async function createTestnetAccount(seedPhrase: string): Promise<TestnetWalletState> {
  if (walletInstance) throw new Error("The WebZjs wallet is already initialized in this page.");
  if (!globalThis.crossOriginIsolated) {
    throw new Error("This Chrome extension page is not cross-origin isolated; WebZjs worker/WASM threading cannot be safely initialized here.");
  }
  await initializeWasmOnce();
  const wallet = new WebWallet("test", TESTNET_LIGHTWALLETD_PROXY, 1, 1, null);
  try {
    const latestHeight = await wallet.get_latest_block();
    const accountId = await wallet.create_account("Veylora", seedPhrase, 0, Number(latestHeight));
    const unifiedAddress = await wallet.get_current_address(accountId);
    const transparentAddress = await wallet.get_current_address_transparent(accountId);
    walletInstance = wallet;
    activeAccountId = accountId;
    return {
      accountId,
      unifiedAddress,
      transparentAddress,
      chainHeight: String(latestHeight),
      scannedHeight: "0",
    };
  } catch (error) {
    wallet.free();
    throw error;
  }
}

export async function syncTestnetWallet(): Promise<{ chainHeight: string; scannedHeight: string; database: Uint8Array }> {
  if (!walletInstance || activeAccountId === null) throw new Error("Initialize the testnet account before syncing.");
  await walletInstance.sync();
  const summary = await walletInstance.get_wallet_summary();
  const database = await walletInstance.db_to_bytes();
  return {
    chainHeight: String(summary?.chain_tip_height ?? 0),
    scannedHeight: String(summary?.fully_scanned_height ?? 0),
    database,
  };
}

export async function getTestnetAddress(): Promise<{ unified: string; transparent: string }> {
  if (!walletInstance || activeAccountId === null) throw new Error("Unlock the wallet and initialize the testnet account first.");
  return {
    unified: await walletInstance.get_current_address(activeAccountId),
    transparent: await walletInstance.get_current_address_transparent(activeAccountId),
  };
}

export function releaseTestnetWallet(): void {
  walletInstance?.free();
  walletInstance = null;
  activeAccountId = null;
}
