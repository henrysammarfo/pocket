// Chat and voice in a real browser from a clean profile: small talk, messy speech style text,
// confirm step, plan card, tap to record with a fake mic, voice note upload, credits meter in Settings.
import { chromium } from '@playwright/test';
const BASE = process.env.BASE || 'http://localhost:3100';
const SHOTS = process.env.SHOTS || 'shots';
const W = Number(process.env.W || 390), H = Number(process.env.H || 844);
const tag = W > 700 ? 'd' : 'm';
const u = 'cv' + Date.now().toString(36).slice(-6);
const fails = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m); };
const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, permissions: ['microphone'] });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const health = await (await fetch(BASE + '/api/health')).json();
console.log('AI', health.services?.ai ? `${health.aiProvider} ${health.aiModel}` : 'off (built in helper)', 'voice', health.services?.voice ? health.sttModel : 'off');
await p.goto(BASE + '/welcome');
await p.fill('input[aria-label="Pick a username"]', u);
await p.fill('input[aria-label="Your first name"]', 'Kofi');
await p.click('button:has-text("Create my Pocket")');
await p.waitForURL('**/chat', { timeout: 90000 });
ok(true, 'signed up ' + u);
const say = async (t) => { const n = await p.locator('.thread .ai').count(); await p.fill('textarea[aria-label="Message Pocket"]', t); await p.keyboard.press('Enter'); await p.waitForFunction((n) => document.querySelectorAll('.thread .ai').length > n && !document.querySelector('[aria-label="Pocket is thinking"]'), n, { timeout: 60000 }); await p.waitForTimeout(400); return (await p.locator('.thread .ai').last().innerText()).trim(); };
const r1 = await say('hi, how are you today?');
ok(r1.length > 3, 'small talk reply: ' + r1.slice(0, 90).replace(/\n/g, ' '));
const r2 = await say('ehm so i i want to like send send @admin uh five dollars please');
const plan = await p.locator('.plan').count(); const conf = await p.locator('.thread button:has-text("Yes")').count();
ok(plan > 0 || conf > 0, `messy request gave ${plan ? 'a plan card' : conf ? 'a confirm step' : 'nothing'}: ` + r2.slice(0, 90).replace(/\n/g, ' '));
if (conf && !plan) { await p.locator('.thread button:has-text("Yes")').last().click(); await p.locator('.plan').first().waitFor({ timeout: 60000 }); ok(true, 'confirm led to plan card'); }
await p.screenshot({ path: `${SHOTS}/${tag}-chat-voice-plan.png` });
const mic = p.locator('button[aria-label="Hold or tap to talk"]');
ok(await mic.count() === 1, 'mic button present');
if (await mic.count()) {
  await mic.click(); await p.waitForTimeout(1800);
  const rec = await p.locator('.composer.rec').count(); ok(rec === 1, 'recording state shown');
  await p.screenshot({ path: `${SHOTS}/${tag}-chat-recording.png` });
  await p.click('button[aria-label="Stop and send"]').catch(() => {});
  await p.waitForTimeout(5000);
  ok((await p.locator('.composer.rec').count()) === 0, 'recording stopped cleanly');
}
const aiOn = !!health.services?.ai, sttOn = !!health.services?.voice;
if (sttOn) {
  // A real messy voice note: fillers, repeats and Pidgin ("abeg"), spoken in West African English.
  const n = await p.locator('[aria-label="Said by voice"]').count();
  await p.setInputFiles('input[type=file]', 'tests/e2e/fixtures/messy-voice.mp3');
  await p.waitForFunction((n) => document.querySelectorAll('[aria-label="Said by voice"]').length > n, n, { timeout: 60000 });
  await p.waitForFunction(() => !document.querySelector('[aria-label="Pocket is thinking"]') && !document.querySelector('[aria-label="Writing down what you said"]'), null, { timeout: 60000 });
  await p.waitForTimeout(800);
  const heard = (await p.locator('.thread .me').last().innerText()).trim();
  ok(/send|admin|five|5|tesla/i.test(heard), 'voice note transcribed: ' + heard.slice(0, 120));
  const reply = (await p.locator('.thread .ai').last().innerText()).trim();
  const conf = await p.locator('.thread button:has-text("Yes")').count();
  ok(conf > 0 || /plan/i.test(reply), 'voice note confirmed back before a plan: ' + reply.slice(0, 140).replace(/\n/g, ' '));
  await p.screenshot({ path: `${SHOTS}/${tag}-chat-voice-note.png` });
} else {
  await p.setInputFiles('input[type=file]', 'tests/e2e/fixtures/tone.wav'); await p.waitForTimeout(4000);
  ok(true, 'voice note upload handled without a speech key');
}
if (aiOn) {
  const r3 = await say('By the way I get paid on the 25th of every month, please remember that');
  ok(r3.length > 3, 'memory request reply: ' + r3.slice(0, 100).replace(/\n/g, ' '));
  const src = await p.locator('.thread .meta, .thread .chip').allInnerTexts();
  ok(src.join(' ').length > 0, 'reply labels: ' + [...new Set(src)].slice(-4).join(', '));
}
await p.goto(BASE + '/settings'); await p.locator('.meter').waitFor({ timeout: 20000 }); await p.waitForTimeout(800);
const ct = await p.locator('.credits .ct').innerText(); ok(/left/.test(ct), 'credits meter: ' + ct);
if (aiOn) { await p.waitForTimeout(1500); const mem = await p.locator('.ghead:has-text("What Pocket remembers") span').innerText(); ok(Number(mem) > 0, 'memory saved in Settings: ' + mem); ok(!/1,000 of 1,000/.test(ct), 'AI use was metered'); }
await p.screenshot({ path: `${SHOTS}/${tag}-settings-credits.png`, fullPage: true });
const ow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(ow <= 0, 'no horizontal overflow in settings');
ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
await b.close();
console.log(fails.length ? `${fails.length} FAILED` : 'ALL PASS');
process.exit(fails.length ? 1 : 0);
