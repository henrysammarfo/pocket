import 'server-only';
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
import { FAUCET, MAKER, PUSD, RELAYER, ROOT, STOCKS, TOKENS, USDC, USDC_DECIMALS, VERIFIER, tokenBySymbol, tokenByAsset } from '../shared/deployment';
import { rpc, view, viewAccessKey, viewAccount } from '../shared/rpc';
import { buildPayload, parseMessage, type Intent } from '../shared/intents';
import { signNep413, verifyNep413, keyFromString, type SignedNep413 } from '../shared/nep413';
import { toUnits, fromUnits, nearToYocto } from '../shared/units';
import { fnCall, signAndSend, TGAS, type TxResult } from './tx';
import { secretKey } from './env';
import { tokenPrices } from './prices';
import { store, limit, HttpError } from './store';

const need = (k: Parameters<typeof secretKey>[0]) => {
  const v = secretKey(k);
  if (!v) throw new HttpError(503, `${k.toLowerCase()} key is not set on this server, so this action is off. See README, section Self host.`);
  return v;
};
export const isPocketUser = (a: string) => a.endsWith('.' + ROOT) && /^[a-z0-9_-]{2,32}$/.test(a.slice(0, -ROOT.length - 1)) && !['admin', 'verifier', 'maker', 'faucet', 'relayer', ...TOKENS.map((t) => t.contract.split('.')[0])].includes(a.split('.')[0]);
export const validAccountId = (a: string) => /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(a) && a.length >= 2 && a.length <= 64;

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
  const r = await signAndSend(RELAYER, need('RELAYER'), VERIFIER, [fnCall('execute_intents', { signed }, 300n)]);
  if (!r.ok) throw new HttpError(400, 'The verifier rejected it: ' + r.failures.join('; ').slice(0, 300));
  return r;
}

async function assertKeyOf(account: string, publicKey: string) {
  const ak = await viewAccessKey(account, publicKey);
  if (!ak || ak.permission !== 'FullAccess') throw new HttpError(403, 'That key does not belong to this account.');
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
  const v = await store.get('limit:' + account);
  return v > 0 ? v : 200;
}
async function spend(account: string, usd: number) {
  const lim = await getLimit(account);
  const used = await store.get(dayKey(account));
  if (used + usd > lim + 1e-9) throw new HttpError(403, `Over your daily send limit of $${lim}. You have $${Math.max(0, lim - used).toFixed(2)} left today.`);
  await store.incr(dayKey(account), DAY, usd);
}
export async function usedToday(account: string) { return store.get(dayKey(account)); }

export async function setLimit(signed: SignedNep413) {
  if (!verifyNep413(signed)) throw new HttpError(400, 'Bad signature.');
  let m: { action?: string; account?: string; limit?: number; at?: number };
  try { m = JSON.parse(signed.payload.message); } catch { throw new HttpError(400, 'Bad message.'); }
  if (m.action !== 'pocket.set_limit' || !m.account || typeof m.limit !== 'number' || !m.at || Math.abs(Date.now() - m.at) > 120000) throw new HttpError(400, 'Bad limit message.');
  if (signed.payload.recipient !== 'pocket') throw new HttpError(400, 'Wrong recipient.');
  if (m.limit < 0 || m.limit > 5000) throw new HttpError(400, 'Limit must be between $0 and $5,000.');
  await assertKeyOf(m.account, signed.public_key);
  await store.incr('limit:' + m.account, 365 * DAY, m.limit - (await store.get('limit:' + m.account)));
  return { account: m.account, limit: m.limit };
}

