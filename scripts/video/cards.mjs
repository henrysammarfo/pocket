// Renders the 1920x1080 backgrounds, captions and cards for every scene in script.json as PNGs.
// Usage: OUT=/tmp/video/cards node scripts/video/cards.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const OUT = process.env.OUT || 'video-cards'; mkdirSync(OUT, { recursive: true });
const S = JSON.parse(readFileSync(new URL('./script.json', import.meta.url)));
const coil = readFileSync(resolve('public/brand/coil.svg'), 'utf8').replace(/width="20" height="18"/, 'width="100%" height="100%"').replace(/preserveAspectRatio="none"/, '').replace(/fill="(#[0-9a-fA-F]{3,6}|black|currentColor)"/g, 'fill="#5fd3a5"');
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const base = `*{margin:0;box-sizing:border-box}body{width:1920px;height:1080px;font-family:Manrope,sans-serif;color:#f7f7f3;background:radial-gradient(1200px 900px at 78% 40%,#1b5545 0%,#123c32 45%,#0a241d 100%);overflow:hidden;position:relative}
.logo{display:flex;align-items:center;gap:18px;font-weight:800;font-size:40px;letter-spacing:-.5px}.logo i{width:48px;height:44px;display:block}
.top{position:absolute;left:140px;top:84px}.step{position:absolute;left:140px;top:300px;width:960px}
h1{font-size:84px;line-height:1.02;font-weight:800;letter-spacing:-2px}h2{font-size:40px;line-height:1.35;font-weight:500;color:#cfe7dc;margin-top:34px}
.cap{font-size:38px;line-height:1.38;font-weight:500;color:#d9ece3;margin-top:36px}
.bezel{position:absolute;left:${1240 - 14}px;top:${60 - 14}px;width:${444 + 28}px;height:${960 + 28}px;border-radius:64px;background:#060a09;box-shadow:0 40px 120px rgba(0,0,0,.55),0 0 0 2px #24493f}
.tag{position:absolute;left:140px;bottom:80px;font-size:26px;color:#9fc7b6;font-weight:600}
.dot{display:inline-block;width:12px;height:12px;border-radius:50%;background:#5fd3a5;margin-right:14px;vertical-align:2px}`;
const card = (s) => {
  if (s.id === 'title' || s.id === 'end') return `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
    <div style="width:220px;height:198px">${coil}</div><h1 style="font-size:150px;margin-top:40px">${esc(s.head)}</h1><h2 style="font-size:56px;margin-top:18px">${esc(s.sub)}</h2>
    ${s.foot ? `<div style="font-size:32px;color:#9fc7b6;margin-top:70px;font-weight:600">${esc(s.foot)}</div>` : '<div style="font-size:30px;color:#9fc7b6;margin-top:70px;font-weight:600">Built at NEAR HACKATHON · NEAR testnet</div>'}</div>`;
  if (s.bullets) return `<div class="top logo"><i>${coil}</i>Pocket</div><div class="step" style="top:250px;width:1500px"><h1>${esc(s.head)}</h1>${s.bullets.map((b) => `<div class="cap" style="font-size:50px;margin-top:40px"><span class="dot"></span>${esc(b)}</div>`).join('')}</div>`;
  if (s.code) return `<div class="top logo"><i>${coil}</i>Pocket</div><div class="step" style="top:250px;width:1500px"><h1>${esc(s.head)}</h1>
    <div style="margin-top:56px;background:#06120e;border-radius:28px;padding:48px 56px;font:500 46px/1.7 'DejaVu Sans Mono',monospace;color:#d9ece3;width:1100px;box-shadow:0 30px 80px rgba(0,0,0,.4)">${s.code.map((c, i) => i === s.code.length - 1 ? `<div style="color:#5fd3a5;font-weight:700">✓ ${esc(c)}</div>` : `<div><span style="color:#5fd3a5">$</span> ${esc(c)}</div>`).join('')}</div>
    <div class="cap" style="font-size:34px">Unit, testnet, browser on phone and desktop, responsive and hosted checks</div></div>`;
  return `<div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 200px"><h1 style="font-size:104px">${esc(s.head)}</h1><h2 style="font-size:52px;max-width:1400px">${esc(s.sub)}</h2></div><div class="top logo"><i>${coil}</i>Pocket</div>`;
};
const phoneBg = (s) => `<div class="top logo"><i>${coil}</i>Pocket</div><div class="step"><h1>${esc(s.head)}</h1><div class="cap">${esc(s.caption || s.vo)}</div></div><div class="tag">Live on NEAR testnet · pocket-teamtitanlink.vercel.app</div>`;
const deskBg = (s) => `<div style="position:absolute;left:210px;top:40px;width:1500px;height:844px;border-radius:22px;background:#060a09;box-shadow:0 40px 120px rgba(0,0,0,.55),0 0 0 2px #24493f"></div>
  <div style="position:absolute;left:210px;right:210px;top:915px;display:flex;align-items:baseline;gap:40px"><h1 style="font-size:58px;white-space:nowrap">${esc(s.head)}</h1><div class="cap" style="margin:0;font-size:34px">${esc(s.vo)}</div></div>`;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
for (const s of S.scenes) {
  const html = s.kind === 'card' ? card(s) : s.kind === 'desktop' ? deskBg(s) : phoneBg(s);
  await p.setContent(`<html><head><style>${base}</style></head><body>${html}</body></html>`); await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: `${OUT}/${s.id}.png` });
}
// Phone bezel with a transparent outside, so the whole phone can grow for zooms.
await p.setViewportSize({ width: 472, height: 988 });
await p.setContent(`<body style="margin:0;background:transparent;width:472px;height:988px"><div style="width:472px;height:988px;border-radius:64px;background:#060a09;box-shadow:inset 0 0 0 2px #2c5a4d"></div></body>`);
await p.screenshot({ path: `${OUT}/bezel.png`, omitBackground: true });
// Rounded masks for the phone screen and the desktop window.
await p.setContent(`<body style="margin:0;background:#000;width:444px;height:960px"><div style="width:444px;height:960px;border-radius:52px;background:#fff"></div></body>`); await p.setViewportSize({ width: 444, height: 960 }); await p.screenshot({ path: `${OUT}/mask-phone.png` });
await p.setViewportSize({ width: 1480, height: 824 }); await p.setContent(`<body style="margin:0;background:#000"><div style="width:1480px;height:824px;border-radius:14px;background:#fff"></div></body>`); await p.screenshot({ path: `${OUT}/mask-desktop.png` });
await b.close(); console.log('cards done');
