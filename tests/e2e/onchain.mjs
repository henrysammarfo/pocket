// On chain limits branch, real browser against a hosted or local Pocket, fresh profile and account:
// sign up and see the one time recovery key, phone key is a limited key, receiver check on a send,
// hold to send, receipts CSV download, request money link that shows Pending, and a blocked receiver.
// Usage: BASE=https://... SHOTS=dir node tests/e2e/onchain.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const BASE = (process.env.BASE || 'http://localhost:3100').replace(/\/$/, '');
const SHOTS = process.env.SHOTS || 'shots'; fs.mkdirSync(SHOTS, { recursive: true });
const TO = process.env.TO || '';
const u = 'oc' + Date.now().toString(36).slice(-7);
const fails = []; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m); };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const shot = (n) => p.screenshot({ path: `${SHOTS}/onchain-${n}.png` });
const hold = async (sel) => { const el = p.locator(sel + ':not([disabled])').first(); await el.waitFor({ timeout: 60000 }); await p.waitForTimeout(800); await el.scrollIntoViewIfNeeded(); const bb = await el.boundingBox(); await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await p.waitForTimeout(1500); await p.mouse.up(); };
const step = async (name, fn) => { try { await fn(); } catch (e) { ok(false, `${name}: ${String(e.message).split('\n')[0]}`); await shot('error-' + name.replace(/\W+/g, '-')).catch(() => {}); } };
let account = '';
try {
await step('sign up shows the recovery key once', async () => {
  await p.goto(BASE + '/welcome');
  await p.fill('input[aria-label="Pick a username"]', u); await p.fill('input[aria-label="Your first name"]', 'Ama');
  await p.click('button:has-text("Create my Pocket")');
  await p.locator('[data-testid="recovery"]').waitFor({ timeout: 120000 }); await shot('01-recovery');
  const rec = await p.locator('textarea[aria-label="Your recovery key"]').inputValue();
  ok(/ed25519:/.test(rec), 'recovery key shown once on screen (not printed here)');
  ok(await p.locator('button:has-text("Continue")').isDisabled(), 'Continue waits until you tick that you saved it');
  await p.check('input[type=checkbox]'); await p.click('button:has-text("Continue")'); await p.waitForURL('**/chat', { timeout: 30000 });
  const stored = await p.evaluate(() => JSON.stringify({ ...localStorage }));
  ok(!stored.includes(rec.match(/ed25519:[1-9A-HJ-NP-Za-km-z]+/)?.[0] || 'none'), 'the recovery key is not in browser storage');
  account = await p.evaluate(() => { for (const k of Object.keys(localStorage)) { try { const v = JSON.parse(localStorage.getItem(k)); if (v?.account) return v.account; } catch { /* skip */ } } return ''; });
  ok(!!account, 'signed up ' + account);
});
await step('the phone key is a limited key on chain', async () => {
  const pk = await p.evaluate(() => { for (const k of Object.keys(localStorage)) { try { const v = JSON.parse(localStorage.getItem(k)); if (v?.publicKey) return v.publicKey; } catch { /* skip */ } } return ''; });
  const r = await fetch('https://rpc.testnet.fastnear.com', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'query', params: { request_type: 'view_access_key', finality: 'final', account_id: account, public_key: pk } }) }).then((x) => x.json());
  const perm = r.result?.permission;
  ok(perm?.FunctionCall?.receiver_id === account && !perm?.FullAccess, 'browser key permission: FunctionCall on ' + perm?.FunctionCall?.receiver_id + ', methods ' + (perm?.FunctionCall?.method_names || []).join(' '));
});
await step('faucet', async () => {
  await p.goto(BASE + '/wallet'); await p.waitForFunction(() => /1,?000|999/.test(document.querySelector('.pcard')?.textContent || ''), null, { timeout: 90000 });
  ok(true, '1,000 pUSD arrived'); await shot('02-wallet');
});
await step('blocked receiver cannot be paid', async () => {
  const root = account.split('.').slice(1).join('.');
  await p.goto(`${BASE}/send/to?to=${encodeURIComponent('verifier.' + root)}&amt=1`);
  await p.locator('button:has-text("Continue"):not([disabled])').click({ timeout: 60000 });
  await p.locator('[aria-label="Receiver check"]').waitFor({ timeout: 30000 }); await shot('03-blocked');
  ok(/blocked this receiver/i.test(await p.locator('[aria-label="Receiver check"]').innerText()), 'send screen shows Pocket blocked this receiver, with the reason');
  ok(await p.locator('button.hold').first().isDisabled(), 'hold to send is disabled on a block');
});
await step('send with receiver check and hold', async () => {
  if (!TO) { ok(true, 'skipped send (set TO to a Pocket account)'); return; }
  await p.goto(`${BASE}/send/to?to=${encodeURIComponent(TO)}&amt=2`);
  await p.locator('button:has-text("Continue"):not([disabled])').click({ timeout: 60000 });
  await p.locator('[aria-label="Receiver check"]').waitFor({ timeout: 30000 });
  ok(/not paid this account before/i.test(await p.locator('[aria-label="Receiver check"]').innerText()), 'first time receiver gets a warning with reasons');
  await shot('04-warn'); await hold('button.hold');
  await p.locator('a:has-text("View receipt")').waitFor({ timeout: 90000 }); await shot('05-sent');
  ok(true, 'sent 2 pUSD through the wallet contract, receipt ' + await p.locator('a:has-text("View receipt")').getAttribute('href'));
});
await step('receipts CSV', async () => {
  await p.goto(BASE + '/activity'); await p.waitForTimeout(3000);
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click('button[aria-label="Download receipts as CSV"]')]);
  const path = `${SHOTS}/receipts.csv`; await dl.saveAs(path); const text = fs.readFileSync(path, 'utf8');
  ok(text.startsWith('date_utc,type,asset,amount') && text.split('\r\n').length >= 3, `CSV downloaded as ${dl.suggestedFilename()} with ${text.split('\r\n').length - 2} rows`);
});
await step('request money link', async () => {
  await p.goto(BASE + '/request'); await p.fill('input[aria-label="Amount"]', '12.50'); await p.fill('input[aria-label="What it is for"]', 'lunch');
  await p.click('button:has-text("Make request link")');
  await p.locator('[data-request]').first().waitFor({ timeout: 30000 }); await shot('06-requests');
  ok(/Pending/.test(await p.locator('[data-request]').first().innerText()), 'new request listed as Pending');
  const id = await p.locator('[data-request]').first().getAttribute('data-request');
  await p.goto(`${BASE}/pay/${account.split('.')[0]}?r=${id}`); await p.locator('[aria-label="Money request"]').waitFor({ timeout: 30000 }); await shot('07-pay-link');
  const t = await p.locator('[aria-label="Money request"]').innerText();
  ok(/12\.50/.test(t) && /Pending/.test(t) && /lunch/.test(t), 'pay link shows amount, note and Pending');
});
ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
} finally { await b.close(); }
console.log(fails.length ? `${fails.length} FAILED` : 'ALL PASS');
process.exit(fails.length ? 1 : 0);
