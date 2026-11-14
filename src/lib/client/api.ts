'use client';
import { buildDelegateAction, encodeDelegateAction, actionCreators } from '@near-js/transactions';
import { PublicKey } from '@near-js/crypto';
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import bs58 from 'bs58';
import { latestBlock, viewAccessKey } from '../shared/rpc';
import { buildPayload, type Intent } from '../shared/intents';
import { signNep413, newKey, randomNonce } from '../shared/nep413';
import { PUSD, ROOT, USDC, USDC_DECIMALS, VERIFIER, tokenBySymbol } from '../shared/deployment';
import { toUnits, nearToYocto } from '../shared/units';
import { addLocalActivity, bumpContact, getSession, seedOf, setSession, setRules, refreshAll, type Session } from './session';

// A signed session proves to the server which account is asking (for memory, chat history, credits).
// Made with the device key, valid 24 h, kept in sessionStorage. It cannot move money.
export function sessionToken(): string | null {
  const s = getSession(); if (!s) return null;
  try {
    const c = JSON.parse(sessionStorage.getItem('pocket-st') || 'null');
    if (c && c.account === s.account && c.exp > Date.now() + 3600e3) return c.token;
  } catch { /* new one */ }
  const exp = Date.now() + 24 * 3600e3;
  const signed = signNep413({ message: JSON.stringify({ action: 'pocket.session', account: s.account, exp }), nonce: randomNonce(), recipient: 'pocket' }, seedOf(s));
  const token = btoa(JSON.stringify(signed));
  try { sessionStorage.setItem('pocket-st', JSON.stringify({ account: s.account, exp, token })); } catch { /* private mode */ }
  return token;
}
const authHeaders = (): Record<string, string> => { const t = typeof window !== 'undefined' ? sessionToken() : null; return t ? { 'x-pocket-session': t } : {}; };
export async function apiForm<T = any>(path: string, form: FormData): Promise<T> {
  const r = await fetch(path, { method: 'POST', headers: authHeaders(), body: form });
  const j = await r.json().catch(() => ({ error: `Server error ${r.status}` }));
  if (!r.ok || j.error) throw new Error(j.error || `Server error ${r.status}`);
  return j as T;
}
export async function api<T = any>(path: string, body?: unknown, method?: string): Promise<T> {
  const r = await fetch(path, body === undefined && !method ? { cache: 'no-store', headers: authHeaders() } : { method: method || 'POST', headers: { 'content-type': 'application/json', ...authHeaders() }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({ error: `Server error ${r.status}` }));
  if (!r.ok || j.error) throw new Error(j.error || `Server error ${r.status}`);
  return j as T;
}
const must = () => { const s = getSession(); if (!s) throw new Error('Create your Pocket account first.'); return s; };
const enc = new TextEncoder();
const TG = 10n ** 12n;

type DA = { type: 'functionCall'; method: string; args: Record<string, unknown>; gas: string; deposit: string } | { type: 'transfer'; deposit: string };
// NEP-366: sign a DelegateAction on this device; the Pocket relayer wraps it and pays the gas.
export async function metaTx(s: Session, receiverId: string, actions: DA[]) {
  const [ak, blk] = await Promise.all([viewAccessKey(s.account, s.publicKey), latestBlock()]);
  if (!ak) throw new Error('This device key is not on your account.');
  const nonce = (BigInt(ak.nonce) + 1n).toString();
  const maxBlockHeight = String(blk.header.height + 120);
  const da = buildDelegateAction({
    senderId: s.account, receiverId, nonce: BigInt(nonce), maxBlockHeight: BigInt(maxBlockHeight), publicKey: PublicKey.fromString(s.publicKey),
    actions: actions.map((a) => a.type === 'transfer' ? actionCreators.transfer(BigInt(a.deposit)) : actionCreators.functionCall(a.method, enc.encode(JSON.stringify(a.args)), BigInt(a.gas), BigInt(a.deposit))),
  });
  const sig = ed25519.sign(sha256(encodeDelegateAction(da)), seedOf(s));
  return api<{ hash: string; relayer: string }>('/api/relay', { senderId: s.account, receiverId, nonce, maxBlockHeight, publicKey: s.publicKey, actions, signature: 'ed25519:' + bs58.encode(sig) });
}

export async function signup(username: string) {
  const k = newKey();
  const u = username.trim().toLowerCase().replace(/^@/, '');
  const r = await api<{ account: string; hash: string }>('/api/account/create', { username: u, publicKey: k.publicKey });
  const s: Session = { account: r.account, username: u, secretKey: k.secretKey, publicKey: k.publicKey, createdAt: Date.now() };
  setSession(s);
  addLocalActivity({ tx: r.hash, kind: 'signup', data: {}, at: Date.now() });
  // Register this device key in the NEAR Intents verifier, gasless.
  let tries = 0;
  for (;;) {
    try { await metaTx(s, VERIFIER, [{ type: 'functionCall', method: 'add_public_key', args: { public_key: k.publicKey }, gas: String(30n * TG), deposit: '1' }]); break; }
    catch (e) { if (++tries > 3) throw e; await new Promise((r) => setTimeout(r, 1500)); }
  }
  const f = await api<{ hash: string; amount: string }>('/api/faucet', { account: s.account }).catch(() => null);
  if (f) addLocalActivity({ tx: f.hash, kind: 'faucet', data: { token: 'pUSD', amount: f.amount }, at: Date.now() });
  refreshAll();
  return s;
}

export async function claimFaucet() {
  const s = must();
  const f = await api<{ hash: string; amount: string }>('/api/faucet', { account: s.account });
  addLocalActivity({ tx: f.hash, kind: 'faucet', data: { token: 'pUSD', amount: f.amount }, at: Date.now() });
  refreshAll();
  return f;
}

export type SendReq = { to: string; amount: string; asset: 'pUSD' | 'USDC' | 'NEAR'; memo?: string; toName?: string };
export async function send(req: SendReq) {
  const s = must();
  let r: { hash: string };
  if (req.asset === 'pUSD') {
    const intents: Intent[] = [{ intent: 'transfer', receiver_id: req.to, tokens: { [PUSD.assetId]: toUnits(req.amount, PUSD.decimals).toString() }, ...(req.memo ? { memo: req.memo } : {}) }];
    const { payload } = buildPayload(s.account, VERIFIER, intents, 300);
    r = await api('/api/intents/transfer', { signed: signNep413(payload, seedOf(s)) });
  } else if (req.asset === 'USDC') {
    const reg = await fetch(`/api/registered?account=${encodeURIComponent(req.to)}`).then((x) => x.json()).catch(() => ({ registered: true }));
    const acts: DA[] = [];
    if (!reg.registered) acts.push({ type: 'functionCall', method: 'storage_deposit', args: { account_id: req.to, registration_only: true }, gas: String(30n * TG), deposit: nearToYocto('0.00125').toString() });
    acts.push({ type: 'functionCall', method: 'ft_transfer', args: { receiver_id: req.to, amount: toUnits(req.amount, USDC_DECIMALS).toString(), ...(req.memo ? { memo: req.memo } : {}) }, gas: String(30n * TG), deposit: '1' });
    r = await metaTx(s, USDC, acts);
  } else {
    r = await metaTx(s, req.to, [{ type: 'transfer', deposit: nearToYocto(req.amount).toString() }]);
  }
  addLocalActivity({ tx: r.hash, kind: 'send', data: { token: req.asset, amount: req.amount, to: req.to, toName: req.toName, memo: req.memo || null }, at: Date.now() });
  bumpContact(req.to);
  refreshAll();
  return r;
}

export type QuoteRes = { quote: { id: string; side: 'buy' | 'sell'; token: string; ticker: string; payAsset: string; getAsset: string; payUnits: string; getUnits: string; price: number; mid: number; spreadBps: number; usd: number; priceSource: string; priceAt: number; deadline: number }; mac: string };
export async function getQuote(side: 'buy' | 'sell', symbol: string, amount: { usd?: number; qty?: number }) {
  const s = must();
  return api<QuoteRes>('/api/trade/quote', { account: s.account, side, symbol, ...amount });
}
export async function trade(q: QuoteRes) {
  const s = must();
  const { payload } = buildPayload(s.account, VERIFIER, [{ intent: 'token_diff', diff: { [q.quote.payAsset]: '-' + q.quote.payUnits, [q.quote.getAsset]: q.quote.getUnits } }], 60);
  const r = await api<{ hash: string; qty: string; usd: number; price: number; token: string; side: string }>('/api/trade/settle', { quote: q.quote, mac: q.mac, signed: signNep413(payload, seedOf(s)) });
  addLocalActivity({ tx: r.hash, kind: r.side, data: r, at: Date.now() });
  refreshAll();
  return r;
}

export async function saveLimit(limit: number) {
  const s = must();
  const msg = JSON.stringify({ action: 'pocket.set_limit', account: s.account, limit, at: Date.now() });
  const signed = signNep413({ message: msg, nonce: randomNonce(), recipient: 'pocket' }, seedOf(s));
  await api('/api/limits', { signed });
  setRules({ limit });
}

// Passkey (WebAuthn platform authenticator) as a local approval gate for sensitive changes.
export async function passkeyCreate(username: string) {
  if (!window.PublicKeyCredential) throw new Error('This browser has no passkeys.');
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: 'Pocket' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: username, displayName: username },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { userVerification: 'required', residentKey: 'preferred' }, timeout: 60000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('No passkey made.');
  return bs58.encode(new Uint8Array(cred.rawId));
}
export async function passkeyApprove(id?: string) {
  if (!window.PublicKeyCredential) throw new Error('This browser has no passkeys.');
  const got = await navigator.credentials.get({
    publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), userVerification: 'required', timeout: 60000, ...(id ? { allowCredentials: [{ type: 'public-key', id: new Uint8Array(bs58.decode(id)) as Uint8Array<ArrayBuffer> }] } : {}) },
  });
  if (!got) throw new Error('Passkey was not used.');
  return true;
}
export const tokenOf = tokenBySymbol;
export { ROOT };
