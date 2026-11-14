// `npm run judge`: end to end check on NEAR testnet with your own keys (.env.local).
// Creates a user, registers its key in the verifier with a gasless NEP-366 meta tx, claims faucet pUSD,
// buys and sells TSLAon at a live price, sends pUSD, and rebuilds every receipt from the chain.
import { newKey, signNep413 } from '../src/lib/shared/nep413';
import { buildPayload } from '../src/lib/shared/intents';
import { VERIFIER, PUSD, MAKER, txUrl } from '../src/lib/shared/deployment';
import { createAccount, relay, faucet, quote, settle, submitTransfer, balances, type DelegateJson } from '../src/lib/server/pool';
import { buildDelegateAction, encodeDelegateAction, actionCreators } from '@near-js/transactions';
import { PublicKey } from '@near-js/crypto';
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import bs58 from 'bs58';
import { viewAccessKey, latestBlock } from '../src/lib/shared/rpc';
import { toUnits } from '../src/lib/shared/units';
import { receipt } from '../src/lib/server/receipt';
const ok = (c: unknown, m: string) => { if (!c) { console.error('FAIL:', m); process.exit(1); } console.log('  ok', m); };

const k = newKey();
const u = 'ft' + Date.now().toString(36);
console.log('user', u);
const c = await createAccount(u, k.publicKey, '127.0.0.1');
console.log('created', c);
await new Promise((r) => setTimeout(r, 2000));
const ak = await viewAccessKey(c.account, k.publicKey);
const blk = await latestBlock();
const d: Omit<DelegateJson, 'signature'> = { senderId: c.account, receiverId: VERIFIER, nonce: String(BigInt(ak!.nonce) + 1n), maxBlockHeight: String(blk.header.height + 120), publicKey: k.publicKey, actions: [{ type: 'functionCall', method: 'add_public_key', args: { public_key: k.publicKey }, gas: String(30n * 10n ** 12n), deposit: '1' }] };
const da = buildDelegateAction({ senderId: d.senderId, receiverId: d.receiverId, nonce: BigInt(d.nonce), maxBlockHeight: BigInt(d.maxBlockHeight), publicKey: PublicKey.fromString(d.publicKey), actions: [actionCreators.functionCall('add_public_key', Buffer.from(JSON.stringify({ public_key: k.publicKey })), 30n * 10n ** 12n, 1n)] });
const sig = ed25519.sign(sha256(encodeDelegateAction(da)), k.seed);
const rl = await relay({ ...d, signature: 'ed25519:' + bs58.encode(sig) }, '127.0.0.1');
ok(rl.hash, 'gasless add_public_key via relayer ' + txUrl(rl.hash));
const f = await faucet(c.account, '127.0.0.1'); ok(f.hash, 'faucet 1000 pUSD ' + txUrl(f.hash));
const q = await quote(c.account, 'buy', 'TSLA', { usd: 25 });
console.log('quote', q.quote.price, q.quote.getUnits);
const { payload } = buildPayload(c.account, VERIFIER, [{ intent: 'token_diff', diff: { [q.quote.payAsset]: '-' + q.quote.payUnits, [q.quote.getAsset]: q.quote.getUnits } }], 60);
const st = await settle(q.quote, q.mac, signNep413(payload, k.seed), '127.0.0.1'); ok(st.hash, `bought ${st.qty} TSLAon at $${st.price} ` + txUrl(st.hash));
const t = buildPayload(c.account, VERIFIER, [{ intent: 'transfer', receiver_id: MAKER, tokens: { [PUSD.assetId]: toUnits('5', 6).toString() }, memo: 'test send' }], 300);
const sd = await submitTransfer(signNep413(t.payload, k.seed), '127.0.0.1'); ok(sd.hash, 'sent 5 pUSD ' + txUrl(sd.hash));
const sq = await quote(c.account, 'sell', 'TSLA', { usd: 10 });
const sp = buildPayload(c.account, VERIFIER, [{ intent: 'token_diff', diff: { [sq.quote.payAsset]: '-' + sq.quote.payUnits, [sq.quote.getAsset]: sq.quote.getUnits } }], 60);
const ss = await settle(sq.quote, sq.mac, signNep413(sp.payload, k.seed), '127.0.0.1'); ok(ss.hash, 'sold $10 of TSLAon ' + txUrl(ss.hash));
await new Promise((r) => setTimeout(r, 3000));
const rb = await receipt(st.hash); ok(rb.ok && rb.kind === 'buy' && rb.trade?.price, 'buy receipt rebuilt from chain with price ' + rb.trade?.price);
const rs = await receipt(sd.hash); ok(rs.ok && rs.kind === 'send' && rs.amount === '5', 'send receipt rebuilt from chain');
const b = await balances(c.account);
ok(Number(b.pool.pUSD) > 970 && Number(b.pool.pUSD) < 1000, `balances pUSD ${b.pool.pUSD}, TSLAon ${b.pool.TSLAon}`);
console.log('\nPASS: Pocket works end to end on NEAR testnet for', c.account);
