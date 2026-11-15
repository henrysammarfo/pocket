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
await ctx.addInitScript(([s, a, n]) => { localStorage.setItem('pocket-session', JSON.stringify(s)); localStorage.setItem('pocket.notes.' + a, JSON.stringify(n ? [n] : [])); }, [session, ACCOUNT, note]);
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(BASE + '/private');
await p.locator('[data-testid="private-balance"]').waitFor({ timeout: 60000 });
await p.waitForFunction(() => /0\.1 NEAR/.test(document.querySelector('[data-testid="private-balance"]')?.textContent || ''), null, { timeout: 60000 }).catch(() => {});
const bal = await p.locator('[data-testid="private-balance"]').innerText();
if (note) ok(/0\.1 NEAR/.test(bal), 'private balance shows the note: ' + bal);
await p.screenshot({ path: SHOTS + '/1-balance.png' });

// Add is on for a v3 wallet; the wallet already used its 0.2 NEAR day, so the chain must refuse.
const add = p.locator('button:has-text("Add 0.1 NEAR")');
await p.waitForFunction(() => { const b = [...document.querySelectorAll('button')].find((x) => /Add 0\.1 NEAR/.test(x.textContent || '')); return b && !b.disabled; }, null, { timeout: 30000 }).catch(() => {});
ok(!(await add.isDisabled()), 'Add to private balance is on for a v3 wallet');
await add.click();
await p.locator('[data-testid="pmsg"]').waitFor({ timeout: 180000 });
const addMsg = await p.locator('[data-testid="pmsg"]').first().innerText();
ok(/24 hour limit|limit/i.test(addMsg), 'adding over the daily cap is refused with the reason: ' + addMsg.slice(0, 160).replace(/\s+/g, ' '));
await p.screenshot({ path: SHOTS + '/2-add-over-cap.png' });

if (note) {
const to = crypto.randomBytes(32).toString('hex');
await p.fill('#pto', to);
const t0 = Date.now();
await p.click('button:has-text("Private send")');
await p.waitForFunction(() => /Sent 0\.1 NEAR privately|refused|Error|error/.test(document.querySelector('[data-testid="pmsg"]')?.textContent || ''), null, { timeout: 180000 }).catch(() => {});
const msg = await p.locator('[role="status"], [role="alert"]').first().innerText();
const link = await p.locator('a:has-text("See it on NearBlocks")').getAttribute('href').catch(() => null);
ok(/Sent 0\.1 NEAR privately/.test(msg) && !!link, `private send done in ${Math.round((Date.now() - t0) / 1000)} s: ${link}`);
await p.screenshot({ path: SHOTS + '/3-sent.png' });
fs.writeFileSync(SHOTS + '/result.json', JSON.stringify({ link, to, at: new Date().toISOString() }, null, 1));
ok(await viewPool('is_spent', { nullifier_hash: note.nullifierHash }), 'the note is spent on chain');
const acct = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'query', params: { request_type: 'view_account', finality: 'final', account_id: to } }) }).then((x) => x.json());
ok(acct.result && BigInt(acct.result.amount) === 10n ** 23n, 'the new account holds exactly 0.1 NEAR from the pool');
}
ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));

await b.close();
console.log(fails ? `${fails} FAIL` : 'ALL PASS');
process.exit(fails ? 1 : 0);
