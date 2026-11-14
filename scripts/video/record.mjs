// Records the demo journey on the live site with Playwright, phone size and a desktop pass.
// Writes raw videos and events.json (seconds from the start of each video) into OUT.
// Usage: BASE=https://pocket-teamtitanlink.vercel.app OUT=/tmp/video/raw node scripts/video/record.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const BASE = (process.env.BASE || 'https://pocket-teamtitanlink.vercel.app').replace(/\/$/, '');
const OUT = process.env.OUT || 'video-raw'; mkdirSync(OUT, { recursive: true });
const VOICE = process.env.VOICE_NOTE || 'tests/e2e/fixtures/messy-voice.mp3';
const ev = { phone: {}, desktop: {} };
// A soft dot shows each tap and stays while a press is held, so viewers can see the hold.
const TOUCH = () => {
  const css = document.createElement('style');
  css.textContent = '.__t{position:fixed;z-index:2147483647;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(18,60,50,.28);border:2px solid rgba(18,60,50,.55);pointer-events:none;transition:opacity .35s,transform .35s}';
  addEventListener('DOMContentLoaded', () => document.head.appendChild(css));
  let dot = null;
  addEventListener('pointerdown', (e) => { dot = document.createElement('div'); dot.className = '__t'; const z = window.__z || 1; dot.style.left = e.clientX / z + 'px'; dot.style.top = e.clientY / z + 'px'; document.body.appendChild(dot); }, true);
  addEventListener('pointerup', () => { const d = dot; if (!d) return; d.style.opacity = '0'; d.style.transform = 'scale(1.6)'; setTimeout(() => d.remove(), 400); dot = null; }, true);
};
// Chromium screencast gives frames at full device pixels (Playwright's recordVideo does not), so the phone stays sharp.
async function screencast(ctx, p, name, w, h) {
  const dir = `${OUT}/${name}-frames`; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const cdp = await ctx.newCDPSession(p); const frames = []; let n = 0;
  cdp.on('Page.screencastFrame', async (f) => { const file = `${dir}/${String(n++).padStart(6, '0')}.jpg`; writeFileSync(file, Buffer.from(f.data, 'base64')); frames.push([file, f.metadata.timestamp]); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: w, maxHeight: h, everyNthFrame: 1 });
  const start = Date.now() / 1000;
  return { start, async stop() {
    await cdp.send('Page.stopScreencast').catch(() => {}); await new Promise((r) => setTimeout(r, 300));
    const end = Date.now() / 1000; let list = '';
    frames.sort((a, b) => a[1] - b[1]);
    // First frame covers from start; each frame lasts until the next one.
    for (let i = 0; i < frames.length; i++) { const t = i === 0 ? start : frames[i][1]; const nx = i + 1 < frames.length ? frames[i + 1][1] : end; list += `file '${frames[i][0].split('/').pop()}'\nduration ${Math.max(0.001, nx - t).toFixed(4)}\n`; }
    list += `file '${frames[frames.length - 1][0].split('/').pop()}'\n`;
    writeFileSync(`${dir}/list.txt`, list);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', `${dir}/list.txt`, '-vf', `fps=30,scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=0xf4f4ef,format=yuv420p`, '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', `${OUT}/${name}.mp4`]);
  } };
}
const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
// Phone pass: 400x866 CSS px at 2x, recorded at 800x1732.
if (process.env.ONLY !== 'desktop') {
  // Headless screencast ignores deviceScaleFactor, so render a 400 px wide phone layout at 2x with CSS zoom on an 800 px viewport.
  const ctx = await b.newContext({ viewport: { width: 800, height: 1732 } });
  await ctx.addInitScript(() => { const z = () => { document.documentElement.style.zoom = '2'; window.__z = 2; if (!document.getElementById('__zfix') && document.head) { const st = document.createElement('style'); st.id = '__zfix'; st.textContent = '.app{height:50dvh!important}.land{min-height:50vh!important}'; document.head.appendChild(st); } }; if (document.documentElement) z(); addEventListener('DOMContentLoaded', z); });
  await ctx.addInitScript(TOUCH);
  await ctx.addInitScript(() => localStorage.setItem('pocket-theme', 'light'));
  const p = await ctx.newPage(); const sc = await screencast(ctx, p, 'phone', 800, 1732); const t0 = sc.start * 1000;
  const mark = (k) => { ev.phone[k] = (Date.now() - t0) / 1000; console.log('mark', k, ev.phone[k]); };
  const tap = async (loc) => { const el = loc.first(); await el.waitFor({ timeout: 60000 }); await el.scrollIntoViewIfNeeded(); const bb = await el.boundingBox(); await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await p.waitForTimeout(120); await p.mouse.up(); };
  const idle = () => p.waitForFunction(() => !document.querySelector('[aria-label="Pocket is thinking"]') && !document.querySelector('[aria-label="Writing down what you said"]'), null, { timeout: 90000 });
  await p.goto(BASE + '/welcome'); await p.waitForTimeout(1500); mark('welcome');
  await p.click('input[aria-label="Pick a username"]'); await p.keyboard.type('ama' + Date.now().toString(36).slice(-5), { delay: 70 });
  await p.click('input[aria-label="Your first name"]'); await p.keyboard.type('Ama', { delay: 70 }); await p.waitForTimeout(500);
  mark('tapCreate'); await tap(p.locator('button:has-text("Create my Pocket")'));
  await p.waitForURL('**/chat', { timeout: 120000 }); await p.waitForTimeout(1200); mark('chat');
  await tap(p.locator('a[href="/wallet"]:visible'));
  await p.waitForFunction(() => /1,?000/.test(document.querySelector('.pcard')?.textContent || ''), null, { timeout: 60000 }); await p.waitForTimeout(400); mark('wallet'); await p.waitForTimeout(2200);
  await tap(p.locator('a[href="/chat"]:visible')); await p.waitForTimeout(1500); mark('chat2');
  await tap(p.locator('textarea[aria-label="Message Pocket"]')); await p.keyboard.type('hello, what can you do for me?', { delay: 45 }); mark('askSmall'); await p.keyboard.press('Enter');
  await p.waitForTimeout(800); await idle(); await p.waitForTimeout(300); mark('smallReply'); await p.waitForTimeout(2500);
  mark('voiceTap'); await tap(p.locator('button[aria-label="Upload a voice note"]')).catch(() => {});
  await p.setInputFiles('input[type=file]', VOICE); mark('voiceSent');
  await p.waitForSelector('[aria-label="Said by voice"]', { timeout: 60000 }); mark('voiceHeard');
  await p.waitForTimeout(500); await idle(); await p.waitForTimeout(400); mark('voiceConfirm'); await p.waitForTimeout(3000);
  await tap(p.locator('.thread button:has-text("Yes")').last()); mark('yes');
  await p.locator('.plan').last().waitFor({ timeout: 60000 }); await p.waitForTimeout(400); await p.locator('.plan').last().scrollIntoViewIfNeeded(); mark('plan'); await p.waitForTimeout(3500);
  await tap(p.locator('.plan button:has-text("Review and approve")').last()); await p.waitForURL('**/review**');
  await p.locator('.chip.ok:has-text("Checked")').waitFor({ timeout: 60000 }); await p.locator('button.hold:not([disabled])').waitFor({ timeout: 60000 }); await p.waitForTimeout(1200); mark('review'); await p.waitForTimeout(1800);
  { // Under CSS zoom the pointer hit test drifts, so hold with the keyboard (same code path) and draw the finger dot on the button.
    await p.evaluate(() => document.querySelector('button.hold').focus({ preventScroll: true }));
    await p.evaluate(() => { const b = document.querySelector('button.hold'); const d = document.createElement('div'); d.className = '__t'; d.id = '__hold'; d.style.cssText = 'position:absolute;left:50%;top:50%'; b.style.position = b.style.position || 'relative'; b.appendChild(d); });
    mark('holdStart'); await p.keyboard.down(' '); await p.waitForTimeout(1500); await p.keyboard.up(' '); mark('holdEnd');
    await p.evaluate(() => document.getElementById('__hold')?.remove()); }
  await p.locator('a:has-text("See wallet")').waitFor({ timeout: 120000 }); await p.waitForTimeout(500); mark('done'); await p.waitForTimeout(3000);
  await tap(p.locator('.bd a[href^="/r/"]').last()); await p.waitForURL('**/r/**'); await p.locator('.rhead').waitFor({ timeout: 60000 }); await p.waitForTimeout(800); mark('receipt'); await p.waitForTimeout(2500);
  for (let i = 0; i < 12; i++) { await p.mouse.wheel(0, 80); await p.waitForTimeout(60); } mark('receiptScrolled'); await p.waitForTimeout(2500);
  await p.goto(BASE + '/settings'); await p.waitForTimeout(1500); mark('settings');
  for (let i = 0; i < 14; i++) { await p.mouse.wheel(0, 80); await p.waitForTimeout(70); } await p.waitForTimeout(3000); mark('settingsEnd');
  await sc.stop(); await ctx.close();
}
// Desktop pass: live prices on a wide screen.
{
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.2 });
  await ctx.addInitScript(TOUCH);
  const p = await ctx.newPage();
  // Sign in first (not recorded), so Invest shows the signed in app.
  await p.goto(BASE + '/welcome'); await p.fill('input[aria-label="Pick a username"]', 'desk' + Date.now().toString(36).slice(-5));
  await p.click('button:has-text("Create my Pocket")'); await p.waitForURL('**/chat', { timeout: 120000 }); await p.waitForTimeout(1500);
  const sc = await screencast(ctx, p, 'desktop', 1920, 1080); const t0 = sc.start * 1000; const mark = (k) => { ev.desktop[k] = (Date.now() - t0) / 1000; };
  await p.goto(BASE + '/invest'); await p.waitForTimeout(5000); mark('invest'); await p.waitForTimeout(3000);
  await p.goto(BASE + '/invest/TSLA'); await p.waitForTimeout(5000); mark('tesla'); await p.waitForTimeout(3500); mark('end');
  await sc.stop(); await ctx.close();
}
await b.close();
if (process.env.ONLY === 'desktop') { const old = JSON.parse((await import('node:fs')).readFileSync(`${OUT}/events.json`, 'utf8')); ev.phone = old.phone; }
writeFileSync(`${OUT}/events.json`, JSON.stringify(ev, null, 1)); console.log(JSON.stringify(ev));
