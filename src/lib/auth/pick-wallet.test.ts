import { describe, expect, it } from "vitest";
import { pickEvmWallet } from "./pick-wallet";

const evm = "0xB3986eC4dd5b8650AFF661F928866930B1e10Da9";
describe("pickEvmWallet", () => {
  it("skips Solana and external wallets for the Privy embedded EVM wallet", () => {
    const got = pickEvmWallet([
      { type: "wallet", address: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", chain_type: "solana", wallet_client_type: "privy" },
      { type: "wallet", address: "0x1111111111111111111111111111111111111111", chain_type: "ethereum", wallet_client_type: "metamask" },
      { type: "wallet", address: evm, chain_type: "ethereum", wallet_client_type: "privy", connector_type: "embedded", wallet_index: 0 },
    ]);
    expect(got?.address).toBe(evm);
  });
  it("returns null when there is no EVM wallet", () => {
    expect(pickEvmWallet([{ type: "wallet", address: "bc1qxyz", chain_type: "bitcoin-segwit" }])).toBeNull();
    expect(pickEvmWallet(undefined)).toBeNull();
  });
});
