import 'server-only';
import { plainFailure } from '../shared/plain';
// Pocket Pool: the server side of money movement on NEAR testnet.
// The server never holds a user key. It only:
//   - creates a user account with the user's own public key (sponsor),
//   - relays NEP-366 meta transactions the user signed (relayer pays gas),
//   - submits NEP-413 intents the user signed to the NEAR Intents verifier (relayer pays gas),
//   - quotes and counter signs paper trades as the maker,
//   - sends faucet pUSD inside the verifier.
import crypto from 'node:crypto';
import { actionCreators, buildDelegateAction, encodeDelegateAction, Signature, SignedDelegate, type Action } from '@near-js/transactions';
import { PublicKey } from '@near-js/crypto';
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import bs58 from 'bs58';
import { FAUCET, MAKER, MARKET, ONCHAIN_LIMITS, POOL, PUSD, QUOTE_KEY, RELAYER, ROOT, STOCKS, TOKENS, USDC, USDC_DECIMALS, VERIFIER, WALLET_CODE_HASH, tokenBySymbol, tokenByAsset } from '../shared/deployment';
import { rpc, view, viewAccessKey, viewAccount } from '../shared/rpc';
import { buildPayload, parseMessage, type Intent } from '../shared/intents';
import { signNep413, verifyNep413, keyFromString, type SignedNep413 } from '../shared/nep413';
import { toUnits, fromUnits, nearToYocto } from '../shared/units';
import { fnCall, signAndSend, signAndSendG, TGAS, type TxResult } from './tx';
import { G } from './globaltx';
import { DEVICE_ALLOWANCE, DEVICE_METHODS, DOLLAR_TOKENS, OWNER_TAG, PRICE_TAG, defaultLimits, dollarsOf, signTagged, verifyTagged, BLOCKLIST, type Limits, type SignedPrice } from '../shared/wallet';
import { secretKey } from './env';
import { tokenPrices } from './prices';
import { store, limit, HttpError } from './store';
import { checkReceiver, type Check } from '../shared/receiver';
import { delegatePolicy, walletPolicy, reserveSpend, burnNonce, isPocketUser, validAccountId, type DelegateJson } from '../shared/policy';
export { isPocketUser, validAccountId, type DelegateJson };

const need = (k: Parameters<typeof secretKey>[0]) => {
  const v = secretKey(k);
  if (!v) throw new HttpError(503, `${k.toLowerCase()} key is not set on this server, so this action is off. See README, section Self host.`);
  return v;
};

// ---------- balances ----------
export async function balances(account: string) {
  const ids = TOKENS.map((t) => t.assetId);
  const [acct, pool, usdc] = await Promise.all([
    viewAccount(account),
    view<string[]>(VERIFIER, 'mt_batch_balance_of', { account_id: account, token_ids: ids }).catch(() => ids.map(() => '0')),
    view<string>(USDC, 'ft_balance_of', { account_id: account }).catch(() => '0'),
  ]);
  return {
    account, exists: !!acct,
    near: acct ? fromUnits(BigInt(acct.amount), 24, 5) : '0',
    usdc: fromUnits(BigInt(usdc), USDC_DECIMALS),
    pool: Object.fromEntries(TOKENS.map((t, i) => [t.symbol, fromUnits(BigInt(pool[i] || '0'), t.decimals, 8)])),
  };
}

// ---------- intents ----------
async function executeIntents(signed: SignedNep413[]): Promise<TxResult> {
  // 100 TGas is enough for execute_intents; 300 TGas reserves about 0.3 NEAR from the relayer and was failing signups' faucet when the relayer had less than that.
  const r = await signAndSend(RELAYER, need('RELAYER'), VERIFIER, [fnCall('execute_intents', { signed }, 100n)]);
  if (!r.ok) throw new HttpError(400, 'The verifier rejected it: ' + r.failures.join('; ').slice(0, 300));
  return r;
}

// A key of the account: a full access key, or (on chain limits) the device's function call key,
// which can only call the account's own wallet contract.
export async function assertKeyOf(account: string, publicKey: string, fullOnly = false) {
  const ak = await viewAccessKey(account, publicKey);
  const perm = ak?.permission as { FunctionCall?: { receiver_id: string } } | 'FullAccess' | undefined;
  const ok = perm === 'FullAccess' || (!fullOnly && typeof perm === 'object' && perm?.FunctionCall?.receiver_id === account);
  if (!ok) throw new HttpError(403, 'That key does not belong to this account.');
}

// ---------- on chain limits ----------
export async function walletOf(account: string): Promise<{ limits: Limits; spentUsd: number; pending: unknown } | null> {
  if (!ONCHAIN_LIMITS) return null;
  try {
    const [limits, spent, pending] = await Promise.all([
      view<Limits>(account, 'get_limits'), view<{ usd: string }>(account, 'get_spent'), view<unknown>(account, 'get_pending'),
    ]);
    return { limits, spentUsd: dollarsOf(spent.usd), pending };
  } catch { return null; }
}

