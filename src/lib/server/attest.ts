import 'server-only';
// Live TEE attestation for the NEAR AI Cloud models Pocket uses (chat, photos, voice).
// Same checks as `npm run verify:tee`, run on demand from Settings > Private AI. For each model:
//  1. ask NEAR AI Cloud for an attestation with our own fresh random nonce (32 bytes, never reused)
//  2. the gateway quote is an Intel TDX v4 quote and its report_data carries our nonce
//  3. every model instance's quote is an Intel TDX v4 quote carrying our nonce (fresh, not replayed)
//  4. the quote binds the instance's signing address, and that address is keccak256 of the enclave's
//     public key, so replies signed by that key come from inside this enclave
//  5. the NVIDIA GPU evidence carries our nonce too
// The Intel and NVIDIA certificate chains are checked by NEAR AI's verifier (https://cloud.near.ai/verify);
// we say so in the result instead of claiming it. No API key is needed and nothing about the user is sent.
export * from '../shared/attest';
