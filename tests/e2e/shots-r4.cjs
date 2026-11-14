// Review screenshots: landing sections and the chat page (sidebar closed and open) at 390x844 in WebKit
// (iPhone 14) and 1440x900 in Chromium. Usage: BASE=... OUT=dir node tests/e2e/shots-r4.cjs
// WebKit on Linux may need GIO_EXTRA_MODULES pointing at glib-networking's gnutls module for https.
const { webkit, chromium, devices } = require('@playwright/test');
const fs = require('fs');
const BASE = (process.env.BASE || 'http://localhost:3100').replace(/\/$/, '');
const OUT = process.env.OUT || 'shots/round4'; fs.mkdirSync(OUT, { recursive: true });
const ONLY = process.env.ONLY || 'landing,chat';
(async () => {
  const d = devices['iPhone 14'];
  for (const [name, type, opts] of [['390', webkit, { viewport: d.viewport, userAgent: d.userAgent, deviceScaleFactor: 2 }], ['1440', chromium, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }]]) {
    const b = await type.launch(); const c = await b.newContext(opts); const p = await c.newPage();
    p.on('pageerror', (e) => console.log('pageerror', e.message));
    if (ONLY.includes('landing')) {
      await p.goto(BASE + '/'); await p.waitForTimeout(1200);
      const H = await p.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < H; y += 300) { await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(60); }
      await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(600);
      await p.screenshot({ path: `${OUT}/${name}-landing-full.png`, fullPage: true });
      const ids = await p.evaluate(() => [...document.querySelectorAll('.lp > section, .lp > footer')].map((e, i) => e.id || e.getAttribute('data-shot') || e.tagName.toLowerCase() + i));
      for (const [i, id] of ids.entries()) {
        const el = p.locator('.lp > section, .lp > footer').nth(i); await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(500);
        await el.screenshot({ path: `${OUT}/${name}-landing-${String(i).padStart(2, '0')}-${id}.png` });
      }
    }
    if (ONLY.includes('chat')) {
      await p.goto(BASE + '/welcome'); await p.fill('input[aria-label="Pick a username"]', 'rf' + Date.now().toString(36).slice(-6)); await p.fill('input[aria-label="Your first name"]', 'Ama');
      await p.click('button:has-text("Create my Pocket")'); await p.waitForURL('**/chat', { timeout: 150000 }); await p.waitForTimeout(1500);
      for (const q of ['Hi Pocket, how are you?', 'What is the date today?']) {
        await p.fill('textarea[aria-label="Message Pocket"]', q); await p.keyboard.press('Enter');
        await p.waitForFunction(() => !document.querySelector('[aria-label="Pocket is thinking"]'), null, { timeout: 60000 }).catch(() => {}); await p.waitForTimeout(1200);
        if (q.startsWith('Hi')) { await p.click('.tp-new').catch(async () => { await p.click('button[aria-label="New chat"]'); }); await p.waitForTimeout(500); }
      }
      await p.screenshot({ path: `${OUT}/${name}-chat${name === '390' ? '-closed' : '-open'}.png` });
      if (name === '390') { await p.click('button[aria-label="Open menu"]'); await p.waitForTimeout(700); await p.screenshot({ path: `${OUT}/390-chat-sidebar-open.png` }); await p.click('button[aria-label="Close menu"]'); await p.waitForTimeout(500); }
      else { await p.click('button[aria-label="Close sidebar"]'); await p.waitForTimeout(600); await p.screenshot({ path: `${OUT}/1440-chat-collapsed.png` }); await p.click('button[aria-label="Open sidebar"]'); await p.waitForTimeout(400); }
    }
    await b.close();
  }
  console.log('saved to', OUT);
})();
