// `npm run test:v2live`: wallet v2 live on NEAR testnet, on one demo account that runs the v2 code
// directly (the global v2 deploy needs about 22 testnet NEAR, which the faucet has not given yet).
// The account is created, the code deployed and initialised in ONE transaction from the Pocket root,
// with a phone key only: no full access key ever exists on it. Then every v2 rule is tried for real.
import fs from 'node:fs';
import { createTransaction, encodeTransaction, Signature, SignedTransaction, buildDelegateAction, encodeDelegateAction, actionCreators, type Action } from '@near-js/transactions';
import { PublicKey } from '@near-js/crypto';
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import bs58 from 'bs58';
import { newKey, keyFromString, b64encode } from '../../src/lib/shared/nep413';
import { MARKET, PUSD, QUOTE_KEY, ROOT, USDC, VERIFIER, txUrl } from '../../src/lib/shared/deployment';
import { faucet, priceAttest, relay, submitOwner, type DelegateJson } from '../../src/lib/server/pool';
import { DEVICE_ALLOWANCE, DEVICE_METHODS, DOLLAR_TOKENS, OWNER_TAG, PRICE_TAG, SEND_GAS, defaultLimits, ownerPayload, signTagged, type Limits, type OwnerAction } from '../../src/lib/shared/wallet';
import { rpc, view, viewAccessKey, latestBlock } from '../../src/lib/shared/rpc';
import { summarize, signAndSend } from '../../src/lib/server/tx';

let pass = 0, fail = 0; let lastHash = ''; let lastErr = '';
const rows: string[] = [];
const ok = (c: unknown, m: string) => { const link = lastHash ? ' ' + txUrl(lastHash) : ''; lastHash = ''; const line = (c ? 'ok   ' : 'FAIL ') + m + link; rows.push(line); console.log('  ' + line); if (c) pass++; else { fail++; console.log('     last error:', lastErr.slice(0, 300)); } };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const USD = 1_000_000n; const NEAR = 10n ** 24n;
type K = { secretKey: string; publicKey: string };
const PAYEE = process.env.PAYEE || `elimwhewiff.${ROOT}`;
let ipN = 0; const ip = () => `10.9.0.${++ipN}`;

async function direct(signer: string, k: K, actions: Action[]) {
  for (let i = 0; ; i++) {
    const ak = await viewAccessKey(signer, k.publicKey); if (!ak) return { ok: false, err: 'no access key' };
    const blk = await latestBlock();
    const tx = createTransaction(signer, PublicKey.fromString(k.publicKey), signer, BigInt(ak.nonce) + 1n, actions, bs58.decode(blk.header.hash));
    const digest = sha256(encodeTransaction(tx)); const hash = bs58.encode(digest);
    const st = new SignedTransaction({ transaction: tx, signature: new Signature({ keyType: 0, data: ed25519.sign(digest, keyFromString(k.secretKey).seed) }) });
    try {
      const s = summarize(await rpc('send_tx', { signed_tx_base64: b64encode(st.encode()), wait_until: 'EXECUTED_OPTIMISTIC' }), hash);
      lastHash = hash; lastErr = s.failures.join(' ');
      return { ok: s.ok, err: lastErr };
    } catch (e) { lastErr = String((e as Error).message); if (i < 3 && /InvalidNonce/.test(lastErr)) { await sleep(1500); continue; } return { ok: false, err: lastErr }; }
  }
}
const call = (m: string, args: object) => actionCreators.functionCall(m, Buffer.from(JSON.stringify(args)), SEND_GAS, 0n);
async function delegate(account: string, k: K, method: string, args: object): Promise<DelegateJson> {
  const [ak, blk] = await Promise.all([viewAccessKey(account, k.publicKey), latestBlock()]);
  const actions = [{ type: 'functionCall' as const, method, args, gas: SEND_GAS.toString(), deposit: '0' }];
  const d = { senderId: account, receiverId: account, nonce: String(BigInt(ak!.nonce) + 1n), maxBlockHeight: String(blk.header.height + 120), publicKey: k.publicKey, actions };
  const da = buildDelegateAction({ senderId: account, receiverId: account, nonce: BigInt(d.nonce), maxBlockHeight: BigInt(d.maxBlockHeight), publicKey: PublicKey.fromString(k.publicKey), actions: [actionCreators.functionCall(method, Buffer.from(JSON.stringify(args)), SEND_GAS, 0n)] });
  return { ...d, signature: 'ed25519:' + bs58.encode(ed25519.sign(sha256(encodeDelegateAction(da)), keyFromString(k.secretKey).seed)) } as DelegateJson;
}
async function relayed(account: string, k: K, method: string, args: object) { try { const r = await relay(await delegate(account, k, method, args), ip()); lastHash = r.hash; return { ok: true, err: '' }; } catch (e) { lastErr = (e as Error).message; return { ok: false, err: lastErr }; } }
const nonceOf = async (a: string) => (await view<{ owner_nonce: number }>(a, 'get_config')).owner_nonce;
async function owner(a: string, k: K, action: OwnerAction, nonce?: number) {
  lastErr = '';
  const payload = ownerPayload(a, nonce ?? (await nonceOf(a)) + 1, action);
  try { const r = await submitOwner(a, payload, k.publicKey, signTagged(OWNER_TAG, payload, keyFromString(k.secretKey).seed), ip()); lastHash = r.hash; return { ok: true, err: '', payload }; }
  catch (e) { lastErr = (e as Error).message; return { ok: false, err: lastErr, payload }; }
}

