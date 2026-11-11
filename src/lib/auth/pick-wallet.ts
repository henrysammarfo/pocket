/**
 * Pick the member's EVM wallet from Privy linked accounts. Privy can link
 * Solana and Bitcoin embedded wallets too, and external wallets; the first
 * "wallet" entry is not always the funded Monad one. Order: Privy embedded
 * EVM wallet (lowest wallet_index), then smart wallet, then any EVM wallet.
 */
export type LinkedLike = {
  type?: string;
  address?: unknown;
  chain_type?: string;
  wallet_client?: string;
  wallet_client_type?: string;
  connector_type?: string;
  wallet_index?: number;
  id?: string | null;
};

const EVM = /^0x[0-9a-fA-F]{40}$/;

export function isEvmAddress(a: unknown): a is `0x${string}` {
  return typeof a === "string" && EVM.test(a.trim());
}

export function pickEvmWallet<T extends LinkedLike>(accounts: readonly T[] | undefined | null): T | null {
  const evm = (accounts ?? []).filter(
    (a) => (a.type === "wallet" || a.type === "smart_wallet") && isEvmAddress(a.address) && (!a.chain_type || a.chain_type === "ethereum"),
  );
  const embedded = evm
    .filter(
      (a) =>
        a.type === "wallet" &&
        (a.wallet_client_type === "privy" || a.wallet_client === "privy" || a.connector_type === "embedded"),
    )
    .sort((x, y) => (x.wallet_index ?? 0) - (y.wallet_index ?? 0));
  return embedded[0] ?? evm.find((a) => a.type === "smart_wallet") ?? evm[0] ?? null;
}
