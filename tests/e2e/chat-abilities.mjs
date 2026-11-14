// Chat abilities in a real browser: today's date, live web news, product finds with real links,
// a receipt photo read by the vision model and turned into a split plan, and the chats drawer
// (new, rename, delete). Usage: BASE=https://... SHOTS=dir node tests/e2e/chat-abilities.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const BASE = (process.env.BASE || 'http://localhost:3100').replace(/\/$/, '');
const SHOTS = process.env.SHOTS || 'shots/abilities'; mkdirSync(SHOTS, { recursive: true });
const fails = []; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m); };
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: 'Africa/Accra' });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const shot = (n) => p.screenshot({ path: `${SHOTS}/${n}.png` });
const wait = (n) => p.waitForFunction((n) => document.querySelectorAll('.thread .ai').length > n && !document.querySelector('[aria-label="Pocket is thinking"]'), n, { timeout: 90000 });
const say = async (t) => { const n = await p.locator('.thread .ai').count(); await p.fill('textarea[aria-label="Message Pocket"]', t); await p.keyboard.press('Enter'); await wait(n); await p.waitForTimeout(400); return (await p.locator('.thread .ai').last().innerText()).trim().replace(/\n/g, ' '); };
const step = async (name, fn) => { try { await fn(); } catch (e) { ok(false, `${name}: ${String(e.message).split('\n')[0]}`); await shot('error-' + name.replace(/\W+/g, '-')).catch(() => {}); } };
try {
  await p.goto(BASE + '/welcome'); const u = 'ab' + Date.now().toString(36).slice(-6);
  await p.fill('input[aria-label="Pick a username"]', u); await p.fill('input[aria-label="Your first name"]', 'Kofi');
  await p.click('button:has-text("Create my Pocket")'); await p.waitForURL('**/chat', { timeout: 120000 }); await p.waitForTimeout(1500);
  await step('date', async () => { const r = await say('what is the date and time today?'); const d = new Date(); const mon = d.toLocaleString('en-GB', { month: 'long', timeZone: 'Africa/Accra' }); ok(r.includes(String(d.getUTCFullYear())) && r.includes(mon), 'date: ' + r.slice(0, 120)); });
  await step('news', async () => { const r = await say('what is in the world news today?'); const src = await p.locator('.thread .srcs a').count(); ok(r.length > 30 && src > 0, `news (${src} sources): ` + r.slice(0, 140)); await shot('01-news'); });
  await p.waitForTimeout(Number(process.env.SEARCH_GAP_MS || 62000)); // free tier search budget is per minute
  await step('product', async () => { const r = await say('find me JBL Tune 520BT headphones to buy'); const n = await p.locator('.thread .prod').count(); const hrefs = await p.locator('.thread .prod').evaluateAll((a) => a.map((x) => x.href)); const imgs = await p.locator('.thread .prod img').count(); ok(n > 0 && hrefs.every((h) => /^https:\/\//.test(h) && !/XXXX|YYYY/.test(h)), `products ${n}, images ${imgs}: ${hrefs.join(' ')} | ` + r.slice(0, 100)); await p.locator('.thread .prod').last().scrollIntoViewIfNeeded().catch(() => {}); await shot('02-products'); });
  await step('price', async () => { const r = await say('what is the price of Tesla stock token right now?'); ok(/\$\s?\d/.test(r), 'live price: ' + r.slice(0, 120)); });
  await step('photo', async () => {
    const n = await p.locator('.thread .ai').count();
    await p.setInputFiles('input[type=file]', 'tests/e2e/fixtures/receipt.png'); await p.locator('.cphoto').waitFor({ timeout: 10000 }); await shot('03-photo-ready');
    await p.fill('textarea[aria-label="Message Pocket"]', 'this is our dinner bill. what is the total?'); await p.keyboard.press('Enter'); await wait(n);
    const r = (await p.locator('.thread .ai').last().innerText()).replace(/\n/g, ' '); ok(/23/.test(r), 'receipt read: ' + r.slice(0, 140)); await shot('04-photo-read');
    const r2 = await say('split it with @admin, send them half'); const plan = await p.locator('.plan').count(); ok(plan > 0 || /11\.5/.test(r2), 'split: ' + r2.slice(0, 120)); await p.locator('.plan').last().scrollIntoViewIfNeeded().catch(() => {}); await shot('05-split-plan');
  });
  await step('drawer', async () => {
    await p.click('button[aria-label="Chats"]'); await p.waitForTimeout(600); const rows = await p.locator('.tp-row').count(); ok(rows >= 1, 'drawer lists chats: ' + rows); await shot('06-drawer');
    await p.click('.tp-new'); await p.waitForTimeout(400); ok((await p.locator('.thread .me').count()) === 0, 'new chat is empty');
    await say('hello there'); await p.click('button[aria-label="Chats"]'); await p.waitForTimeout(500);
    ok((await p.locator('.tp-row').count()) >= 2, 'two chats listed');
    await p.locator('.tp-row').first().locator('button[aria-label^="Rename"]').click(); await p.fill('input[aria-label="Chat name"]', 'Greetings'); await p.keyboard.press('Enter');
    ok(await p.locator('.tp-t:has-text("Greetings")').count() === 1, 'renamed'); await shot('07-renamed');
    await p.locator('.tp-row').first().locator('button[aria-label^="Delete"]').click(); await p.click('.tp-del .danger'); await p.waitForTimeout(400);
    ok(await p.locator('.tp-t:has-text("Greetings")').count() === 0, 'deleted');
    const th = await p.evaluate(async () => { const s = JSON.parse(localStorage.getItem('pocket-session')); return 1; }); void th;
    await p.click('button[aria-label="Chats"]'); await p.waitForTimeout(500); await p.locator('.tp-open').first().click(); await p.waitForTimeout(500); ok((await p.locator('.thread .me').count()) > 2, 'reopened the first chat');
  });
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
} finally { await b.close(); }
console.log(fails.length ? `${fails.length} FAILED` : 'ALL PASS'); process.exit(fails.length ? 1 : 0);
