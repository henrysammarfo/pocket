// Smoke test for any running Pocket, local or hosted: pages load, CSS loads, contracts answer,
// live prices answer, and protected APIs refuse callers without a signed session.
const BASE = (process.env.BASE || process.argv[2] || 'http://localhost:3100').replace(/\/$/, '');
const fails = []; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m); };
const get = async (p, o) => { const r = await fetch(BASE + p, o); return { s: r.status, t: await r.text() }; };
const h = await get('/api/health'); const hj = JSON.parse(h.t);
ok(h.s === 200 && hj.network === 'testnet', 'health is up and on testnet');
ok(!!hj.verifierCodeHash, 'verifier contract answers on chain');
console.log('INFO services', JSON.stringify(hj.services), 'store', hj.store, 'ai', hj.aiProvider || 'none', hj.aiModel || '');
for (const p of ['/welcome', '/chat', '/invest', '/wallet', '/send', '/settings', '/pay/admin']) { const r = await get(p); ok(r.s === 200, `page ${p} ${r.s}`); }
const w = await get('/welcome'); const css = [...w.t.matchAll(/href="([^"]+\.css)"/g)].map((m) => m[1]);
ok(css.length > 0, 'stylesheet linked'); for (const c of css) { const r = await fetch(new URL(c, BASE)); ok(r.ok, 'stylesheet loads ' + r.status); }
const q = await get('/api/quotes'); ok(q.s === 200 && /TSLA/i.test(q.t), 'live prices answer');
for (const p of ['/api/credits', '/api/memory', '/api/chat/history']) { const r = await get(p); ok(r.s === 401, `${p} refuses without a session (${r.s})`); }
const c = await get('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'send @admin 5 dollars' }], ctx: { dollars: 0, holdings: {}, limit: 200, spentToday: 0, keep: 0 } }) });
const cj = JSON.parse(c.t || '{}');
ok(c.s === 200 && cj.source !== 'ai', `chat without a session uses only the free built in helper (${c.s}, ${cj.source})`);
const v = await get('/api/voice', { method: 'POST' }); ok(v.s === 401 || v.s === 400, `voice refuses without a session (${v.s})`);
console.log(fails.length ? `${fails.length} FAILED` : 'ALL PASS'); process.exit(fails.length ? 1 : 0);