function checkSigned(s: SignedNep413, maxTtlSec: number) {
  if (s?.standard !== 'nep413' || !s.payload || s.payload.recipient !== VERIFIER) throw new HttpError(400, 'Wrong intent format or verifier.');
  if (!verifyNep413(s)) throw new HttpError(400, 'Bad signature.');
  const m = parseMessage(s.payload.message);
  if (!m) throw new HttpError(400, 'Bad intent message.');
  const dl = Date.parse(m.deadline);
  if (!(dl > Date.now()) || dl > Date.now() + maxTtlSec * 1000) throw new HttpError(400, 'Intent deadline is out of range.');
  return m;
}

// Daily send limit, set by the user with a signed message. Default 200 dollars, hard cap 5,000.
const DAY = 86400;
const dayKey = (a: string) => `sent:${a}:${new Date().toISOString().slice(0, 10)}`;
export async function getLimit(account: string) {
  const w = await walletOf(account);
  if (w) return dollarsOf(w.limits.usd_per_day);
  const v = await store.get('limit:' + account);
  return v > 0 ? v : 200;
}
// Atomic reserve (no check then act race), refunded if the chain rejects the send. See docs/POLICY.md L1.
async function spend(account: string, usd: number) {
  return reserveSpend(store, dayKey(account), await getLimit(account), usd, DAY);
}
async function settleOrRefund<T>(refund: (() => Promise<void>) | null, run: () => Promise<T>): Promise<T> {
  try { return await run(); } catch (e) { if (refund) await refund().catch(() => {}); throw e; }
}
export async function usedToday(account: string) {
  const w = await walletOf(account);
  return w ? w.spentUsd : store.get(dayKey(account));
}

export async function setLimit(signed: SignedNep413) {
  if (!verifyNep413(signed)) throw new HttpError(400, 'Bad signature.');
  let m: { action?: string; account?: string; limit?: number; at?: number };
  try { m = JSON.parse(signed.payload.message); } catch { throw new HttpError(400, 'Bad message.'); }
  if (m.action !== 'pocket.set_limit' || !m.account || typeof m.limit !== 'number' || !m.at || Math.abs(Date.now() - m.at) > 120000) throw new HttpError(400, 'Bad limit message.');
  if (signed.payload.recipient !== 'pocket') throw new HttpError(400, 'Wrong recipient.');
  if (!Number.isFinite(m.limit) || m.limit < 0 || m.limit > 5000) throw new HttpError(400, 'Limit must be between $0 and $5,000.');
  await limit('setlimit:' + m.account, 30, 3600);
  await assertKeyOf(m.account, signed.public_key);
  await burnNonce(store, 'limit', signed.payload.nonce, 300); // a signed limit change works once (N1)
  await store.incr('limit:' + m.account, 365 * DAY, m.limit - (await store.get('limit:' + m.account)));
  return { account: m.account, limit: m.limit };
}

// A user signed transfer inside the verifier: pUSD or a paper stock token, to any NEAR testnet account.
export async function submitTransfer(signed: SignedNep413, ip: string) {
  const m = checkSigned(signed, 600);
  if (!isPocketUser(m.signer_id)) throw new HttpError(403, 'Only Pocket accounts get free sends.');
  if (m.intents.length !== 1 || m.intents[0].intent !== 'transfer') throw new HttpError(400, 'Only one transfer per request.');
  const t = m.intents[0];
  const entries = Object.entries(t.tokens || {});
  if (entries.length !== 1) throw new HttpError(400, 'One token per transfer.');
  const [asset, amt] = entries[0];
  const tok = tokenByAsset(asset);
  if (!tok || !/^\d+$/.test(amt) || BigInt(amt) <= 0n) throw new HttpError(400, 'Unknown token or bad amount.');
  if (!validAccountId(t.receiver_id) || t.receiver_id === m.signer_id) throw new HttpError(400, 'That receiver name is not valid.');
  await limit('relay:' + m.signer_id, 60, 3600);
  await limit('relayip:' + ip, 120, 3600);
  await assertKeyOf(m.signer_id, signed.public_key);
  await assertReceiver(m.signer_id, t.receiver_id);
  const usd = tok.symbol === 'pUSD' ? Number(fromUnits(BigInt(amt), tok.decimals)) : 0;
  const refund = usd ? await spend(m.signer_id, usd) : null;
  const r = await settleOrRefund(refund, () => executeIntents([signed]));
  const data = { token: tok.symbol, amount: fromUnits(BigInt(amt), tok.decimals), to: t.receiver_id, memo: t.memo || null };
  await store.addActivity({ account: m.signer_id, kind: 'send', tx: r.hash, data, at: Date.now() });
  await store.addActivity({ account: t.receiver_id, kind: 'receive', tx: r.hash, data: { ...data, from: m.signer_id }, at: Date.now() });
  return { hash: r.hash, ...data };
}