// A user signed transfer inside the verifier: pUSD or a paper stock token, to any NEAR testnet account.
export async function submitTransfer(signed: SignedNep413, ip: string) {
  const m = checkSigned(signed, 600);
  if (!isPocketUser(m.signer_id)) throw new HttpError(403, 'Only Pocket accounts can use the Pocket relayer.');
  if (m.intents.length !== 1 || m.intents[0].intent !== 'transfer') throw new HttpError(400, 'Only one transfer per request.');
  const t = m.intents[0];
  const entries = Object.entries(t.tokens || {});
  if (entries.length !== 1) throw new HttpError(400, 'One token per transfer.');
  const [asset, amt] = entries[0];
  const tok = tokenByAsset(asset);
  if (!tok || !/^\d+$/.test(amt) || BigInt(amt) <= 0n) throw new HttpError(400, 'Unknown token or bad amount.');
  if (!validAccountId(t.receiver_id) || t.receiver_id === m.signer_id) throw new HttpError(400, 'Bad receiver.');
  await limit('relay:' + m.signer_id, 60, 3600);
  await limit('relayip:' + ip, 120, 3600);
  await assertKeyOf(m.signer_id, signed.public_key);
  const usd = tok.symbol === 'pUSD' ? Number(fromUnits(BigInt(amt), tok.decimals)) : 0;
  if (usd) await spend(m.signer_id, usd);
  const r = await executeIntents([signed]);
  const data = { token: tok.symbol, amount: fromUnits(BigInt(amt), tok.decimals), to: t.receiver_id, memo: t.memo || null };
  await store.addActivity({ account: m.signer_id, kind: 'send', tx: r.hash, data, at: Date.now() });
  await store.addActivity({ account: t.receiver_id, kind: 'receive', tx: r.hash, data: { ...data, from: m.signer_id }, at: Date.now() });
  return { hash: r.hash, ...data };
}

