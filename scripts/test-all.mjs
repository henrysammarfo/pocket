// One command for every test, always from a clean state:
// fresh logs folder, fresh Next build, a new server, fresh test accounts (new usernames each run),
// and a brand new browser profile per test (no cookies, no local storage).
// Steps: lint, typecheck, unit, build, smoke (local), testnet integration (judge), browser e2e
// on phone and desktop, responsive matrix, and a hosted smoke test when SMOKE_URL is set.
// Results go to test-results/summary.md. Steps that need testnet keys are skipped, not failed,
// when .env.local has no keys (for example in CI without secrets).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync, createWriteStream } from 'node:fs';
const OUT = 'test-results'; const SHOTS = OUT + '/shots'; const PORT = process.env.TEST_PORT || '3210';
const BASE = `http://localhost:${PORT}`;
rmSync(OUT, { recursive: true, force: true }); mkdirSync(SHOTS, { recursive: true });
for (const f of ['/tmp/pocket-state.json']) rmSync(f, { force: true });
const env = { ...process.env, BASE, SHOTS, STATE: OUT + '/responsive-state.json', NEXT_TELEMETRY_DISABLED: '1' };
const envFile = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
const hasKeys = /^SPONSOR_PRIVATE_KEY=.+/m.test(envFile) || !!process.env.SPONSOR_PRIVATE_KEY;
const rows = [];
const run = (name, cmd, args, opt = {}) => {
  if (opt.skip) { rows.push([name, 'SKIP', opt.skip, 0]); console.log(`\n== ${name}: SKIP (${opt.skip})`); return true; }
  console.log(`\n== ${name}`); const t = Date.now();
  const r = spawnSync(cmd, args, { env: { ...env, ...(opt.env || {}) }, encoding: 'utf8', maxBuffer: 64 << 20 });
  const log = (r.stdout || '') + (r.stderr || ''); writeFileSync(`${OUT}/${name.replace(/\W+/g, '-')}.log`, log);
  const tail = log.trim().split('\n').slice(-1)[0] || ''; const pass = r.status === 0;
  console.log(log.trim().split('\n').slice(-6).join('\n')); rows.push([name, pass ? 'PASS' : 'FAIL', tail.slice(0, 120), Date.now() - t]);
  return pass;
};
run('lint', 'npx', ['eslint', 'src', '--quiet']);
run('typecheck', 'npx', ['tsc', '--noEmit']);
run('unit', 'npx', ['vitest', 'run']);
rmSync('.next', { recursive: true, force: true });
const built = run('build', 'npx', ['next', 'build']);
let srv;
if (built) {
  const log = createWriteStream(`${OUT}/server.log`);
  srv = spawn('npx', ['next', 'start', '-p', PORT], { env, detached: true }); srv.stdout.pipe(log); srv.stderr.pipe(log);
  for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE + '/api/health')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 1000)); }
}
const noSrv = built ? '' : 'build failed';
const noKeys = hasKeys ? '' : 'no testnet keys in .env.local (run npm run setup)';
run('smoke local', 'node', ['tests/smoke.mjs', BASE], { skip: noSrv });
run('integration testnet (judge)', 'npm', ['run', '-s', 'judge'], { skip: noKeys });
run('e2e money flow phone', 'node', ['tests/e2e/ui-flow.mjs'], { skip: noSrv || noKeys });
run('e2e chat and voice phone', 'node', ['tests/e2e/chat-voice.mjs'], { skip: noSrv || noKeys, env: { W: '390', H: '844' } });
run('e2e chat and voice desktop', 'node', ['tests/e2e/chat-voice.mjs'], { skip: noSrv || noKeys, env: { W: '1440', H: '900' } });
run('responsive matrix', 'node', ['tests/e2e/responsive.mjs'], { skip: noSrv || noKeys });
run('smoke hosted', 'node', ['tests/smoke.mjs', process.env.SMOKE_URL || ''], { skip: process.env.SMOKE_URL ? '' : 'set SMOKE_URL to the preview URL' });
if (srv) { try { process.kill(-srv.pid); } catch {} }
const fail = rows.filter((r) => r[1] === 'FAIL').length;
const md = `# Test run ${new Date().toISOString()}\n\n| Step | Result | Last line | Time |\n| --- | --- | --- | --- |\n` + rows.map((r) => `| ${r[0]} | ${r[1]} | ${String(r[2]).replace(/\|/g, '/')} | ${(r[3] / 1000).toFixed(1)} s |`).join('\n') + `\n\n${fail ? fail + ' failed' : 'All run steps passed'}. Logs and screenshots are in test-results/.\n`;
writeFileSync(`${OUT}/summary.md`, md); console.log('\n' + md); process.exit(fail ? 1 : 0);