// ---------- faucet ----------
export const FAUCET_AMOUNT = '1000';
export async function faucet(account: string, ip: string) {
  if (!validAccountId(account) || !account.endsWith('.testnet')) throw new HttpError(400, 'Enter a NEAR account.');
  if (!isPocketUser(account)) throw new HttpError(403, 'The Pocket faucet is for Pocket accounts.');
  if (!(await viewAccount(account))) throw new HttpError(400, 'That account does not exist yet.');
  await limit('faucetip:' + ip, Number(process.env.FAUCET_PER_IP_HOUR || 5), 3600);
  await limit('faucet:' + account, Number(process.env.FAUCET_PER_ACCOUNT_DAY || 3), DAY);
  const key = keyFromString(need('FAUCET'));
  const { payload } = buildPayload(FAUCET, VERIFIER, [{ intent: 'transfer', receiver_id: account, tokens: { [PUSD.assetId]: toUnits(FAUCET_AMOUNT, PUSD.decimals).toString() }, memo: 'Pocket faucet, test dollars, no value' }]);
  const signed = signNep413(payload, key.seed);
  const r = await executeIntents([signed]);
  await store.addActivity({ account, kind: 'faucet', tx: r.hash, data: { token: 'pUSD', amount: FAUCET_AMOUNT, from: FAUCET }, at: Date.now() });
  return { hash: r.hash, amount: FAUCET_AMOUNT, token: 'pUSD' };
}

// ---------- paper trades ----------
const SPREAD_BPS = 20; // 0.20 percent, shown on every quote and receipt
const QUOTE_TTL = 60;
const MAX_TRADE_USD = 1000;
const MAX_PRICE_AGE_MS = Number(process.env.MAX_PRICE_AGE_SEC || 900) * 1000;
const quoteKey = () => crypto.createHash('sha256').update('pocket-quote:' + (process.env.QUOTE_SECRET || secretKey('MAKER') || 'local')).digest();
export type Quote = { id: string; account: string; side: 'buy' | 'sell'; token: string; ticker: string; payAsset: string; getAsset: string; payUnits: string; getUnits: string; price: number; mid: number; spreadBps: number; usd: number; priceSource: string; priceAt: number; deadline: number };
const mac = (q: Quote) => crypto.createHmac('sha256', quoteKey()).update(JSON.stringify(q)).digest('base64url');

export async function quote(account: string, side: 'buy' | 'sell', symbol: string, amount: { usd?: number; qty?: number }) {
  const st = STOCKS.find((s) => s.ticker === symbol.toUpperCase() || s.token.toUpperCase() === symbol.toUpperCase());
  if (!st) throw new HttpError(400, 'Unknown stock.');
  const tok = tokenBySymbol(st.token)!;
  const { tokens, fetchedAt } = await tokenPrices();
  const p = tokens[st.token];
  if (!p) throw new HttpError(503, 'No live price right now, so Pocket will not quote.');
  if (Date.now() - p.updatedAt > MAX_PRICE_AGE_MS) throw new HttpError(503, `The price is ${Math.round((Date.now() - p.updatedAt) / 1000)} s old, so Pocket will not quote.`);
  const mid = p.price;
  const price = side === 'buy' ? mid * (1 + SPREAD_BPS / 1e4) : mid * (1 - SPREAD_BPS / 1e4);
  let usd: number, qty: number;
  if (amount.usd != null) { usd = amount.usd; qty = usd / price; } else if (amount.qty != null) { qty = amount.qty; usd = qty * price; } else throw new HttpError(400, 'Give an amount.');
  if (!(usd > 0) || usd > MAX_TRADE_USD) throw new HttpError(400, `Trades are between $0.01 and $${MAX_TRADE_USD} of paper money.`);
  usd = Math.floor(usd * 1e6) / 1e6;
  const usdUnits = toUnits(usd.toFixed(6), PUSD.decimals);
  const qtyUnits = toUnits(qty.toFixed(12), tok.decimals);
  const q: Quote = {
    id: crypto.randomUUID(), account, side, token: st.token, ticker: st.ticker,
    payAsset: side === 'buy' ? PUSD.assetId : tok.assetId, getAsset: side === 'buy' ? tok.assetId : PUSD.assetId,
    payUnits: (side === 'buy' ? usdUnits : qtyUnits).toString(), getUnits: (side === 'buy' ? qtyUnits : usdUnits).toString(),
    price: +price.toFixed(4), mid, spreadBps: SPREAD_BPS, usd, priceSource: 'CoinGecko ' + st.cg, priceAt: p.updatedAt || fetchedAt,
    deadline: Date.now() + QUOTE_TTL * 1000,
  };
  return { quote: q, mac: mac(q), ...(ONCHAIN_LIMITS && secretKey('QUOTE') ? { market: { maker: MARKET, msg: signMarketQuote(q) } } : {}) };
}