console.log('Pocket wallet v2, live testnet checks');
const wasm = fs.readFileSync(new URL('../../vendor/pocket_wallet.wasm', import.meta.url));
const relayerId = `relayer.${ROOT}`;
const free = async (a: string) => { const r = await rpc('query', { request_type: 'view_account', finality: 'final', account_id: a }); return BigInt(r.amount) - BigInt(r.storage_usage) * 10n ** 19n; };
if ((await free(ROOT)) < 25n * NEAR / 10n) {
  console.log('   moving 1.6 testnet NEAR from Pocket relayer to Pocket root to pay for the demo account');
  await signAndSend(relayerId, process.env.RELAYER_PRIVATE_KEY!, ROOT, [actionCreators.transfer(16n * NEAR / 10n)]);
}
const phone = newKey(), rec = newKey();
const id = `vtwo${Date.now().toString(36)}.${ROOT}`;
// Keep the demo keys outside the repo (mode 600) so a crashed run can be inspected; never printed.
const SECRETS = process.env.SECRETS_DIR || new URL('../../../.secrets-onchain/', import.meta.url).pathname;
const saveKeys = (extra: Record<string, K> = {}) => { try { fs.mkdirSync(SECRETS, { recursive: true, mode: 0o700 }); fs.writeFileSync(`${SECRETS}/v2live-${id}.json`, JSON.stringify({ id, phone, rec, ...extra }), { mode: 0o600 }); } catch { /* optional */ } };
saveKeys();
const c = await signAndSend(ROOT, process.env.SPONSOR_PRIVATE_KEY!, id, [
  actionCreators.createAccount(), actionCreators.transfer(235n * NEAR / 100n), actionCreators.deployContract(wasm),
  actionCreators.addKey(PublicKey.fromString(phone.publicKey), actionCreators.functionCallAccessKey(id, [...DEVICE_METHODS], BigInt(DEVICE_ALLOWANCE))),
  actionCreators.functionCall('new', Buffer.from(JSON.stringify({ owner_keys: [rec.publicKey], verifier: VERIFIER, usdc: USDC, maker: MARKET, dollar_tokens: DOLLAR_TOKENS, limits: defaultLimits(), price_key: QUOTE_KEY })), 50n * 10n ** 12n, 0n),
]);
lastHash = c.hash; lastErr = c.failures.join(' ');
ok(c.ok, `create, deploy v2 code and initialise ${id} in one transaction`);
if (!c.ok) process.exit(1);
await sleep(1500); await faucet(id, ip()); await sleep(1500);

