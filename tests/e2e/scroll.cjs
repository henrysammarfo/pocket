// Landing and marketing pages must scroll natively. Checks: WebKit at iPhone 14 size and user agent with wheel
// input (Playwright's mobile WebKit has no wheel or touch scrolling), Chromium iPhone 14 with real touch drags over
// CDP, and Chromium 1440 with the mouse wheel. Each page must reach its bottom. Usage: BASE=... PATHS=/,/welcome node tests/e2e/scroll.cjs
const { webkit, chromium, devices } = require('@playwright/test');
const BASE = (process.env.BASE || 'http://localhost:3100').replace(/\/$/, '');
const PATHS = (process.env.PATHS || '/').split(',');
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const metrics = (p) => p.evaluate(() => ({ y: scrollY, H: document.documentElement.scrollHeight, vh: innerHeight, ox: document.documentElement.scrollWidth - innerWidth, body: getComputedStyle(document.body).overflowY }));
async function check(name, p, step) {
  let m = await metrics(p); const t = Date.now();
  for (let i = 0; i < 60 && m.y < m.H - m.vh - 4; i++) { await step(); m = await metrics(p); }
  const ms = Date.now() - t, need = Math.max(0, m.H - m.vh);
  ok(m.y >= need - 4, `${name}: reached ${Math.round(m.y)} of ${need} scrollable px in ${ms} ms (body overflow ${m.body})`);
  ok(m.ox <= 0, `${name}: no horizontal overflow (${m.ox})`);
}
(async () => {
  const d = devices['iPhone 14'];
  const wk = await webkit.launch();
  for (const path of PATHS) {
    const c = await wk.newContext({ viewport: d.viewport, userAgent: d.userAgent, deviceScaleFactor: d.deviceScaleFactor }); const p = await c.newPage();
    await p.goto(BASE + path); await p.waitForTimeout(800); await p.mouse.move(195, 500);
    await check(`webkit iPhone 14 ${path}`, p, async () => { await p.mouse.wheel(0, 700); await p.waitForTimeout(140); });
    await c.close();
  }
  await wk.close();
  const cr = await chromium.launch();
  for (const path of PATHS) {
    const c = await cr.newContext({ viewport: d.viewport, userAgent: d.userAgent, deviceScaleFactor: 3, isMobile: true, hasTouch: true }); const p = await c.newPage();
    await p.goto(BASE + path); await p.waitForTimeout(800); const s = await c.newCDPSession(p);
    await check(`chromium iPhone 14 touch ${path}`, p, async () => {
      await s.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 720 }] });
      for (let i = 1; i <= 12; i++) { await s.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 720 - i * 45 }] }); await p.waitForTimeout(16); }
      await s.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(250);
    });
    await c.close();
  }
  for (const path of PATHS) {
    const c = await cr.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage();
    await p.goto(BASE + path); await p.waitForTimeout(800); await p.mouse.move(720, 450);
    await check(`chromium 1440 wheel ${path}`, p, async () => { await p.mouse.wheel(0, 900); await p.waitForTimeout(120); });
    await c.close();
  }
  await cr.close(); console.log(bad ? bad + ' FAILED' : 'ALL PASS'); process.exit(bad ? 1 : 0);
})();
