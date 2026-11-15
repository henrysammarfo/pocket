'use client';
// Private balance: 0.1 NEAR notes in the Pocket private pool (contracts/pool).
// Notes (secret + nullifier) live only in this browser's storage, like the phone key. Losing them loses the
// money in them, so the page tells the user to keep the device or export the notes.
import { POOL, POOL_NOTE_NEAR } from '../shared/deployment';
import { view } from '../shared/rpc';
import { PRIVATE_GAS } from '../shared/wallet';
import { makeNote, proveWithdraw, type Note } from '../shared/zkpool';
import { api, metaTx, signedPrice } from './api';
import { addLocalActivity, getSession, refreshAll } from './session';

const NOTE_YOCTO = (10n ** 23n).toString(); // 0.1 NEAR
const key = (account: string) => `pocket.notes.${account}`;
export const privateReady = () => !!POOL;

/** True when this account runs wallet code with send_private and this pool set (wallet v3). */
export async function walletHasPool(account: string): Promise<boolean> {
  const c = await view<{ pool?: string | null }>(account, 'get_config').catch(() => null);
  return !!c && c.pool === POOL;
}

export function getNotes(account: string): Note[] {
  try { return JSON.parse(localStorage.getItem(key(account)) || '[]'); } catch { return []; }
}
function setNotes(account: string, notes: Note[]) { localStorage.setItem(key(account), JSON.stringify(notes)); }

/** Unspent notes, checked against the pool's nullifier list. */
export async function privateBalance(account: string) {
  const notes = getNotes(account);
  const live: Note[] = [];
  for (const n of notes) {
    if (n.spent) continue;
    const spent = await view<boolean>(POOL, 'is_spent', { nullifier_hash: n.nullifierHash }).catch(() => false);
    if (spent) n.spent = true; else live.push(n);
  }
  setNotes(account, notes);
  return { notes: live, near: (live.length * Number(POOL_NOTE_NEAR)).toFixed(1) };
}

/** Move 0.1 NEAR from the wallet into the pool. The wallet contract checks the NEAR and dollar caps first. */
export async function addToPrivate() {
  const s = getSession();
  if (!s) throw new Error('Create your Pocket account first.');
  if (!s.onchain || !(await walletHasPool(s.account))) throw new Error('Adding to a private balance needs the newer Pocket wallet (version 3). This account runs an older version, so it cannot do it yet.');
  const note = await makeNote(POOL, NOTE_YOCTO);
  // Save first: if the page closes after the chain takes the money, the note is not lost.
  setNotes(s.account, [...getNotes(s.account), note]);
  try {
    const price = await signedPrice('near');
    const r = await metaTx(s, s.account, [{ type: 'functionCall', method: 'send_private', args: { commitment: note.commitment, amount: NOTE_YOCTO, price }, gas: PRIVATE_GAS.toString(), deposit: '0' }]);
    addLocalActivity({ tx: r.hash, kind: 'private_in', data: { token: 'NEAR', amount: POOL_NOTE_NEAR }, at: Date.now() });
    refreshAll();
    return r;
  } catch (e) {
    const leaves = await view<string[]>(POOL, 'get_leaves', { from: 0, limit: 500 }).catch(() => [] as string[]);
    if (!leaves.includes(note.commitment)) setNotes(s.account, getNotes(s.account).filter((n) => n.commitment !== note.commitment));
    throw e;
  }
}

async function allLeaves(): Promise<bigint[]> {
  const out: bigint[] = [];
  for (let from = 0; ; from += 500) {
    const page = await view<string[]>(POOL, 'get_leaves', { from, limit: 500 });
    out.push(...page.map((x) => BigInt(x)));
    if (page.length < 500) return out;
  }
}

/** Pay one 0.1 NEAR note to `to`. The proof is made here in the browser; the relayer only submits it. */
export async function privateSend(to: string) {
  const s = getSession();
  if (!s) throw new Error('Create your Pocket account first.');
  const { notes } = await privateBalance(s.account);
  if (!notes.length) throw new Error('Your private balance is empty. Add 0.1 NEAR first.');
  // Oldest note first: more deposits came after it, so it hides in a bigger crowd.
  const note = notes.sort((a, b) => a.created - b.created)[0];
  const w = await proveWithdraw(note, await allLeaves(), to, null, 0n, '/zk/withdraw.wasm', '/zk/withdraw.zkey');
  const r = await api<{ hash: string }>('/api/pool/withdraw', w);
  setNotes(s.account, getNotes(s.account).map((n) => (n.commitment === note.commitment ? { ...n, spent: true } : n)));
  addLocalActivity({ tx: r.hash, kind: 'private_out', data: { token: 'NEAR', amount: POOL_NOTE_NEAR, to }, at: Date.now() });
  refreshAll();
  return r;
}

/** The notes as text, so the user can keep a copy. Anyone with this text can spend them. */
export const exportNotes = (account: string) => JSON.stringify(getNotes(account).filter((n) => !n.spent));