console.log('\n1. keys');
const keys = (await rpc('query', { request_type: 'view_access_key_list', finality: 'final', account_id: id })).keys as { public_key: string; access_key: { permission: unknown } }[];
ok(keys.length === 1 && keys[0].public_key === phone.publicKey && keys.every((k) => k.access_key.permission !== 'FullAccess'), `no full access key on the account: ${keys.length} key, the phone's function call key`);
ok(!(await viewAccessKey(id, rec.publicKey)) && keys.every((k) => k.public_key !== rec.publicKey), 'the recovery key is not an access key at all; the contract lists it as an owner key');
ok(JSON.stringify((await view<{ owner_keys: string[] }>(id, 'get_config')).owner_keys) === JSON.stringify([rec.publicKey]), 'get_config shows the recovery key as the owner key');

console.log('\n2. owner messages through the relayer (signer check that survives relaying)');
const L0 = await view<Limits>(id, 'get_limits');
const stricter = { ...L0, usd_per_send: (50n * USD).toString() };
const o1 = await owner(id, rec, { set_limits: { limits: stricter } });
ok(o1.ok && (await view<Limits>(id, 'get_limits')).usd_per_send === (50n * USD).toString(), 'recovery key signs a stricter rule, Pocket relays it, applied at once ($50 a send)');
const nowNonce = await nonceOf(id);
const rp = await (async () => { try { await submitOwner(id, o1.payload, rec.publicKey, signTagged(OWNER_TAG, o1.payload, keyFromString(rec.secretKey).seed), ip()); return true; } catch (e) { lastErr = (e as Error).message; return false; } })();
ok(!rp, 'the same signed owner message sent again is refused (nonce): ' + lastErr.slice(0, 80));
const replayChain = await direct(id, phone, [call('owner_action', { payload: o1.payload, public_key: rec.publicKey, signature: signTagged(OWNER_TAG, o1.payload, keyFromString(rec.secretKey).seed) })]);
ok(!replayChain.ok && /out of order|nonce/i.test(replayChain.err), 'replayed straight to the chain with the phone key (Pocket skipped), the contract refuses it: nonce');
const thief = newKey();
const forged = ownerPayload(id, nowNonce + 1, { set_limits: { limits: { ...L0, usd_per_send: (5000n * USD).toString(), usd_per_day: (5000n * USD).toString() } } });
const fz = await direct(id, phone, [call('owner_action', { payload: forged, public_key: thief.publicKey, signature: signTagged(OWNER_TAG, forged, keyFromString(thief.secretKey).seed) })]);
ok(!fz.ok && /owner/i.test(fz.err), 'a raise signed by a key that is not an owner key is refused on chain');
const phoneSigned = await direct(id, phone, [call('owner_action', { payload: forged, public_key: rec.publicKey, signature: signTagged(OWNER_TAG, forged, keyFromString(phone.secretKey).seed) })]);
ok(!phoneSigned.ok && /signature/i.test(phoneSigned.err), "the phone key cannot pass off its own signature as the recovery key's");
const raise = await owner(id, rec, { set_limits: { limits: { ...stricter, usd_per_send: (150n * USD).toString(), usd_per_day: (300n * USD).toString() } } });
const pend = await view<unknown>(id, 'get_pending');
ok(raise.ok && !!pend && (await view<Limits>(id, 'get_limits')).usd_per_send === (50n * USD).toString(), 'a raise signed by the recovery key waits for the 24 hour delay instead of applying');
const cx = await relayed(id, phone, 'cancel_pending', {});
ok(cx.ok && !(await view<unknown>(id, 'get_pending')), 'the phone key cancels the pending raise during the wait');

