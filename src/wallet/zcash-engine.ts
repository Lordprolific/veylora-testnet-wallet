import initWebZjsWallet, { initThreadPool, WebWallet } from "@chainsafe/webzjs-wallet";

const TESTNET_LIGHTWALLETD_PROXY = "https://zcash-testnet.chainsafe.dev";
let wasmInitialization: Promise<void> | null = null;
let walletInstance: WebWallet | null = null;
let activeAccountId: number | null = null;
let pendingProposal: any = null;

export interface TestnetWalletState {
  accountId: number;
  unifiedAddress: string;
  transparentAddress: string;
  chainHeight: string;
  scannedHeight: string;
  birthdayHeight: number;
  database: Uint8Array;
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
export async function createTestnetAccount(seedPhrase: string, birthdayHeight?: number): Promise<TestnetWalletState> {
  if (walletInstance) throw new Error("The WebZjs wallet is already initialized in this page.");
  if (!globalThis.crossOriginIsolated) {
    throw new Error("This Chrome extension page is not cross-origin isolated; WebZjs worker/WASM threading cannot be safely initialized here.");
  }
  await initializeWasmOnce();
  const wallet = new WebWallet("test", TESTNET_LIGHTWALLETD_PROXY, 1, 1, null);
  try {
    const latestHeight = await wallet.get_latest_block();
    const birthday = birthdayHeight === undefined ? Number(latestHeight) : birthdayHeight;
    const accountId = await wallet.create_account("Veylora", seedPhrase, 0, birthday);
    const unifiedAddress = await wallet.get_current_address(accountId);
    const transparentAddress = await wallet.get_current_address_transparent(accountId);
    const database = await wallet.db_to_bytes();
    walletInstance = wallet;
    activeAccountId = accountId;
    return {
      accountId,
      unifiedAddress,
      transparentAddress,
      chainHeight: String(latestHeight),
      scannedHeight: String(birthday),
      birthdayHeight: birthday,
      database,
    };
  } catch (error) {
    wallet.free();
    throw error;
  }
}


export async function restoreTestnetAccount(database: Uint8Array, accountId: number): Promise<TestnetWalletState> {
  if (walletInstance) throw new Error("The WebZjs wallet is already initialized in this page.");
  if (!globalThis.crossOriginIsolated) throw new Error("This Chrome extension page is not cross-origin isolated; WebZjs worker/WASM threading cannot be safely initialized here.");
  if (!(database instanceof Uint8Array) || database.length === 0) throw new Error("Encrypted wallet database is invalid.");
  await initializeWasmOnce();
  const wallet = new WebWallet("test", TESTNET_LIGHTWALLETD_PROXY, 1, 1, database);
  try {
    const latestHeight = await wallet.get_latest_block();
    const unifiedAddress = await wallet.get_current_address(accountId);
    const transparentAddress = await wallet.get_current_address_transparent(accountId);
    const serialized = await wallet.db_to_bytes();
    const summary = await wallet.get_wallet_summary();
    walletInstance = wallet;
    activeAccountId = accountId;
    return {
      accountId,
      unifiedAddress,
      transparentAddress,
      chainHeight: String(latestHeight),
      scannedHeight: String(summary?.fully_scanned_height ?? 0),
      birthdayHeight: 0,
      database: serialized,
    };
  } catch (error) { wallet.free(); throw error; }
}

export async function syncTestnetWallet(): Promise<{ chainHeight: string; scannedHeight: string; database: Uint8Array; shieldedBalance: number; transparentBalance: number; pendingBalance: number }> {
  if (!walletInstance || activeAccountId === null) throw new Error("Initialize the testnet account before syncing.");
  await walletInstance.sync();
  const summary = await walletInstance.get_wallet_summary();
  const database = await walletInstance.db_to_bytes();
  const reports = (summary?.account_balances ?? []) as Array<[number, { sapling_balance?: number; orchard_balance?: number; unshielded_balance?: number; pending_change?: number; pending_spendable?: number }]>;
  const report = reports.find(([accountId]) => accountId === activeAccountId)?.[1];
  return {
    chainHeight: String(summary?.chain_tip_height ?? 0),
    scannedHeight: String(summary?.fully_scanned_height ?? 0),
    database,
    shieldedBalance: Number(report?.sapling_balance ?? 0) + Number(report?.orchard_balance ?? 0),
    transparentBalance: Number(report?.unshielded_balance ?? 0),
    pendingBalance: Number(report?.pending_change ?? 0) + Number(report?.pending_spendable ?? 0),
  };
}

export async function prepareTestnetTransfer(toAddress: string, amountZatoshis: bigint): Promise<any> {
  if (!walletInstance || activeAccountId === null) throw new Error("Unlock and sync the testnet wallet before sending.");
  if (amountZatoshis <= 0n) throw new Error("Send amount must be greater than zero.");
  pendingProposal?.free?.();
  pendingProposal = null;
  const proposal = await walletInstance.propose_transfer(activeAccountId, toAddress, amountZatoshis);
  try {
    const details = proposal.describe();
    if (!details || !Array.isArray(details.steps) || details.steps.length === 0) {
      throw new Error("The wallet engine did not provide reviewable transaction details. Sending is blocked.");
    }
    const payments = details.steps.flatMap((step: any) => step.payments ?? []);
    const matchingPayment = payments.some((payment: any) =>
      payment.recipient_address === toAddress && BigInt(payment.amount_zatoshis ?? -1) === amountZatoshis
    );
    if (!matchingPayment || details.total_fee_zatoshis === undefined) {
      throw new Error("The wallet engine's proposal does not match the requested recipient and amount. Sending is blocked.");
    }
    pendingProposal = proposal;
    return details;
  } catch (error) {
    proposal.free?.();
    throw error;
  }
}

export function cancelPendingTestnetTransfer(): void {
  pendingProposal?.free?.();
  pendingProposal = null;
}

export async function authorizeAndBroadcastTestnetTransfer(seedPhrase: string): Promise<{ txids: string[]; database: Uint8Array }> {
  if (!walletInstance || activeAccountId === null || !pendingProposal) {
    throw new Error("There is no reviewed transfer ready to authorize.");
  }
  const proposal = pendingProposal;
  pendingProposal = null;
  const txidBytes = await walletInstance.create_proposed_transactions(proposal, seedPhrase, 0);
  if (txidBytes.length === 0 || txidBytes.length % 32 !== 0) {
    throw new Error("The wallet engine returned an invalid transaction ID list.");
  }
  const txids: string[] = [];
  for (let offset = 0; offset < txidBytes.length; offset += 32) {
    txids.push(Array.from(txidBytes.slice(offset, offset + 32), (byte) => byte.toString(16).padStart(2, "0")).join(""));
  }
  await walletInstance.send_authorized_transactions(txidBytes);
  return { txids, database: await walletInstance.db_to_bytes() };
}

export async function getTestnetDatabase(): Promise<Uint8Array> {
  if (!walletInstance) throw new Error("The testnet wallet is not initialized.");
  return walletInstance.db_to_bytes();
}

export async function getTestnetHistory() {
  if (!walletInstance || activeAccountId === null) throw new Error("Initialize the testnet account before reading history.");
  const response = await walletInstance.get_transaction_history(activeAccountId, 25, 0);
  const transactions = Array.from(response.transactions as Array<any>).map((tx) => ({
    txid: String(tx.txid ?? ""),
    type: Number(tx.tx_type ?? -1),
    value: String(tx.value ?? "0"),
    fee: tx.fee === undefined ? null : String(tx.fee),
    blockHeight: tx.block_height === undefined ? null : Number(tx.block_height),
    confirmations: Number(tx.confirmations ?? 0),
    status: Number(tx.status ?? -1),
    memo: tx.memo === undefined ? null : String(tx.memo),
    timestamp: tx.timestamp === undefined ? null : String(tx.timestamp),
    pool: String(tx.pool ?? ""),
  }));
  return { totalCount: Number(response.total_count ?? transactions.length), transactions };
}

export async function getTestnetAddress(): Promise<{ unified: string; transparent: string }> {
  if (!walletInstance || activeAccountId === null) throw new Error("Unlock the wallet and initialize the testnet account first.");
  return {
    unified: await walletInstance.get_current_address(activeAccountId),
    transparent: await walletInstance.get_current_address_transparent(activeAccountId),
  };
}

export function releaseTestnetWallet(): void {
  pendingProposal?.free?.();
  pendingProposal = null;
  walletInstance?.free();
  walletInstance = null;
  activeAccountId = null;
}
