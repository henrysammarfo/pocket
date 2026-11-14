// Full user journey against a hosted Pocket, fresh browser profile and a fresh testnet account:
// sign up (faucet claim), chat small talk and a plan, a voice note, a send with hold to approve,
// a TSLAon buy, and the receipt. Usage: BASE=https://... W=390 H=844 SHOTS=dir node tests/e2e/hosted.mjs
import { chromium } from '@playwright/test';
const BASE = (process.env.BASE || 'http://localhost:3100').replace(/\/$/, '');
const SHOTS = process.env.SHOTS || 'shots'; const W = Number(process.env.W || 390), H = Number(process.env.H || 844);
const tag = W > 700 ? 'desktop' : 'phone';
const u = (tag === 'phone' ? 'hp' : 'hd') + Date.now().toString(36).slice(-6);
const fails = []; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m); };
const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, permissions: ['microphone'] });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const shot = (n) => p.screenshot({ path: `${SHOTS}/${tag}-${n}.png` });
const hold = async (sel) => { const el = p.locator(sel + ':not([disabled])').first(); await el.waitFor({ timeout: 60000 }); await p.waitForTimeout(800); await el.scrollIntoViewIfNeeded(); const bb = await el.boundingBox(); await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await p.waitForTimeout(1500); await p.mouse.up(); };
const step = async (name, fn) => { try { await fn(); } catch (e) { ok(false, `${name}: ${String(e.message).split('\n')[0]}`); await shot('error-' + name.replace(/\W+/g, '-')).catch(() => {}); } };
try {
await step('sign up', async () => {
  await p.goto(BASE + '/welcome'); await shot('01-welcome');
  await p.fill('input[aria-label="Pick a username"]', u); await p.fill('input[aria-label="Your first name"]', 'Ama');
  await p.click('button:has-text("Create my Pocket")'); await p.waitForURL('**/chat', { timeout: 120000 });
  ok(true, `signed up ${u}.pocketnear.testnet`);
});
await step('faucet', async () => {
  await p.goto(BASE + '/wallet'); await p.waitForFunction(() => /1,?000|999|1\s?000/.test(document.querySelector('.pcard')?.textContent || ''), null, { timeout: 60000 });
  ok(true, 'faucet: 1,000 pUSD arrived at sign up'); await shot('02-wallet-funded');
  await p.click('button:has-text("Add")'); await p.click('button:has-text("Claim 1,000 pUSD")');
  const t = await p.locator('.toast').first().innerText({ timeout: 30000 }).catch(() => '');
  ok(/once|today|already|Added/i.test(t), 'second faucet claim answered: ' + t.slice(0, 90)); await p.keyboard.press('Escape');
});
const say = async (t) => { const n = await p.locator('.thread .ai').count(); await p.fill('textarea[aria-label="Message Pocket"]', t); await p.keyboard.press('Enter'); await p.waitForFunction((n) => document.querySelectorAll('.thread .ai').length > n && !document.querySelector('[aria-label="Pocket is thinking"]'), n, { timeout: 60000 }); await p.waitForTimeout(500); return (await p.locator('.thread .ai').last().innerText()).trim().replace(/\n/g, ' '); };
await step('chat', async () => {
  await p.goto(BASE + '/chat'); await p.waitForTimeout(1500);
  const r = await say('hello, what can you do for me?'); ok(r.length > 10, 'small talk: ' + r.slice(0, 110));
  await shot('03-chat-smalltalk');
});
await step('voice note', async () => {
  const n = await p.locator('[aria-label="Said by voice"]').count();
  await p.setInputFiles('input[type=file]', 'tests/e2e/fixtures/messy-voice.mp3');
  await p.waitForFunction((n) => document.querySelectorAll('[aria-label="Said by voice"]').length > n, n, { timeout: 60000 });
  await p.waitForFunction(() => !document.querySelector('[aria-label="Pocket is thinking"]') && !document.querySelector('[aria-label="Writing down what you said"]'), null, { timeout: 60000 }); await p.waitForTimeout(600);
  ok(true, 'voice note heard as: ' + (await p.locator('.thread .me').last().innerText()).trim().slice(0, 110));
  ok(true, 'Pocket said back: ' + (await p.locator('.thread .ai').last().innerText()).trim().replace(/\n/g, ' ').slice(0, 110));
  await shot('04-chat-voice-note');
  const yes = p.locator('.thread button:has-text("Yes")').last();
  if (await yes.count()) { await yes.click(); await p.locator('.plan').last().waitFor({ timeout: 60000 }); ok(true, 'voice confirm led to a plan card'); }
  await p.locator('.plan').last().scrollIntoViewIfNeeded(); await shot('05-chat-voice-plan');
});
await step('send with hold to approve', async () => {
  await say('send @admin 2 dollars');
  if (!(await p.locator('.plan').count()) || await p.locator('.thread button:has-text("Yes")').count()) { const y = p.locator('.thread button:has-text("Yes")').last(); if (await y.count()) await y.click(); }
  await p.locator('.plan button:has-text("Review and approve")').last().waitFor({ timeout: 60000 });
  await p.locator('.plan button:has-text("Review and approve")').last().click(); await p.waitForURL('**/review**'); await p.waitForTimeout(2000); await shot('06-review');
  await p.locator('.chip.ok:has-text("Checked")').waitFor({ timeout: 60000 });
  await hold('button.hold');
  if (!(await p.locator('a:has-text("See wallet")').waitFor({ timeout: 60000 }).then(() => true).catch(() => false))) { ok(false, 'first hold did not start the send, holding again'); await hold('button.hold'); await p.locator('a:has-text("See wallet")').waitFor({ timeout: 120000 }); }
  await p.waitForTimeout(800);
  ok(true, 'send settled: ' + (await p.locator('.bd').innerText()).replace(/\n/g, ' | ').slice(0, 140)); await shot('07-review-done');
});
await step('TSLAon buy and receipt', async () => {
  await p.goto(BASE + '/invest/TSLA'); await p.waitForTimeout(4000); await shot('08-tesla');
  await p.click('.dock button:has-text("Buy")'); await p.click('.sheet .quick button:has-text("$10")');
  await p.locator('.sheet .cell:has-text("Quote holds")').waitFor({ timeout: 30000 }); await shot('09-buy-sheet');
  await hold('.sheet button.hold'); await p.locator('.sheet a:has-text("See receipt")').waitFor({ timeout: 120000 });
  await p.click('.sheet a:has-text("See receipt")'); await p.waitForURL('**/r/**'); await p.locator('.rhead').waitFor({ timeout: 60000 }); await p.waitForTimeout(800);
  const rc = (await p.locator('.receipt').innerText()).replace(/\n/g, ' | ');
  ok(/TSLAon/.test(rc) && /Completed/.test(rc), 'TSLAon receipt: ' + rc.slice(0, 160)); await shot('10-receipt');
  const nb = await p.locator('a:has-text("NearBlocks")').first().getAttribute('href'); ok(/testnet\.nearblocks\.io/.test(nb || ''), 'NearBlocks link ' + nb);
});
await step('settings', async () => { await p.goto(BASE + '/settings'); await p.locator('.meter').waitFor({ timeout: 20000 }); await p.waitForTimeout(1200); ok(true, 'credits: ' + await p.locator('.credits .ct').innerText()); await shot('11-settings'); });
const ow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(ow <= 0, 'no horizontal overflow');
ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
} finally { await b.close(); }
console.log(fails.length ? `${fails.length} FAILED` : 'ALL PASS'); process.exit(fails.length ? 1 : 0);