console.log('\n3. dollar caps on NEAR with a Pocket signed price');
const noPrice = await direct(id, phone, [call('send_near', { receiver_id: PAYEE, amount: (NEAR / 100n).toString() })]);
ok(!noPrice.ok && /price/i.test(noPrice.err), 'a NEAR send with no signed price is refused');
const fakeP = JSON.stringify({ v: 1, token: 'near', micro_usd: '1', decimals: 24, expires_ms: Date.now() + 60000 });
const fake = await direct(id, phone, [call('send_near', { receiver_id: PAYEE, amount: (NEAR / 100n).toString(), price: { payload: fakeP, signature: signTagged(PRICE_TAG, fakeP, keyFromString(thief.secretKey).seed) } })]);
ok(!fake.ok && /signed by Pocket/i.test(fake.err), 'a price of $0.000001 signed by someone else is refused');
const p = await priceAttest('near');
const staleP = JSON.stringify({ ...JSON.parse(p.payload), expires_ms: Date.now() - 1000 });
const stale = await direct(id, phone, [call('send_near', { receiver_id: PAYEE, amount: (NEAR / 100n).toString(), price: { payload: staleP, signature: signTagged(PRICE_TAG, staleP, keyFromString(process.env.QUOTE_PRIVATE_KEY!).seed) } })]);
ok(!stale.ok && /expired|old|stale/i.test(stale.err), 'an expired price, even one Pocket signed, is refused');
const good = await relayed(id, phone, 'send_near', { receiver_id: PAYEE, amount: (NEAR / 100n).toString(), price: { payload: p.payload, signature: p.signature } });
const sp = await view<{ usd: string }>(id, 'get_spent');
ok(good.ok && BigInt(sp.usd) > 0n, `0.01 NEAR at the signed price $${p.usd} goes through and counts $${(Number(sp.usd) / 1e6).toFixed(4)} against the dollar day`);
const tiny = await owner(id, rec, { set_limits: { limits: { ...(await view<Limits>(id, 'get_limits')), usd_per_send: '10000' } } });
const p2 = await priceAttest('near');
const over = await direct(id, phone, [call('send_near', { receiver_id: PAYEE, amount: (NEAR / 100n).toString(), price: { payload: p2.payload, signature: p2.signature } })]);
ok(tiny.ok && !over.ok && /cap|limit|per send/i.test(over.err), 'after the owner lowers the dollar cap to $0.01 a send, the same 0.01 NEAR send is refused in dollars');

console.log('\n4. restore and lost phone');
const phone2 = newKey(); saveKeys({ phone2 });
const add = await owner(id, rec, { add_device_key: { public_key: phone2.publicKey } });
await sleep(2000);
const k2 = await viewAccessKey(id, phone2.publicKey) as { permission: { FunctionCall?: { receiver_id: string; method_names: string[] } } } | null;
ok(add.ok && k2?.permission?.FunctionCall?.receiver_id === id && JSON.stringify(k2.permission.FunctionCall.method_names) === JSON.stringify(DEVICE_METHODS), 'the recovery key adds a new phone key, limited to the device methods');
const rm = await owner(id, rec, { remove_key: { public_key: phone.publicKey } });
await sleep(2000);
ok(rm.ok && !(await viewAccessKey(id, phone.publicKey)), 'the recovery key removes the lost phone key at once');
const lost = await direct(id, phone, [call('send_token', { token_id: PUSD.assetId, receiver_id: PAYEE, amount: USD.toString() })]);
ok(!lost.ok, 'the removed phone key can no longer send');
const guard = newKey();
const g = await owner(id, rec, { set_owner_keys: { owner_keys: [rec.publicKey, guard.publicKey] } });
ok(g.ok && !!(await view<unknown>(id, 'get_pending')) && (await view<{ owner_keys: string[] }>(id, 'get_config')).owner_keys.length === 1, 'adding a guardian owner key waits for the delay, so a stolen recovery key cannot swap owners at once');
const cx2 = await relayed(id, phone2, 'cancel_pending', {});
ok(cx2.ok && !(await view<unknown>(id, 'get_pending')), 'the phone can cancel an owner key change during the wait');
const blocked = await direct(id, phone2, [call('send_token', { token_id: PUSD.assetId, receiver_id: `drainer.${ROOT}`, amount: USD.toString() })]);
ok(!blocked.ok && /blocked/.test(blocked.err), 'the shared block list is on chain from the start: a send to the drainer is refused');

console.log(`\n${pass} passed, ${fail} failed`);
fs.writeFileSync(new URL('../../docs/TEST_REPORT.v2live.md', import.meta.url), `# Wallet v2 live testnet checks\n\nRun ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC on \`${id}\` (code sha256 in vendor/pocket_wallet.sha256). ${pass} passed, ${fail} failed.\n\n\`\`\`\n${rows.join('\n')}\n\`\`\`\n`);
process.exit(fail ? 1 : 0);
