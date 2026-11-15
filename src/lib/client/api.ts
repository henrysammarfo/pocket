'use client';
import { buildDelegateAction, encodeDelegateAction, actionCreators } from '@near-js/transactions';
import { PublicKey } from '@near-js/crypto';
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import bs58 from 'bs58';
import { latestBlock, view, viewAccessKey } from '../shared/rpc';
import { buildPayload, type Intent } from '../shared/intents';
import { signNep413, newKey, randomNonce } from '../shared/nep413';
import { PUSD, ROOT, USDC, USDC_DECIMALS, VERIFIER, tokenBySymbol } from '../shared/deployment';
import { DEVICE_ALLOWANCE, DEVICE_METHODS, RULE_GAS, SEND_GAS, TRADE_GAS, isRaise, withDaily, type Limits } from '../shared/wallet';
import { keyFromString } from '../shared/nep413';
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

type DA = { type: 'functionCall'; method: string; args: Record<string, unknown>; gas: string; deposit: string } | { type: 'transfer'; deposit: string } | { type: 'addKey'; publicKey: string; methods: string[]; allowance: string };
// NEP-366: sign a DelegateAction on this device; the Pocket relayer wraps it and pays the gas.
export async function metaTx(s: Pick<Session, 'account' | 'publicKey' | 'secretKey'>, receiverId: string, actions: DA[]) {
  const [ak, blk] = await Promise.all([viewAccessKey(s.account, s.publicKey), latestBlock()]);
  if (!ak) throw new Error('This device key is not on your account.');
  const nonce = (BigInt(ak.nonce) + 1n).toString();
  const maxBlockHeight = String(blk.header.height + 120);
  const da = buildDelegateAction({
    senderId: s.account, receiverId, nonce: BigInt(nonce), maxBlockHeight: BigInt(maxBlockHeight), publicKey: PublicKey.fromString(s.publicKey),
    actions: actions.map((a) => a.type === 'transfer' ? actionCreators.transfer(BigInt(a.deposit))
      : a.type === 'addKey' ? actionCreators.addKey(PublicKey.fromString(a.publicKey), actionCreators.functionCallAccessKey(s.account, a.methods, BigInt(a.allowance)))
      : actionCreators.functionCall(a.method, enc.encode(JSON.stringify(a.args)), BigInt(a.gas), BigInt(a.deposit))),
  });
  const sig = ed25519.sign(sha256(encodeDelegateAction(da)), keyFromString(s.secretKey).seed);
  return api<{ hash: string; relayer: string }>('/api/relay', { senderId: s.account, receiverId, nonce, maxBlockHeight, publicKey: s.publicKey, actions, signature: 'ed25519:' + bs58.encode(sig) });
}

// The recovery key from the last signup, held in memory only so the welcome screen can show it
// once. It is the account's only full access key and is never written to browser storage.
let lastRecovery: { account: string; secretKey: string } | null = null;
export const takeRecovery = () => { const r = lastRecovery; lastRecovery = null; return r; };

