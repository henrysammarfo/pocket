import 'server-only';
// Public receipts, rebuilt from the chain. No database needed: every number on a receipt
// comes from the transaction itself (signed intents, memo with price and source, logs).
import { rpc } from '../shared/rpc';
import { RELAYER, ROOT, USDC, USDC_DECIMALS, VERIFIER, tokenByAsset, MAKER, FAUCET } from '../shared/deployment';
import { parseMessage } from '../shared/intents';
import { fromUnits } from '../shared/units';
import { summarize } from './tx';
import { HttpError } from './store';

export type Receipt = {
  hash: string; ok: boolean; at: number | null; kind: 'send' | 'buy' | 'sell' | 'faucet' | 'signup' | 'other';
  token?: string; amount?: string; from?: string; to?: string; memo?: string | null;
  trade?: { side: 'buy' | 'sell'; token: string; qty: string; usd: string; price?: string; mid?: string; spreadBps?: string; source?: string; priceAt?: string; maker: string };
  gasPaidBy: string; via: string; failures: string[];
};

const b64json = (s: string) => { try { return JSON.parse(Buffer.from(s, 'base64').toString('utf8')); } catch { return null; } };

export async function receipt(hash: string): Promise<Receipt> {
  if (!/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(hash)) throw new HttpError(400, 'Bad transaction id');
  let raw: any = null; let sender = RELAYER;
  for (const s of [RELAYER, ROOT]) {
    try { raw = await rpc('tx', { tx_hash: hash, sender_account_id: s, wait_until: 'EXECUTED_OPTIMISTIC' }); sender = s; break; } catch { /* try next */ }
  }
  if (!raw) throw new HttpError(404, 'Pocket did not send this transaction, or it is not final yet.');
  const sum = summarize(raw, hash);
  const blk = await rpc<{ header: { timestamp_nanosec: string } }>('block', { block_id: raw.transaction_outcome.block_hash }).catch(() => null);
  const at = blk ? Math.floor(Number(BigInt(blk.header.timestamp_nanosec) / 1000000n)) : null;
  const base = { hash, ok: sum.ok, at, gasPaidBy: sender, failures: sum.failures };
  const actions = raw.transaction.actions as any[];
  // Sponsor created an account
  if (sender === ROOT && actions.some((a) => a === 'CreateAccount' || a?.CreateAccount !== undefined)) return { ...base, kind: 'signup', to: raw.transaction.receiver_id, via: 'Account created by the Pocket sponsor' };
  for (const a of actions) {
    const fc = a.FunctionCall;
    if (fc && raw.transaction.receiver_id === VERIFIER && fc.method_name === 'execute_intents') {
      const args = b64json(fc.args);
      const msgs = (args?.signed || []).map((s: any) => parseMessage(s?.payload?.message || '')).filter(Boolean);
      const user = msgs.find((m: any) => m.signer_id !== MAKER && m.signer_id !== FAUCET);
      const maker = msgs.find((m: any) => m.signer_id === MAKER);
      const faucet = msgs.find((m: any) => m.signer_id === FAUCET);
      if (maker && user) {
        const ud = user.intents[0].diff as Record<string, string>;
        const memo: string = maker.intents[0].memo || '';
        const g = (re: RegExp) => memo.match(re)?.[1];
        const kv = { price: g(/ price (\S+)/), mid: g(/ mid (\S+)/), spread_bps: g(/ spread_bps (\S+)/), source: g(/ source (.+?) at \S+$/), at: g(/ at (\S+)$/) };
        const entries = Object.entries(ud);
        const pay = entries.find(([, v]) => v.startsWith('-'))!, get = entries.find(([, v]) => !v.startsWith('-'))!;
        const pt = tokenByAsset(pay[0])!, gt = tokenByAsset(get[0])!;
        const side = pt.symbol === 'pUSD' ? 'buy' : 'sell';
        const stockT = side === 'buy' ? gt : pt;
        const qty = fromUnits(side === 'buy' ? get[1] : pay[1].slice(1), stockT.decimals, 8);
        const usd = fromUnits(side === 'buy' ? pay[1].slice(1) : get[1], 6, 2);
        return { ...base, kind: side, from: user.signer_id, trade: { side, token: stockT.symbol, qty, usd, price: kv.price, mid: kv.mid, spreadBps: kv.spread_bps, source: kv.source, priceAt: kv.at, maker: MAKER }, via: 'NEAR Intents verifier, one atomic execute_intents' };
      }
      const m = faucet || user;
      const t = m?.intents?.[0];
      if (t?.intent === 'transfer') {
        const [asset, amt] = Object.entries(t.tokens as Record<string, string>)[0];
        const tok = tokenByAsset(asset);
        return { ...base, kind: faucet ? 'faucet' : 'send', token: tok?.symbol || asset, amount: fromUnits(amt, tok?.decimals ?? 0, 8), from: m.signer_id, to: t.receiver_id, memo: t.memo || null, via: 'NEAR Intents verifier, signed transfer intent' };
      }
    }
    const dl = a.Delegate;
    if (dl) {
      const d = dl.delegate_action;
      for (const ia of d.actions) {
        const f = ia.FunctionCall;
        if (f && d.receiver_id === USDC && f.method_name === 'ft_transfer') {
          const x = b64json(f.args);
          return { ...base, kind: 'send', token: 'USDC', amount: fromUnits(x.amount, USDC_DECIMALS), from: d.sender_id, to: x.receiver_id, memo: x.memo || null, via: 'NEP-366 meta transaction, ft_transfer on Circle USDC' };
        }
        if (ia.Transfer) return { ...base, kind: 'send', token: 'NEAR', amount: fromUnits(ia.Transfer.deposit, 24, 5), from: d.sender_id, to: d.receiver_id, via: 'NEP-366 meta transaction, NEAR transfer' };
        if (f && f.method_name === 'add_public_key') return { ...base, kind: 'other', from: d.sender_id, to: d.receiver_id, memo: 'Device key registered in the NEAR Intents verifier', via: 'NEP-366 meta transaction' };
      }
    }
  }
  return { ...base, kind: 'other', via: raw.transaction.receiver_id };
}
