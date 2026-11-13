// Responsive matrix: every route, light and black, phone to desktop, 50% to 100% zoom. Fails on horizontal overflow.
import { chromium } from '@playwright/test';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
const BASE = process.env.BASE || 'http://localhost:3100';
const SHOTS = process.env.SHOTS || 'shots';
const STATE = process.env.STATE || '/tmp/pocket-state.json';
const b = await chromium.launch();
if (!existsSync(STATE)) {
  const c = await b.newContext(); const p = await c.newPage();
  await p.goto(BASE + '/welcome'); await p.fill('input[aria-label="Pick a username"]', 'rsp' + Date.now().toString(36).slice(-6));
  await p.click('button:has-text("Create my Pocket")'); await p.waitForURL('**/chat', { timeout: 90000 });
  writeFileSync(STATE, JSON.stringify(await c.storageState())); await c.close();
}
const state = JSON.parse(readFileSync(STATE, 'utf8'));
const routes = ['/welcome', '/chat', '/send', '/send/to', '/invest', '/invest/TSLA', '/wallet', '/coin/near', '/coin/usdc', '/swap', '/contacts', '/settings', '/profile', '/activity', '/review?plan=x', '/pay/admin'];
const widths = [320, 375, 414, 768, 1024, 1440];
const zooms = [1, 0.75, 0.5];
let bad = 0, n = 0;
for (const theme of ['light', 'black']) for (const w of widths) for (const z of zooms) {
  if (z < 1 && w < 768 && w !== 375) continue;
  const vw = Math.round(w / z), vh = Math.round((w < 768 ? 844 : 900) / z);
  const c = await b.newContext({ ...{ storageState: state }, viewport: { width: vw, height: vh } });
  const p = await c.newPage();
  await p.addInitScript((t) => localStorage.setItem('pocket-theme', t), theme);
  for (const r of routes) {
    await p.goto(BASE + r, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(r.includes('invest') || r.includes('coin') ? 1800 : 900);
    const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, tabs: document.querySelectorAll('.tabbar .tab').length, wide: [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed'; }).slice(0, 3).map((e) => e.tagName + '.' + String(e.className).slice(0, 40)) }));
    n++;
    if (o.sw > o.iw + 1 || o.tabs > 5) { bad++; console.log('OVERFLOW', theme, w, z, r, o); }
    if (z === 1 && (w === 390 || w === 375 || w === 1440) && ['/chat', '/wallet', '/invest', '/invest/TSLA', '/send/to', '/settings', '/welcome'].includes(r)) await p.screenshot({ path: `${SHOTS}/${theme}-${w}-${r.replace(/[/?=]/g, '_').replace(/^_/, '') || 'root'}.png` });
  }
  await c.close();
}
await b.close();
console.log(`checked ${n} page views, ${bad} with overflow`);
process.exit(bad ? 1 : 0);