export async function settle(q: Quote, m: string, signed: SignedNep413, ip: string) {
  if (!q || mac(q) !== m) throw new HttpError(400, 'Quote was changed or is not ours.');
  if (Date.now() > q.deadline) throw new HttpError(400, 'Quote expired. Get a new one.');
  const msg = checkSigned(signed, QUOTE_TTL + 30);
  if (msg.signer_id !== q.account) throw new HttpError(400, 'Signer does not match the quote.');
  const want: Intent = { intent: 'token_diff', diff: { [q.payAsset]: '-' + q.payUnits, [q.getAsset]: q.getUnits } };
  if (msg.intents.length !== 1 || msg.intents[0].intent !== 'token_diff') throw new HttpError(400, 'Expected one token_diff.');
  const d = (msg.intents[0] as { diff: Record<string, string> }).diff;
  if (Object.keys(d).length !== 2 || d[q.payAsset] !== '-' + q.payUnits || d[q.getAsset] !== q.getUnits) throw new HttpError(400, 'Signed amounts do not match the quote.');
  await limit('trade:' + q.account, 60, 3600);
  await limit('tradeip:' + ip, 200, 3600);
  if ((await store.incr('q:' + q.id, 3600)) > 1) throw new HttpError(400, 'This quote was already used.');
  const memo = `pocket ${q.side} ${q.token} price ${q.price} mid ${q.mid} spread_bps ${q.spreadBps} source ${q.priceSource} at ${new Date(q.priceAt).toISOString()}`;
  const maker = keyFromString(need('MAKER'));
  const { payload } = buildPayload(MAKER, VERIFIER, [{ intent: 'token_diff', diff: { [q.payAsset]: q.payUnits, [q.getAsset]: '-' + q.getUnits }, memo }], QUOTE_TTL + 30);
  const makerSigned = signNep413(payload, maker.seed);
  const r = await executeIntents([signed, makerSigned]);
  const tok = tokenBySymbol(q.token)!;
  const data = { side: q.side, token: q.token, qty: fromUnits(BigInt(q.side === 'buy' ? q.getUnits : q.payUnits), tok.decimals, 8), usd: q.usd, price: q.price, mid: q.mid, spreadBps: q.spreadBps, priceSource: q.priceSource, priceAt: q.priceAt };
  await store.addActivity({ account: q.account, kind: q.side, tx: r.hash, data, at: Date.now() });
  void want;
  return { hash: r.hash, ...data };
}

