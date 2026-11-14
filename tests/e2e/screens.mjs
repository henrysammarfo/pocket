// Screenshots of every screen at phone widths for design review. Usage: BASE=https://... OUT=dir WIDTHS=375,390,430 node tests/e2e/screens.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const BASE = (process.env.BASE || 'http://localhost:3100').replace(/\/$/, '');
const OUT = process.env.OUT || 'shots/screens'; mkdirSync(OUT, { recursive: true });
const WIDTHS = (process.env.WIDTHS || '375,390,430').split(',').map(Number);
const ROUTES = (process.env.ROUTES || '/,/welcome,/chat,/wallet,/invest,/invest/TSLA,/send,/swap,/activity,/contacts,/profile,/settings').split(',');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.goto(BASE + '/welcome'); const u = 'sc' + Date.now().toString(36).slice(-6);
for (const w of WIDTHS) { await p.setViewportSize({ width: w, height: 844 }); await p.goto(BASE + '/'); await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/${w}-landing.png`, fullPage: true }); await p.goto(BASE + '/welcome'); await p.waitForTimeout(800); await p.screenshot({ path: `${OUT}/${w}-welcome.png`, fullPage: true }); }
await p.setViewportSize({ width: 390, height: 844 });
await p.fill('input[aria-label="Pick a username"]', u); await p.fill('input[aria-label="Your first name"]', 'Ama');
await p.click('button:has-text("Create my Pocket")'); await p.waitForURL('**/chat', { timeout: 120000 }); await p.waitForTimeout(2000); await p.screenshot({ path: OUT + '/dbg.png' });
await p.fill('textarea[aria-label="Message Pocket"]', 'send @admin 3 dollars'); await p.keyboard.press('Enter');
await p.waitForFunction(() => document.querySelectorAll('.thread .ai').length > 0 && !document.querySelector('[aria-label="Pocket is thinking"]'), null, { timeout: 60000 }).catch(() => {});
for (const w of WIDTHS) {
  await p.setViewportSize({ width: w, height: 844 });
  for (const r of ROUTES.filter((r) => r !== '/' && r !== '/welcome')) {
    await p.goto(BASE + r); await p.waitForTimeout(r.startsWith('/invest') || r === '/wallet' ? 3500 : 1800);
    await p.screenshot({ path: `${OUT}/${w}-${r.slice(1).replace(/\//g, '-') || 'home'}.png` });
  }
}
console.log('saved to', OUT); await b.close();
