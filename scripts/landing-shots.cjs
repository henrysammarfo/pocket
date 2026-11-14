// Captures the real Pocket screens used on the landing page (public/land/*.webp) from a running server.
// Usage: BASE=http://localhost:3100 node scripts/landing-shots.cjs   (needs AI and voice keys for the chat shots)
const { chromium } = require('@playwright/test');
const fs = require('fs'); const { execFileSync } = require('child_process');
const BASE = (process.env.BASE || 'http://localhost:3100').replace(/\/$/, '');
const TMP = '/tmp/land-raw'; fs.mkdirSync(TMP, { recursive: true });
const shots = [];
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light' }); const p = await c.newPage();
  const snap = async (n) => { await p.waitForTimeout(700); await p.screenshot({ path: `${TMP}/${n}.png` }); shots.push(n); console.log('shot', n); };
  const idle = () => p.waitForFunction(() => !document.querySelector('[aria-label="Pocket is thinking"]') && !document.querySelector('[aria-label="Writing down what you said"]'), null, { timeout: 90000 });
  const say = async (t) => { const n = await p.locator('.thread .ai').count(); await p.fill('textarea[aria-label="Message Pocket"]', t); await p.keyboard.press('Enter'); await p.waitForFunction((n) => document.querySelectorAll('.thread .ai').length > n, n, { timeout: 90000 }); await idle(); await p.waitForTimeout(800); };
  await p.goto(BASE + '/welcome'); await p.fill('input[aria-label="Pick a username"]', 'ama' + Date.now().toString(36).slice(-5)); await p.fill('input[aria-label="Your first name"]', 'Ama');
  await p.click('button:has-text("Create my Pocket")'); await p.waitForURL('**/chat', { timeout: 150000 }); await p.waitForTimeout(2500);
  // 1 chat plan
  await say('Send @admin 5 dollars and put 10 in Tesla');
  if (await p.locator('.thread button:has-text("Yes")').count() && !(await p.locator('.plan').count())) { await p.locator('.thread button:has-text("Yes")').last().click(); await p.locator('.plan').first().waitFor({ timeout: 60000 }); }
  await p.evaluate(() => { const b = document.querySelector('.body.chat'); if (b) b.scrollTop = b.scrollHeight; }); await snap('chat');
  // 2 listening
  await p.click('.tp-new').catch(() => p.click('button[aria-label="New chat"]')); await p.waitForTimeout(600);
  await say('Hi Pocket. What can you do for me?');
  await p.click('button[aria-label="Hold or tap to talk"]'); await p.waitForTimeout(2200); await snap('listening');
  await p.click('button[aria-label="Stop and send"]').catch(() => {}); await p.waitForTimeout(4000); await idle().catch(() => {});
  // 3 voice note heard and said back
  await p.click('.tp-new').catch(() => p.click('button[aria-label="New chat"]')); await p.waitForTimeout(600);
  const n = await p.locator('[aria-label="Said by voice"]').count();
  await p.setInputFiles('input[type=file]', 'tests/e2e/fixtures/messy-voice.mp3');
  await p.waitForFunction((n) => document.querySelectorAll('[aria-label="Said by voice"]').length > n, n, { timeout: 90000 }); await idle(); await snap('voice');
  // 4 photo of a bill, split it
  await p.click('.tp-new').catch(() => p.click('button[aria-label="New chat"]')); await p.waitForTimeout(600);
  await p.setInputFiles('input[type=file]', 'tests/e2e/fixtures/receipt.png'); await p.locator('.cphoto').waitFor({ timeout: 10000 });
  await say('This is our dinner bill. Split it with @admin');
  if (await p.locator('.thread button:has-text("Yes")').count() && !(await p.locator('.plan').count())) { await p.locator('.thread button:has-text("Yes")').last().click(); await p.locator('.plan').first().waitFor({ timeout: 60000 }).catch(() => {}); await p.waitForTimeout(800); }
  await p.evaluate(() => { const b = document.querySelector('.body.chat'); if (b) b.scrollTop = b.scrollHeight; }); await snap('photo');
  // 5 review and hold
  await p.click('.tp-new').catch(() => p.click('button[aria-label="New chat"]')); await p.waitForTimeout(600);
  await say('send @admin 20 dollars');
  if (await p.locator('.thread button:has-text("Yes")').count() && !(await p.locator('.plan').count())) { await p.locator('.thread button:has-text("Yes")').last().click(); await p.locator('.plan').first().waitFor({ timeout: 60000 }); }
  await p.click('.plan button:has-text("Review and approve")'); await p.waitForURL('**/review**'); await p.waitForTimeout(2500); await snap('review');
  const el = p.locator('button.hold').first(); const bb = await el.boundingBox(); await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await p.waitForTimeout(1900); await p.mouse.up();
  await p.locator('a:has-text("See wallet")').waitFor({ timeout: 120000 }); await p.waitForTimeout(1200); await snap('sent');
  // 6 invest: buy NVDA, then the stock list
  await p.goto(BASE + '/invest/NVDA'); await p.waitForTimeout(3500); await snap('stock');
  await p.goto(BASE + '/wallet'); await p.waitForTimeout(3500); await snap('wallet');
  await p.goto(BASE + '/invest'); await p.waitForTimeout(3500); await snap('invest');
  await p.goto(BASE + '/activity'); await p.waitForTimeout(3000); await snap('activity');
  await b.close();
  for (const n of shots) execFileSync('python3', ['-c', `from PIL import Image; Image.open('${TMP}/${n}.png').convert('RGB').save('public/land/${n}.webp', quality=86, method=6)`]);
  console.log('wrote', shots.map((n) => `public/land/${n}.webp`).join(' '));
})().catch((e) => { console.log('ERR', e.message); process.exit(1); });