// ---------- faucet ----------
export const FAUCET_AMOUNT = '1000';
export async function faucet(account: string, ip: string) {
  if (!validAccountId(account) || !account.endsWith('.testnet')) throw new HttpError(400, 'Enter a NEAR testnet account.');
  if (!(await viewAccount(account))) throw new HttpError(400, 'That account does not exist on testnet yet.');
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
  return { quote: q, mac: mac(q) };
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
export async function createAccount(username: string, publicKey: string, ip: string) {
  const u = username.toLowerCase();
  if (!/^[a-z0-9]([a-z0-9_-]{0,30}[a-z0-9])?$/.test(u) || u.length < 2) throw new HttpError(400, 'Usernames are 2 to 32 letters or numbers, dash or underscore inside.');
  const id = `${u}.${ROOT}`;
  if (!isPocketUser(id)) throw new HttpError(400, 'That username is reserved.');
  if (!/^ed25519:[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(publicKey)) throw new HttpError(400, 'Bad public key.');
  if (await viewAccount(id)) throw new HttpError(409, 'That username is taken.');
  await limit('signupip:' + ip, Number(process.env.SIGNUP_PER_IP_HOUR || 5), 3600);
  await limit('signupday', Number(process.env.SIGNUP_PER_DAY || 300), DAY);
  const sponsor = need('SPONSOR');
  const actions: Action[] = [
    actionCreators.createAccount(),
    actionCreators.transfer(nearToYocto(process.env.SIGNUP_NEAR || '0.05')),
    actionCreators.addKey(PublicKey.fromString(publicKey), actionCreators.fullAccessKey()),
  ];
  const r = await signAndSend(ROOT, sponsor, id, actions);
  if (!r.ok) throw new HttpError(400, 'Could not create the account: ' + r.failures.join('; ').slice(0, 200));
  // Register the new account for USDC so it can receive Circle testnet dollars. Paid by the sponsor.
  const s = await signAndSend(ROOT, sponsor, USDC, [fnCall('storage_deposit', { account_id: id, registration_only: true }, 30n, nearToYocto('0.00125'))]).catch(() => null);
  await store.addActivity({ account: id, kind: 'signup', tx: r.hash, data: { near: process.env.SIGNUP_NEAR || '0.05' }, at: Date.now() });
  return { account: id, hash: r.hash, usdcStorageTx: s?.hash || null };
}

// ---------- NEP-366 meta transactions ----------
export type DelegateJson = {
  senderId: string; receiverId: string; nonce: string; maxBlockHeight: string; publicKey: string;
  actions: ({ type: 'functionCall'; method: string; args: Record<string, unknown>; gas: string; deposit: string } | { type: 'transfer'; deposit: string })[];
  signature: string;
};
const ONE_YOCTO = '1';
const USDC_STORAGE = nearToYocto('0.00125').toString();

function delegatePolicy(d: DelegateJson) {
  if (!isPocketUser(d.senderId)) throw new HttpError(403, 'Only Pocket accounts can use the Pocket relayer.');
  if (!Array.isArray(d.actions) || d.actions.length < 1 || d.actions.length > 2) throw new HttpError(400, 'One or two actions only.');
  let usd = 0;
  for (const a of d.actions) {
    if (a.type === 'transfer') {
      if (!validAccountId(d.receiverId)) throw new HttpError(400, 'Bad receiver.');
      if (BigInt(a.deposit) > nearToYocto('5')) throw new HttpError(400, 'NEAR sends are capped at 5 NEAR on testnet.');
      continue;
    }
    if (BigInt(a.gas) > 50n * TGAS) throw new HttpError(400, 'Too much gas.');
    if (d.receiverId === VERIFIER && a.method === 'add_public_key' && a.deposit === ONE_YOCTO && d.actions.length === 1) continue;
    if (d.receiverId === USDC && a.method === 'storage_deposit' && a.deposit === USDC_STORAGE && a.args.registration_only === true && validAccountId(String(a.args.account_id))) continue;
    if (d.receiverId === USDC && a.method === 'ft_transfer' && a.deposit === ONE_YOCTO && validAccountId(String(a.args.receiver_id)) && /^\d+$/.test(String(a.args.amount))) {
      usd += Number(fromUnits(BigInt(String(a.args.amount)), USDC_DECIMALS));
      continue;
    }
    throw new HttpError(403, `The relayer does not pay for ${d.receiverId}.${a.method}.`);
  }
  return usd;
}

export function toDelegate(d: DelegateJson) {
  const actions: Action[] = d.actions.map((a) => a.type === 'transfer'
    ? actionCreators.transfer(BigInt(a.deposit))
    : actionCreators.functionCall(a.method, Buffer.from(JSON.stringify(a.args)), BigInt(a.gas), BigInt(a.deposit)));
  return buildDelegateAction({ senderId: d.senderId, receiverId: d.receiverId, nonce: BigInt(d.nonce), maxBlockHeight: BigInt(d.maxBlockHeight), publicKey: PublicKey.fromString(d.publicKey), actions });
}

export async function relay(d: DelegateJson, ip: string) {
  const usd = delegatePolicy(d);
  const da = toDelegate(d);
  const sig = bs58.decode(d.signature.replace(/^ed25519:/, ''));
  const pub = bs58.decode(d.publicKey.replace(/^ed25519:/, ''));
  if (!ed25519.verify(sig, sha256(encodeDelegateAction(da)), pub)) throw new HttpError(400, 'Bad signature on the meta transaction.');
  await assertKeyOf(d.senderId, d.publicKey);
  await limit('relay:' + d.senderId, 60, 3600);
  await limit('relayip:' + ip, 120, 3600);
  if (usd) await spend(d.senderId, usd);
  const signedDelegate = new SignedDelegate({ delegateAction: da, signature: new Signature({ keyType: 0, data: sig }) });
  const r = await signAndSend(RELAYER, need('RELAYER'), d.senderId, [actionCreators.signedDelegate(signedDelegate)]);
  if (!r.ok) throw new HttpError(400, 'The network rejected it: ' + r.failures.join('; ').slice(0, 300));
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

export async function chainInfo() {
  const [st, block] = await Promise.all([viewAccount(VERIFIER), rpc<{ header: { height: number } }>('block', { finality: 'final' })]);
  return { verifier: VERIFIER, verifierCodeHash: st?.code_hash ?? null, block: block.header.height };
}