export async function signup(username: string) {
  const k = newKey();
  const owner = newKey();
  const u = username.trim().toLowerCase().replace(/^@/, '');
  const r = await api<{ account: string; hash: string; onchainLimits?: boolean }>('/api/account/create', { username: u, publicKey: k.publicKey, ownerKey: owner.publicKey });
  const s: Session = { account: r.account, username: u, secretKey: k.secretKey, publicKey: k.publicKey, createdAt: Date.now(), onchain: !!r.onchainLimits };
  setSession(s);
  addLocalActivity({ tx: r.hash, kind: 'signup', data: {}, at: Date.now() });
  if (r.onchainLimits) lastRecovery = { account: r.account, secretKey: owner.secretKey };
  // Register this device key in the NEAR Intents verifier, gasless. Not with on chain limits: a key
  // in the verifier could sign intents around the wallet contract, so the wallet moves tokens itself.
  let tries = r.onchainLimits ? -1 : 0;
  for (; tries >= 0;) {
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
  if (s.onchain) {
    // The wallet contract checks the per send cap, the 24 hour cap and the receiver rules on chain.
    const memo = req.memo ? { memo: req.memo } : {};
    const call = req.asset === 'pUSD' ? { method: 'send_token', args: { token_id: PUSD.assetId, receiver_id: req.to, amount: toUnits(req.amount, PUSD.decimals).toString(), ...memo } }
      : req.asset === 'USDC' ? { method: 'send_usdc', args: { receiver_id: req.to, amount: toUnits(req.amount, USDC_DECIMALS).toString(), ...memo } }
      : { method: 'send_near', args: { receiver_id: req.to, amount: nearToYocto(req.amount).toString() } };
    r = await metaTx(s, s.account, [{ type: 'functionCall', ...call, gas: SEND_GAS.toString(), deposit: '0' }]);
  } else if (req.asset === 'pUSD') {
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

export type QuoteRes = { market?: { maker: string; msg: string }; quote: { id: string; side: 'buy' | 'sell'; token: string; ticker: string; payAsset: string; getAsset: string; payUnits: string; getUnits: string; price: number; mid: number; spreadBps: number; usd: number; priceSource: string; priceAt: number; deadline: number }; mac: string };
export async function getQuote(side: 'buy' | 'sell', symbol: string, amount: { usd?: number; qty?: number }) {
  const s = must();
  return api<QuoteRes>('/api/trade/quote', { account: s.account, side, symbol, ...amount });
}
export async function trade(q: QuoteRes) {
  const s = must();
  if (s.onchain) {
    if (!q.market) throw new Error('This server cannot settle trades for on chain wallets yet.');
    const r0 = await metaTx(s, s.account, [{ type: 'functionCall', method: 'trade', args: { pay_token: q.quote.payAsset, pay_amount: q.quote.payUnits, msg: q.market.msg }, gas: TRADE_GAS.toString(), deposit: '0' }]);
    const tok = tokenBySymbol(q.quote.token)!;
    const qty = Number(BigInt(q.quote.side === 'buy' ? q.quote.getUnits : q.quote.payUnits)) / 10 ** tok.decimals;
    const r = { hash: r0.hash, qty: qty.toFixed(8), usd: q.quote.usd, price: q.quote.price, token: q.quote.token, side: q.quote.side };
    addLocalActivity({ tx: r.hash, kind: r.side, data: r, at: Date.now() });
    refreshAll();
    return r;
  }
  const { payload } = buildPayload(s.account, VERIFIER, [{ intent: 'token_diff', diff: { [q.quote.payAsset]: '-' + q.quote.payUnits, [q.quote.getAsset]: q.quote.getUnits } }], 60);
  const r = await api<{ hash: string; qty: string; usd: number; price: number; token: string; side: string }>('/api/trade/settle', { quote: q.quote, mac: q.mac, signed: signNep413(payload, seedOf(s)) });
  addLocalActivity({ tx: r.hash, kind: r.side, data: r, at: Date.now() });
  refreshAll();
  return r;
}

export class RecoveryNeeded extends Error { constructor() { super('Raising a limit needs your recovery key.'); } }
/** On chain rules: lowering is signed by this device and applies at once. Raising needs the recovery
 * key (used here in memory, never stored) and only takes effect after the raise delay. */
export async function saveLimit(limit: number, recoverySecret?: string): Promise<{ pending?: boolean }> {
  const s = must();
  if (s.onchain) {
    const cur = await view<Limits>(s.account, 'get_limits');
    const next = withDaily(cur, limit);
    if (!isRaise(next, cur)) {
      await metaTx(s, s.account, [{ type: 'functionCall', method: 'lower_limits', args: { limits: next }, gas: RULE_GAS.toString(), deposit: '0' }]);
      setRules({ limit });
      return {};
    }
    if (!recoverySecret) throw new RecoveryNeeded();
    const rk = keyFromString(recoverySecret.trim());
    await metaTx({ account: s.account, publicKey: rk.publicKey, secretKey: rk.secretKey }, s.account, [{ type: 'functionCall', method: 'propose_limits', args: { limits: next }, gas: RULE_GAS.toString(), deposit: '0' }]);
    return { pending: true };
  }
  const msg = JSON.stringify({ action: 'pocket.set_limit', account: s.account, limit, at: Date.now() });
  const signed = signNep413({ message: msg, nonce: randomNonce(), recipient: 'pocket' }, seedOf(s));
  await api('/api/limits', { signed });
  setRules({ limit });
  return {};
}

/** Cancel a raise that is still waiting. This device can do it. */
export async function cancelRaise() {
  const s = must();
  await metaTx(s, s.account, [{ type: 'functionCall', method: 'cancel_pending', args: {}, gas: RULE_GAS.toString(), deposit: '0' }]);
}

/** New phone: the recovery key adds a fresh device key (function call only) and is then forgotten. */
export async function restoreWithRecovery(account: string, recoverySecret: string) {
  const rk = keyFromString(recoverySecret.trim());
  const ak = await viewAccessKey(account, rk.publicKey);
  if (!ak || ak.permission !== 'FullAccess') throw new Error('That is not the recovery key of ' + account + '.');
  const k = newKey();
  await metaTx({ account, publicKey: rk.publicKey, secretKey: rk.secretKey }, account, [{ type: 'addKey', publicKey: k.publicKey, methods: [...DEVICE_METHODS], allowance: DEVICE_ALLOWANCE }]);
  const s: Session = { account, username: account.split('.')[0], secretKey: k.secretKey, publicKey: k.publicKey, createdAt: Date.now(), onchain: true };
  setSession(s);
  return s;
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
