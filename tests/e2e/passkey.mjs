// Passkey approval end to end with a virtual authenticator: turn it on in Settings, approve a send
// with it, turn it off, and recover when the passkey was deleted from the device.
// Usage: BASE=https://... node tests/e2e/passkey.mjs
import { chromium } from '@playwright/test';
const BASE = (process.env.BASE || 'http://localhost:3100').replace(/\/$/, '');
const fails = []; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m); };
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const cdp = await ctx.newCDPSession(p); await cdp.send('WebAuthn.enable');
const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
const rules = () => p.evaluate(() => JSON.parse(localStorage.getItem('pocket-rules') || '{}'));
const hold = async (sel) => { const el = p.locator(sel + ':not([disabled])').first(); await el.waitFor({ timeout: 60000 }); await p.waitForTimeout(800); const bb = await el.boundingBox(); await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await p.waitForTimeout(1500); await p.mouse.up(); };
try {
  await p.goto(BASE + '/welcome'); await p.fill('input[aria-label="Pick a username"]', 'pk' + Date.now().toString(36).slice(-6));
  await p.click('button:has-text("Create my Pocket")'); await p.waitForURL('**/chat', { timeout: 120000 });
  await p.goto(BASE + '/settings'); await p.click('button:has-text("Approve with passkey")'); await p.waitForTimeout(1500);
  let r = await rules(); ok(r.passkey === true && !!r.passkeyId, 'passkey turned on: ' + (r.passkeyId || '').slice(0, 10));
  const creds = (await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials; ok(creds.length === 1, 'one passkey on the authenticator');
  await p.goto(BASE + '/chat'); await p.waitForTimeout(1500);
  await p.fill('textarea[aria-label="Message Pocket"]', 'send @admin 1 dollar'); await p.keyboard.press('Enter');
  await p.locator('.plan button:has-text("Review and approve")').last().waitFor({ timeout: 60000 }); await p.locator('.plan button:has-text("Review and approve")').last().click();
  await p.waitForURL('**/review**'); await p.locator('.chip.ok:has-text("Checked")').waitFor({ timeout: 60000 });
  await hold('button.hold'); const done = await p.locator('a:has-text("See wallet")').waitFor({ timeout: 90000 }).then(() => true).catch(() => false);
  ok(done, 'send approved with the passkey');
  await p.goto(BASE + '/settings'); await p.click('button:has-text("Approve with passkey")'); await p.waitForTimeout(1500);
  r = await rules(); ok(!r.passkey, 'passkey turned off after a passkey check');
  await p.click('button:has-text("Approve with passkey")'); await p.waitForTimeout(1500); ok((await rules()).passkey === true, 'passkey on again');
  await cdp.send('WebAuthn.clearCredentials', { authenticatorId });
  p.once('dialog', (d) => { ok(/could not be used/.test(d.message()), 'asks before turning off a missing passkey'); d.accept(); });
  await p.click('button:has-text("Approve with passkey")'); await p.waitForTimeout(2500);
  ok(!(await rules()).passkey, 'missing passkey can still be turned off');
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
} finally { await b.close(); }
console.log(fails.length ? `${fails.length} FAILED` : 'ALL PASS'); process.exit(fails.length ? 1 : 0);
