import { defineChain } from "viem";

/** Monad testnet — verified chain ID 10143 (Envio / Monad docs). */
export const MONAD_TESTNET_CHAIN_ID = 10143;

const PUBLIC_MONAD_TESTNET_RPC = "https://testnet-rpc.monad.xyz";

/**
 * Server RPCs in order: MONAD_RPC_URL, VITE_MONAD_RPC_URL, then the public
 * Monad testnet RPC. Trimmed (a pasted env value can carry a newline) and
 * deduplicated, so a broken or rate-limited private RPC falls back instead of
 * reading every balance as $0.00.
 */
export function monadRpcUrls(): string[] {
  const raw = [process.env["MONAD_RPC_URL"], process.env["VITE_MONAD_RPC_URL"], PUBLIC_MONAD_TESTNET_RPC];
  const out: string[] = [];
  for (const u of raw) {
    const t = (u ?? "").trim();
    if (/^https?:\/\//.test(t) && !out.includes(t)) out.push(t);
  }
  return out;
}

export const monadTestnet = defineChain({
  id: MONAD_TESTNET_CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: {
      http: [monadRpcUrls()[0] ?? PUBLIC_MONAD_TESTNET_RPC],
    },
  },
  blockExplorers: {
    default: { name: "MonadVision", url: "https://testnet.monadvision.com" },
  },
  testnet: true,
});

export const agoraAddresses = {
  factory: (process.env["AGORA_INSTANT_SETTLEMENT_FACTORY"] ||
    "0x8468587Af422ad440F58a57E955eCA6A970b5375") as `0x${string}`,
  ctkAusdPair: (process.env["AGORA_CTK_AUSD_PAIR"] ||
    "0x1Aa8958Aa34cEC8096EF4381cb335effe977b0ae") as `0x${string}`,
  whitelister: (process.env["AGORA_WHITELISTER"] ||
    "0x7c10F56d6f04a51376393a1C3670e966863F6BD5") as `0x${string}`,
  ausd: ((process.env["AUSD_TESTNET"] ?? "").trim() ||
    "0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC") as `0x${string}`,
};

export function explorerTxUrl(hash: string): string {
  return `https://testnet.monadvision.com/tx/${hash}`;
}
