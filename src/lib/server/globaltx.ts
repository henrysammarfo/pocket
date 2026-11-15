import 'server-only';
// Signup transaction with NEAR global contracts (NEP-591). @near-js/transactions 1.x has no
// UseGlobalContract action, so this file encodes the transaction with borsh itself, following
// nearcore's Action enum: 0 CreateAccount, 2 FunctionCall, 3 Transfer, 5 AddKey, 10 UseGlobalContract.
// The wallet code is referenced by its code hash, which can never change, so nobody (not even
// Pocket) can swap the code under a user. Only the user's own full access key could redeploy.
import { serialize } from 'borsh';
import bs58 from 'bs58';
import { sha256 } from '@noble/hashes/sha2.js';
import { ed25519 } from '@noble/curves/ed25519.js';

const PK = { struct: { keyType: 'u8', data: { array: { type: 'u8', len: 32 } } } };
const FC_PERM = { struct: { allowance: { option: 'u128' }, receiverId: 'string', methodNames: { array: { type: 'string' } } } };
const PERM = { enum: [{ struct: { functionCall: FC_PERM } }, { struct: { fullAccess: { struct: {} } } }] };
const EMPTY = { struct: {} };
const NOOP = { struct: { _unused: 'u8' } }; // placeholder variants we never build
const ACTION = {
  enum: [
    { struct: { createAccount: EMPTY } },
    { struct: { deployContract: NOOP } },
    { struct: { functionCall: { struct: { methodName: 'string', args: { array: { type: 'u8' } }, gas: 'u64', deposit: 'u128' } } } },
    { struct: { transfer: { struct: { deposit: 'u128' } } } },
    { struct: { stake: NOOP } },
    { struct: { addKey: { struct: { publicKey: PK, accessKey: { struct: { nonce: 'u64', permission: PERM } } } } } },
    { struct: { deleteKey: NOOP } },
    { struct: { deleteAccount: NOOP } },
    { struct: { delegate: NOOP } },
    { struct: { deployGlobalContract: NOOP } },
    { struct: { useGlobalContract: { struct: { contractIdentifier: { enum: [{ struct: { codeHash: { array: { type: 'u8', len: 32 } } } }, { struct: { accountId: 'string' } }] } } } } },
  ],
};
const TX = { struct: { signerId: 'string', publicKey: PK, nonce: 'u64', receiverId: 'string', blockHash: { array: { type: 'u8', len: 32 } }, actions: { array: { type: ACTION } } } };
const SIGNED = { struct: { transaction: TX, signature: { struct: { keyType: 'u8', data: { array: { type: 'u8', len: 64 } } } } } };

const pk = (s: string) => ({ keyType: 0, data: Array.from(bs58.decode(s.replace(/^ed25519:/, ''))) });
export type GAction =
  | { createAccount: Record<string, never> }
  | { transfer: { deposit: bigint } }
  | { functionCall: { methodName: string; args: Uint8Array; gas: bigint; deposit: bigint } }
  | { addKey: { publicKey: ReturnType<typeof pk>; accessKey: { nonce: bigint; permission: unknown } } }
  | { useGlobalContract: { contractIdentifier: { codeHash: number[] } } };

export const G = {
  createAccount: (): GAction => ({ createAccount: {} }),
  transfer: (deposit: bigint): GAction => ({ transfer: { deposit } }),
  call: (methodName: string, args: object, gas: bigint, deposit = 0n): GAction => ({ functionCall: { methodName, args: new TextEncoder().encode(JSON.stringify(args)), gas, deposit } }),
  fullKey: (publicKey: string): GAction => ({ addKey: { publicKey: pk(publicKey), accessKey: { nonce: 0n, permission: { fullAccess: {} } } } }),
  fnKey: (publicKey: string, receiverId: string, methodNames: readonly string[], allowance: bigint | null): GAction =>
    ({ addKey: { publicKey: pk(publicKey), accessKey: { nonce: 0n, permission: { functionCall: { allowance, receiverId, methodNames: [...methodNames] } } } } }),
  globalCode: (codeHashB58: string): GAction => ({ useGlobalContract: { contractIdentifier: { codeHash: Array.from(bs58.decode(codeHashB58)) } } }),
};

/** Build, sign and encode a transaction. Returns base64 for send_tx and the tx hash. */
export function signTx(p: { signerId: string; publicKey: string; seed: Uint8Array; nonce: bigint; receiverId: string; blockHash: string; actions: GAction[] }) {
  const tx = { signerId: p.signerId, publicKey: pk(p.publicKey), nonce: p.nonce, receiverId: p.receiverId, blockHash: Array.from(bs58.decode(p.blockHash)), actions: p.actions };
  const bytes = serialize(TX as never, tx);
  const digest = sha256(bytes);
  const sig = ed25519.sign(digest, p.seed);
  const signed = serialize(SIGNED as never, { transaction: tx, signature: { keyType: 0, data: Array.from(sig) } });
  return { base64: Buffer.from(signed).toString('base64'), hash: bs58.encode(digest), bytes };
}
