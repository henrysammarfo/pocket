// End to end check on testnet: create a user, register its key in the verifier with a relayed
// meta tx, claim faucet pUSD, buy TSLAon, send pUSD. Run: node --conditions=react-server --env-file=.env.local --import tsx scripts/dev/flow-test.ts
import { newKey, signNep413 } from '../../src/lib/shared/nep413';
import { buildPayload } from '../../src/lib/shared/intents';
import { VERIFIER, PUSD } from '../../src/lib/shared/deployment';
import { createAccount, relay, faucet, quote, settle, submitTransfer, balances, type DelegateJson } from '../../src/lib/server/pool';
import { buildDelegateAction, encodeDelegateAction, actionCreators } from '@near-js/transactions';
import { PublicKey } from '@near-js/crypto';
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import bs58 from 'bs58';
import { viewAccessKey, latestBlock } from '../../src/lib/shared/rpc';
import { toUnits } from '../../src/lib/shared/units';

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
console.log('relay', await relay({ ...d, signature: 'ed25519:' + bs58.encode(sig) }, '127.0.0.1'));
console.log('faucet', await faucet(c.account, '127.0.0.1'));
const q = await quote(c.account, 'buy', 'TSLA', { usd: 25 });
console.log('quote', q.quote.price, q.quote.getUnits);
const { payload } = buildPayload(c.account, VERIFIER, [{ intent: 'token_diff', diff: { [q.quote.payAsset]: '-' + q.quote.payUnits, [q.quote.getAsset]: q.quote.getUnits } }], 60);
console.log('settle', await settle(q.quote, q.mac, signNep413(payload, k.seed), '127.0.0.1'));
const t = buildPayload(c.account, VERIFIER, [{ intent: 'transfer', receiver_id: 'maker.pocketnear.testnet', tokens: { [PUSD.assetId]: toUnits('5', 6).toString() }, memo: 'test send' }], 300);
console.log('send', await submitTransfer(signNep413(t.payload, k.seed), '127.0.0.1'));
console.log('balances', await balances(c.account));