// ---------- accounts ----------
export async function createAccount(username: string, publicKey: string, ip: string, ownerKey?: string) {
  const u = username.toLowerCase();
  if (!/^[a-z0-9]([a-z0-9_-]{0,30}[a-z0-9])?$/.test(u) || u.length < 2) throw new HttpError(400, 'Usernames are 2 to 32 letters or numbers, dash or underscore inside.');
  const id = `${u}.${ROOT}`;
  if (!isPocketUser(id)) throw new HttpError(400, 'That username is reserved.');
  if (!/^ed25519:[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(publicKey)) throw new HttpError(400, 'Bad public key.');
  if (await viewAccount(id)) throw new HttpError(409, 'That username is taken.');
  await limit('signupip:' + ip, Number(process.env.SIGNUP_PER_IP_HOUR || 5), 3600);
  await limit('signupday', Number(process.env.SIGNUP_PER_DAY || 300), DAY);
  const sponsor = need('SPONSOR');
  if (ONCHAIN_LIMITS) {
    // On chain limits: the account runs the Pocket wallet (global contract by code hash). The
    // recovery key is the only full access key; the phone gets a function call key that can only
    // call this account's own wallet methods. One transaction, so nobody can init it in between.
    if (!ownerKey || !/^ed25519:[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(ownerKey) || ownerKey === publicKey) throw new HttpError(400, 'A separate recovery key is needed.');
    const gas = 30n * TGAS;
    let r;
    try {
      r = await signAndSendG(ROOT, sponsor, id, [
        G.createAccount(),
        G.transfer(nearToYocto(process.env.SIGNUP_NEAR || '0.1')),
        G.globalCode(WALLET_CODE_HASH),
        // Wallet v2: no full access key at all. The recovery key only signs owner messages that the
        // contract checks itself; the phone gets a function call key for this account's wallet methods.
        ...(WALLET_V1 ? [G.fullKey(ownerKey)] : []),
        G.fnKey(publicKey, id, DEVICE_METHODS, BigInt(DEVICE_ALLOWANCE)),
        G.call('new', { owner_keys: [ownerKey], verifier: VERIFIER, usdc: USDC, maker: MARKET, dollar_tokens: DOLLAR_TOKENS, limits: defaultLimits(), price_key: QUOTE_KEY, ...(WALLET_HAS_POOL && POOL ? { pool: POOL } : {}) }, gas),
      ]);
    } catch {
      throw new HttpError(503, 'We could not set up your Pocket right now. Please try again in a few minutes.');
    }
    if (!r.ok) throw new HttpError(503, 'We could not set up your Pocket right now. Please try again in a few minutes.');
    const s = await signAndSend(ROOT, sponsor, USDC, [fnCall('storage_deposit', { account_id: id, registration_only: true }, 30n, nearToYocto('0.00125'))]).catch(() => null);
    await store.addActivity({ account: id, kind: 'signup', tx: r.hash, data: { near: process.env.SIGNUP_NEAR || '0.1', wallet: WALLET_CODE_HASH }, at: Date.now() });
    return { account: id, hash: r.hash, usdcStorageTx: s?.hash || null, onchainLimits: true };
  }
  const actions: Action[] = [
    actionCreators.createAccount(),
    actionCreators.transfer(nearToYocto(process.env.SIGNUP_NEAR || '0.05')),
    actionCreators.addKey(PublicKey.fromString(publicKey), actionCreators.fullAccessKey()),
  ];
  let r;
  try { r = await signAndSend(ROOT, sponsor, id, actions); } catch {
    throw new HttpError(503, 'We could not set up your Pocket right now. Please try again in a few minutes.');
  }
  if (!r.ok) throw new HttpError(503, 'We could not set up your Pocket right now. Please try again in a few minutes.');
  // Register the new account for USDC so it can receive Circle testnet dollars. Paid by the sponsor.
  const s = await signAndSend(ROOT, sponsor, USDC, [fnCall('storage_deposit', { account_id: id, registration_only: true }, 30n, nearToYocto('0.00125'))]).catch(() => null);
  await store.addActivity({ account: id, kind: 'signup', tx: r.hash, data: { near: process.env.SIGNUP_NEAR || '0.05' }, at: Date.now() });
  return { account: id, hash: r.hash, usdcStorageTx: s?.hash || null };
}

// ---------- receiver check ----------
// Facts from the chain and Pocket's own records; the app adds the user's contacts.
const SERVICE_ACCOUNTS = () => [ROOT, VERIFIER, MAKER, FAUCET, RELAYER, MARKET, USDC, `admin.${ROOT}`, ...TOKENS.map((t) => t.contract)].filter(Boolean) as string[];
export async function receiverCheck(from: string, to: string, contacts: { name: string; account: string }[] = []): Promise<Check> {
  const t = String(to || '').trim().toLowerCase();
  if (!validAccountId(t)) return checkReceiver({ from, to: t, root: ROOT, services: SERVICE_ACCOUNTS(), exists: null });
  const [acct, wallet, acts, createdMs] = await Promise.all([
    viewAccount(t).then((a) => a, () => undefined),
    walletOf(from),
    store.activity(from, 500).catch(() => []),
    accountCreatedMs(t),
  ]);
  const a = acct as { code_hash?: string; global_contract_hash?: string } | null | undefined;
  const isContract = !!a && ((!!a.code_hash && a.code_hash !== '11111111111111111111111111111111') || (!!a.global_contract_hash && a.global_contract_hash !== WALLET_CODE_HASH));
  return checkReceiver({
    from, to: t, root: ROOT, services: SERVICE_ACCOUNTS(), exists: acct === undefined ? null : !!acct, isContract,
    blocked: wallet?.limits.blocked ?? undefined, allowOnly: wallet?.limits.allow_only ?? undefined,
    paidBefore: [...new Set(acts.filter((x) => x.kind === 'send').map((x) => String(x.data.to)))], contacts,
    shared: BLOCKLIST, createdMs,
  });
}
// When an account was created, from the public NearBlocks indexer. Cached; null when unknown (never blocks).
const createdCache = new Map<string, number | null>();
async function accountCreatedMs(id: string): Promise<number | null> {
  if (createdCache.has(id)) return createdCache.get(id)!;
  try {
    const r = await fetch(`https://api-testnet.nearblocks.io/v1/account/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(2500) });
    const j = r.ok ? await r.json() : null;
    const ns = j?.account?.[0]?.created?.block_timestamp;
    const ms = typeof ns === 'number' || typeof ns === 'string' ? Math.floor(Number(ns) / 1e6) : null;
    const v = ms && Number.isFinite(ms) ? ms : null;
    if (createdCache.size > 2000) createdCache.clear();
    if (v && Date.now() - v > 86_400_000) createdCache.set(id, v);
    return v;
  } catch { return null; }
}
// Second layer before Pocket pays gas: a block is refused here even if a modified app skipped the check.
async function assertReceiver(from: string, to: string) {
  const c = await receiverCheck(from, to);
  if (c.verdict === 'block') throw new HttpError(403, 'Pocket will not send there: ' + c.reasons.filter((r) => r.level === 'block').map((r) => r.text).join(' '));
}

// ---------- NEP-366 meta transactions ----------
// Relayer policy: delegatePolicy in src/lib/shared/policy.ts (rules R1 to R7, docs/POLICY.md).

export function toDelegate(d: DelegateJson) {
  const actions: Action[] = d.actions.map((a) => a.type === 'transfer'
    ? actionCreators.transfer(BigInt(a.deposit))
    : a.type === 'addKey'
      ? actionCreators.addKey(PublicKey.fromString(a.publicKey), actionCreators.functionCallAccessKey(d.senderId, a.methods, BigInt(a.allowance)))
      : actionCreators.functionCall(a.method, Buffer.from(JSON.stringify(a.args)), BigInt(a.gas), BigInt(a.deposit)));
  return buildDelegateAction({ senderId: d.senderId, receiverId: d.receiverId, nonce: BigInt(d.nonce), maxBlockHeight: BigInt(d.maxBlockHeight), publicKey: PublicKey.fromString(d.publicKey), actions });
}

export async function relay(d: DelegateJson, ip: string) {
  const usd = delegatePolicy(d);
  const da = toDelegate(d);
  let sig: Uint8Array, pub: Uint8Array;
  try { sig = bs58.decode(String(d.signature).replace(/^ed25519:/, '')); pub = bs58.decode(String(d.publicKey).replace(/^ed25519:/, '')); } catch { throw new HttpError(400, 'Bad key or signature encoding.'); }
  if (pub.length !== 32 || sig.length !== 64) throw new HttpError(400, 'Bad signature on the meta transaction.');
  if (!ed25519.verify(sig, sha256(encodeDelegateAction(da)), pub)) throw new HttpError(400, 'Bad signature on the meta transaction.');
  const own = d.receiverId === d.senderId;
  const wp = own ? walletPolicy(d) : null;
  // Restoring a device (AddKey) needs the recovery key, a full access key.
  await assertKeyOf(d.senderId, d.publicKey, wp?.method === 'add_device_key');
  await limit('relay:' + d.senderId, 60, 3600);
  await limit('relayip:' + ip, 120, 3600);
  if (wp?.method === 'trade') checkTradeMsg(d);
  if (wp && wp.method.startsWith('send_') && wp.method !== 'send_private') await assertReceiver(d.senderId, String((d.actions[0] as unknown as { args: { receiver_id: string } }).args.receiver_id));
  if (wp?.method === 'send_usdc') await ensureUsdcStorage(String((d.actions[0] as unknown as { args: { receiver_id: string } }).args.receiver_id));
  const refund = usd ? await spend(d.senderId, usd) : null;
  const signedDelegate = new SignedDelegate({ delegateAction: da, signature: new Signature({ keyType: 0, data: sig }) });
  const r = await settleOrRefund(refund, async () => {
    const res = await signAndSend(RELAYER, need('RELAYER'), d.senderId, [actionCreators.signedDelegate(signedDelegate)]);
    if (!res.ok) throw new HttpError(400, plainFailure(res.failures));
    return res;
  });
  if (wp) {
    if (wp.method === 'trade') {
      const why = r.logs.find((l) => l.startsWith('Pocket maker: refund'));
      if (why || r.logs.some((l) => l.startsWith('Pocket: trade refunded'))) throw new HttpError(400, 'The trade did not go through and your tokens came back' + (why ? ': ' + why.replace('Pocket maker: refund, ', '') : '.'));
    }
    await walletActivity(d, wp.method, r.hash, r.ok);
    return { hash: r.hash, relayer: RELAYER, onchain: true };
  }
  const ft = d.actions.find((a) => a.type === 'functionCall' && a.method === 'ft_transfer') as { args: { receiver_id: string; amount: string; memo?: string } } | undefined;
  const nearT = d.actions.find((a) => a.type === 'transfer') as { deposit: string } | undefined;
  if (ft) {
    const data = { token: 'USDC', amount: fromUnits(BigInt(ft.args.amount), USDC_DECIMALS), to: ft.args.receiver_id, memo: ft.args.memo || null, gasPaidBy: RELAYER };
    await store.addActivity({ account: d.senderId, kind: 'send', tx: r.hash, data, at: Date.now() });
    await store.addActivity({ account: ft.args.receiver_id, kind: 'receive', tx: r.hash, data: { ...data, from: d.senderId }, at: Date.now() });
  } else if (nearT) {
    const data = { token: 'NEAR', amount: fromUnits(BigInt(nearT.deposit), 24, 5), to: d.receiverId, gasPaidBy: RELAYER };
    await store.addActivity({ account: d.senderId, kind: 'send', tx: r.hash, data, at: Date.now() });
  }
  return { hash: r.hash, relayer: RELAYER };
}

// The chain may still refuse a send the server allowed (its rules are the real ones). In that case
// the outer transaction succeeds but the wallet call fails, so check the receipts.
async function walletActivity(d: DelegateJson, method: string, hash: string, ok: boolean) {
  if (!ok) return;
  const a = d.actions[0] as { type: string; args?: Record<string, string> };
  const x = a.args || {};
  if (method === 'send_usdc' || method === 'send_token' || method === 'send_near') {
    const tok = method === 'send_usdc' ? { symbol: 'USDC', decimals: USDC_DECIMALS } : method === 'send_near' ? { symbol: 'NEAR', decimals: 24 } : tokenByAsset(x.token_id)!;
    const data = { token: tok.symbol, amount: fromUnits(BigInt(x.amount), tok.decimals, 8), to: x.receiver_id, memo: x.memo || null, gasPaidBy: RELAYER, limits: 'enforced by your wallet contract' };
    await store.addActivity({ account: d.senderId, kind: 'send', tx: hash, data, at: Date.now() });
    await store.addActivity({ account: x.receiver_id, kind: 'receive', tx: hash, data: { ...data, from: d.senderId }, at: Date.now() });
  } else if (method === 'trade') {
    try {
      const q = JSON.parse(JSON.parse(x.msg).quote);
      const pay = tokenByAsset(q.pay_token)!, get = tokenByAsset(q.get_token)!;
      const side = pay.symbol === 'pUSD' ? 'buy' : 'sell';
      const stock = side === 'buy' ? get : pay;
      const data = { side, token: stock.symbol, qty: fromUnits(BigInt(side === 'buy' ? q.get_units : q.pay_units), stock.decimals, 8), usd: Number(fromUnits(BigInt(side === 'buy' ? q.pay_units : q.get_units), 6)), maker: MARKET };
      await store.addActivity({ account: d.senderId, kind: side, tx: hash, data, at: Date.now() });
    } catch { /* activity is best effort */ }
  }
}

async function ensureUsdcStorage(account: string) {
  const reg = await view<unknown>(USDC, 'storage_balance_of', { account_id: account }).catch(() => null);
  if (reg) return;
  await limit('usdcreg:all', 200, 86400);
  await signAndSend(ROOT, need('SPONSOR'), USDC, [fnCall('storage_deposit', { account_id: account, registration_only: true }, 30n, nearToYocto('0.00125'))]).catch(() => null);
}

// ---------- quotes signed for the market contract ----------
const quoteSeed = () => keyFromString(need('QUOTE')).seed;
// ---------- wallet v2: signed prices and owner messages ----------
// Until the v2 code is deployed as a global contract, signups keep the v1 layout (recovery = full key).
const WALLET_V1 = WALLET_CODE_HASH === 'C5VZEhzSt5HdEaiR7bFYj1aVZrg6VX9ScQqgFjKoKgAz';
/** Wallet v3 adds send_private (the private pool). Signups pass the pool only to this code. */
const WALLET_HAS_POOL = WALLET_CODE_HASH === 'DQXeGy6AJ1t2q4EhoDJ1MPwPpmSRyzRMrKi3uygwDAkY';
/** Pocket's price attestation for the wallet contract: micro dollars per whole unit, valid 5 minutes.
 * NEAR from CoinGecko, paper stocks from the same CoinGecko feed the quotes use. */
export async function priceAttest(token: string): Promise<SignedPrice & { usd: number; source: string }> {
  const { tokens } = await tokenPrices();
  const sym = token === 'near' ? 'NEAR' : tokenByAsset(token)?.symbol;
  const tok = token === 'near' ? { decimals: 24 } : tokenByAsset(token);
  const p = sym ? tokens[sym] : undefined;
  if (!sym || !tok || sym === 'pUSD') throw new HttpError(400, 'Pocket signs prices for NEAR and the paper stocks only.');
  if (!p || Date.now() - p.updatedAt > MAX_PRICE_AGE_MS) throw new HttpError(503, 'No fresh price right now, so Pocket will not sign one.');
  const payload = JSON.stringify({ v: 1, token, micro_usd: String(Math.round(p.price * 1e6)), decimals: tok.decimals, expires_ms: Date.now() + 5 * 60_000 });
  return { payload, signature: signTagged(PRICE_TAG, payload, quoteSeed()), usd: p.price, source: 'CoinGecko' };
}

/** Submit an owner message (signed by the recovery key) to the user's wallet. The relayer pays the
 * gas; the contract checks the signature and nonce itself. Checked here first so bad ones cost nothing. */
export async function submitOwner(account: string, payload: string, publicKey: string, signature: string, ip: string) {
  if (!isPocketUser(account)) throw new HttpError(403, 'Only Pocket accounts.');
  if (typeof payload !== 'string' || payload.length > 8192 || !/^[0-9a-f]{128}$/.test(String(signature)) || !/^ed25519:[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(String(publicKey))) throw new HttpError(400, 'Bad owner message.');
  await limit('owner:' + account, 20, 3600);
  await limit('ownerip:' + ip, 40, 3600);
  const cfg = await view<{ owner_keys: string[]; owner_nonce: number }>(account, 'get_config').catch(() => null);
  if (!cfg || cfg.owner_nonce == null) throw new HttpError(400, 'This account does not run wallet v2.');
  if (!cfg.owner_keys.includes(publicKey)) throw new HttpError(403, 'That is not the recovery key of this account.');
  if (!verifyTagged(OWNER_TAG, payload, signature, bs58.decode(publicKey.slice(8)))) throw new HttpError(400, 'Bad owner signature.');
  let m: { account?: string; nonce?: number };
  try { m = JSON.parse(payload); } catch { throw new HttpError(400, 'Bad owner message.'); }
  if (m.account !== account || m.nonce !== cfg.owner_nonce + 1) throw new HttpError(400, 'Old or out of order owner message. Try again.');
  const r = await signAndSend(RELAYER, need('RELAYER'), account, [fnCall('owner_action', { payload, public_key: publicKey, signature }, 60n)]);
  if (!r.ok) throw new HttpError(400, 'The wallet refused it: ' + r.failures.join('; ').slice(0, 300));
  return { hash: r.hash, logs: r.logs };
}

export function signMarketQuote(q: Quote) {
  const quote = JSON.stringify({ v: 1, maker: MARKET, id: q.id, account: q.account, pay_token: q.payAsset, pay_units: q.payUnits, get_token: q.getAsset, get_units: q.getUnits, deadline_ms: q.deadline });
  const signature = Buffer.from(ed25519.sign(new TextEncoder().encode(quote), quoteSeed())).toString('base64');
  return JSON.stringify({ quote, signature });
}
// Second layer for trades: the wallet message must carry a quote Pocket signed for this account.
function checkTradeMsg(d: DelegateJson) {
  const args = (d.actions[0] as unknown as { args: { msg: string; pay_token: string; pay_amount: string } }).args;
  let m: { quote: string; signature: string }, q: { account: string; pay_token: string; pay_units: string; deadline_ms: number; maker: string };
  try { m = JSON.parse(args.msg); q = JSON.parse(m.quote); } catch { throw new HttpError(400, 'Bad trade message.'); }
  const pub = bs58.decode(QUOTE_KEY.replace(/^ed25519:/, ''));
  let good = false;
  try { good = ed25519.verify(Buffer.from(m.signature, 'base64'), new TextEncoder().encode(m.quote), pub); } catch { good = false; }
  if (!good) throw new HttpError(400, 'That quote is not from Pocket.');
  if (q.account !== d.senderId || q.maker !== MARKET || q.pay_token !== args.pay_token || q.pay_units !== args.pay_amount) throw new HttpError(400, 'The trade does not match its quote.');
  if (!(q.deadline_ms > Date.now())) throw new HttpError(400, 'Quote expired. Get a new one.');
}

export async function chainInfo() {
  const [st, block] = await Promise.all([viewAccount(VERIFIER), rpc<{ header: { height: number } }>('block', { finality: 'final' })]);
  return { verifier: VERIFIER, verifierCodeHash: st?.code_hash ?? null, block: block.header.height };
}

// ---------- private pool: the relayer submits a withdrawal the phone proved ----------
/** The phone builds the Groth16 proof in the browser and sends only public values here: the proof, the root,
 * the nullifier hash and the recipient. The note's secret never reaches the server. The relayer pays the gas
 * and takes no fee, so the receiver needs no NEAR and the payout does not come from the sender's account.
 * The contract checks everything; this is only a shape check and a rate limit. */
export async function poolWithdraw(b: { proof?: { pi_a?: unknown; pi_b?: unknown; pi_c?: unknown }; root?: unknown; nullifier_hash?: unknown; recipient?: unknown }, ip: string) {
  if (!POOL) throw new HttpError(503, 'Private send is not available here yet.');
  await limit('poolw:' + ip, 20, 3600);
  const num = (v: unknown) => typeof v === 'string' && /^[0-9]{1,78}$/.test(v);
  const p = b.proof;
  const pts = (v: unknown, n: number, inner?: number): boolean => Array.isArray(v) && v.length === n && v.every((x) => (inner ? pts(x, inner) : num(x)));
  if (!p || !pts(p.pi_a, 2) || !pts(p.pi_b, 2, 2) || !pts(p.pi_c, 2) || !num(b.root) || !num(b.nullifier_hash)) throw new HttpError(400, 'This private send could not be checked. Nothing was sent.');
  if (!validAccountId(b.recipient)) throw new HttpError(400, 'That receiver name is not valid.');
  const args = { proof: { pi_a: p.pi_a, pi_b: p.pi_b, pi_c: p.pi_c }, root: b.root, nullifier_hash: b.nullifier_hash, recipient: b.recipient, relayer: null, fee: '0' };
  const r = await signAndSend(RELAYER, need('RELAYER'), POOL, [fnCall('withdraw', args, 100n)]);
  if (!r.ok) throw new HttpError(400, 'This private send was refused and nothing moved. ' + plainFailure(r.failures));
  return { hash: r.hash, pool: POOL };
}

