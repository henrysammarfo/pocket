// Private send in a real browser against a hosted Pocket: the proof is made in the page, the relayer submits it.
// Uses an existing wallet v3 account and one unspent note, both read from POCKET_SECRETS_DIR (never printed).
// Usage: BASE=https://... POCKET_SECRETS_DIR=... ACCOUNT=pdemo....testnet NOTES=pool-notes-....json node tests/e2e/private-send.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const BASE = process.env.BASE.replace(/\/$/, '');
const S = process.env.POCKET_SECRETS_DIR;
const ACCOUNT = process.env.ACCOUNT;
const keys = JSON.parse(fs.readFileSync(path.join(S, ACCOUNT + '.keys.json'), 'utf8'));
const notes = JSON.parse(fs.readFileSync(path.join(S, process.env.NOTES), 'utf8'));
const SHOTS = process.env.SHOTS || 'shots/private-send'; fs.mkdirSync(SHOTS, { recursive: true });
const { KeyPair } = await import('near-api-js');
const phone = KeyPair.fromString(keys.phone_private_key);
const session = { account: ACCOUNT, username: ACCOUNT.split('.')[0], secretKey: keys.phone_private_key, publicKey: phone.getPublicKey().toString(), createdAt: Date.now(), onchain: true };
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const RPC = 'https://rpc.testnet.fastnear.com';
const viewPool = async (m, a) => { const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'query', params: { request_type: 'call_function', finality: 'final', account_id: 'pool.pocket-7e2413.testnet', method_name: m, args_base64: Buffer.from(JSON.stringify(a)).toString('base64') } }) }).then((x) => x.json()); return JSON.parse(Buffer.from(r.result.result).toString()); };
const unspent = [];
for (const n of notes) if (!(await viewPool('is_spent', { nullifier_hash: n.nullifierHash }))) unspent.push(n);
const note = unspent[0] || null; // without an unspent note only the Add checks run

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(([s, a, n]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem('pocket-session', JSON.stringify(s)); localStorage.setItem('pocket.notes.' + a, JSON.stringify(n ? [n] : [])); }, [session, ACCOUNT, note]);
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(BASE + '/private');
await p.locator('[data-testid="private-balance"]').waitFor({ timeout: 60000 });
await p.waitForFunction(() => /0\.1 NEAR/.test(document.querySelector('[data-testid="private-balance"]')?.textContent || ''), null, { timeout: 60000 }).catch(() => {});
const bal = await p.locator('[data-testid="private-balance"]').innerText();
if (note) ok(/0\.1 NEAR/.test(bal), 'private balance shows the note: ' + bal);
await p.screenshot({ path: SHOTS + '/1-balance.png' });

// Hide is on for a v3 wallet. If the wallet already used its 0.2 NEAR day the chain refuses with the limit reason;
// otherwise the 0.1 NEAR is hidden and becomes the note the send below uses.
const add = p.locator('button:has-text("Hide 0.1 NEAR")');
await p.waitForFunction(() => { const b = [...document.querySelectorAll('button')].find((x) => /Hide 0\.1 NEAR/.test(x.textContent || '')); return b && !b.disabled; }, null, { timeout: 30000 }).catch(() => {});
ok(!(await add.isDisabled()), 'Hide 0.1 NEAR is on for a v3 wallet');
await add.click();
await p.locator('[data-testid="pmsg"]').waitFor({ timeout: 180000 });
const addMsg = await p.locator('[data-testid="pmsg"]').innerText();
const hid = /is now hidden/.test(addMsg);
ok(hid || /limit/i.test(addMsg), (hid ? 'hiding 0.1 NEAR worked: ' : 'hiding over the daily limit is refused with the reason: ') + addMsg.slice(0, 160).replace(/\s+/g, ' '));
await p.screenshot({ path: SHOTS + '/2-hide.png' });

const canSend = !!(note || hid);
{
// The normal Send screen with the Send privately toggle, as a user would do it.
const to = crypto.randomBytes(32).toString('hex');
await p.goto(BASE + `/send/to?to=${to}&amt=0.1&asset=NEAR`);
const cont = p.locator('button:has-text("Continue")');
await Promise.race([cont.waitFor({ timeout: 60000 }), p.locator('[data-testid="send-privately"]').waitFor({ timeout: 60000 })]).catch(() => {});
if (await cont.count()) { await cont.first().click(); }
const tg = p.locator('[data-testid="send-privately"]');
await tg.waitFor({ timeout: 60000 });
await p.waitForFunction(() => !document.querySelector('[data-testid="send-privately"]')?.disabled, null, { timeout: 30000 }).catch(() => {});
ok(!(await tg.isDisabled()), 'Send privately toggle is on the normal Send screen');
await tg.click();
ok((await tg.locator('[role="switch"]').getAttribute('aria-checked')) === 'true', 'Send privately switched on');
await p.screenshot({ path: SHOTS + '/3-review-private.png' });
const t0 = Date.now();
const hb = p.locator('button.hold:not([disabled])').first(); await hb.waitFor({ timeout: 30000 }); await hb.scrollIntoViewIfNeeded();
const bb = await hb.boundingBox(); await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await p.waitForTimeout(2600); await p.mouse.up();
const prog = await p.locator('[data-testid="send-progress"]').innerText({ timeout: 15000 }).catch(() => '');
ok(/privately|ready/i.test(prog), 'friendly progress text while sending: ' + prog);
if (!canSend) {
  // No hidden money and the daily limit is used up: the account itself must refuse, in plain words.
  const t = await p.locator('.toast.err').innerText({ timeout: 180000 }).catch(() => '');
  ok(/limit/i.test(t) && !/panicked|ActionError|\{/.test(t), 'Send privately over the daily limit is refused in plain words: ' + t.slice(0, 160));
  await p.screenshot({ path: SHOTS + '/4-refused.png' });
} else {
await p.locator('text=Sent privately to').waitFor({ timeout: 240000 }).catch(() => {});
const done = await p.locator('body').innerText();
const rec = await p.locator('a:has-text("View receipt")').getAttribute('href').catch(() => null);
ok(/Sent privately to/.test(done) && !!rec, `private send done in ${Math.round((Date.now() - t0) / 1000)} s: ${rec}`);
await p.screenshot({ path: SHOTS + '/4-sent.png' });
const hash = rec ? rec.split('/').pop() : null;
fs.writeFileSync(SHOTS + '/result.json', JSON.stringify({ hash, link: hash ? 'https://testnet.nearblocks.io/txns/' + hash : null, to, at: new Date().toISOString() }, null, 1));
const acct = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'query', params: { request_type: 'view_account', finality: 'final', account_id: to } }) }).then((x) => x.json());
ok(acct.result && BigInt(acct.result.amount) === 10n ** 23n, 'the new account holds exactly 0.1 NEAR from the private fund');
}
}
ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));

await b.close();
console.log(fails ? `${fails} FAIL` : 'ALL PASS');
process.exit(fails ? 1 : 0);
