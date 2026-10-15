/**
 * Optional Mera PRF — encrypted AI memory namespaces (NOT the account/wallet layer).
 * Privy remains the wallet. Mera salts isolate per-thread memory encryption keys.
 *
 * Requires browser WebAuthn PRF + @category-labs/mera at integration time.
 */

export const MERA_MEMORY_SALT_LABEL = "pocket.memory.v1";

export type MeraMemoryKey = {
  credentialId: string;
  /** Hex-encoded 32-byte PRF output — never persist raw; derive ephemeral AES key in memory. */
  prfHex: string;
};

/** Namespace salt for non-wallet PRF use (Mera bounty: non-account work). */
export function memoryPrfSalt(): Uint8Array {
  const enc = new TextEncoder();
  return enc.encode(MERA_MEMORY_SALT_LABEL);
}

export function assertMeraNonWalletUse(purpose: string): void {
  if (purpose === "wallet" || purpose === "signing") {
    throw new Error("Mera PRF must not replace Privy wallet/signing in POCKET");
  }
}
