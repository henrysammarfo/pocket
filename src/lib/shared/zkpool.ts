// Pocket private pool: notes, the MiMC Merkle tree and the account field, shared by the browser, the server and tests.
// The tree matches contracts/pool (tornado-core's MerkleTreeWithHistory design, depth 20) and the circuit in
// circuits/withdraw.circom. MiMCSponge comes from circomlibjs (iden3), the same hash the circuit uses.
import { sha256 } from '@noble/hashes/sha2.js';
import { buildMimcSponge } from 'circomlibjs';

export const LEVELS = 20;
/** keccak256("tornado") mod r, the empty leaf in tornado-core and in contracts/pool. */
export const ZERO_LEAF = 21663839004416932945382355908790599225266501822907911457504978515578255421292n;
export const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

type Mimc = { F: { toObject(x: unknown): bigint }; multiHash(arr: bigint[], key?: bigint, numOutputs?: number): unknown };
let mimcP: Promise<Mimc> | null = null;
const mimc = () => (mimcP ??= buildMimcSponge() as Promise<Mimc>);

export async function hash(...xs: bigint[]): Promise<bigint> {
  const m = await mimc();
  return m.F.toObject(m.multiHash(xs, 0n, 1));
}

/** A random field element from 31 random bytes. */
export function randomField(): bigint {
  const b = new Uint8Array(31);
  globalThis.crypto.getRandomValues(b);
  return BigInt('0x' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(''));
}

export type Note = { secret: string; nullifier: string; commitment: string; nullifierHash: string; pool: string; amount: string; created: number; index?: number; spent?: boolean };

export async function makeNote(pool: string, amountYocto: string): Promise<Note> {
  const secret = randomField(), nullifier = randomField();
  return {
    secret: secret.toString(), nullifier: nullifier.toString(),
    commitment: (await hash(secret, nullifier)).toString(),
    nullifierHash: (await hash(nullifier)).toString(),
    pool, amount: amountYocto, created: Date.now(),
  };
}

/** An account id as a field element: the first 31 bytes of sha256, big endian (same as the contract's account_field). */
export function accountField(account: string): bigint {
  const h = sha256(new TextEncoder().encode(account));
  return BigInt('0x' + Array.from(h.slice(0, 31), (x) => x.toString(16).padStart(2, '0')).join(''));
}

/** Root and Merkle path of leaf `index` among `leaves` (insertion order, as get_leaves returns them). */
export async function merklePath(leaves: bigint[], index: number) {
  const zeros: bigint[] = [ZERO_LEAF];
  for (let i = 0; i < LEVELS; i++) zeros.push(await hash(zeros[i], zeros[i]));
  let layer = leaves.slice();
  const pathElements: string[] = [], pathIndices: number[] = [];
  let idx = index;
  for (let level = 0; level < LEVELS; level++) {
    const sib = idx ^ 1;
    pathElements.push((sib < layer.length ? layer[sib] : zeros[level]).toString());
    pathIndices.push(idx & 1);
    const next: bigint[] = [];
    for (let i = 0; i < layer.length; i += 2) next.push(await hash(layer[i], i + 1 < layer.length ? layer[i + 1] : zeros[level]));
    layer = next;
    idx >>= 1;
  }
  const root = leaves.length ? layer[0] : zeros[LEVELS];
  return { root: root.toString(), pathElements, pathIndices };
}

export type WithdrawArgs = {
  proof: { pi_a: string[]; pi_b: string[][]; pi_c: string[] };
  root: string; nullifier_hash: string; recipient: string; relayer: string | null; fee: string;
};

/** Build the Groth16 proof for spending `note` to `recipient`. `wasm` and `zkey` are file paths (node) or URLs (browser). */
export async function proveWithdraw(note: Note, leaves: bigint[], recipient: string, relayer: string | null, fee: bigint, wasm: string, zkey: string): Promise<WithdrawArgs> {
  const index = leaves.findIndex((l) => l === BigInt(note.commitment));
  if (index < 0) throw new Error('This note is not in the pool yet.');
  const { root, pathElements, pathIndices } = await merklePath(leaves, index);
  const input = {
    root, nullifierHash: note.nullifierHash,
    recipient: accountField(recipient).toString(), relayer: relayer ? accountField(relayer).toString() : '0',
    fee: fee.toString(), refund: '0', nullifier: note.nullifier, secret: note.secret, pathElements, pathIndices,
  };
  const { groth16 } = await import('snarkjs');
  const { proof } = await groth16.fullProve(input, wasm, zkey);
  return {
    proof: { pi_a: proof.pi_a.slice(0, 2), pi_b: proof.pi_b.slice(0, 2), pi_c: proof.pi_c.slice(0, 2) },
    root, nullifier_hash: note.nullifierHash, recipient, relayer, fee: fee.toString(),
  };
}
