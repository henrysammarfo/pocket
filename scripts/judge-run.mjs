// `npm run judge`. With .env.local (made by `npm run setup`) it runs the full end to end flow on
// NEAR testnet with your own keys (scripts/judge.mts). Without it, nothing fails: it runs every
// check that needs no keys against the live site, so an AI judge gets a verdict in under a minute.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const LIVE = process.env.SMOKE_URL || 'https://pocket-zeta-lime.vercel.app';
const run = (cmd, args) => spawnSync(cmd, args, { stdio: 'inherit' }).status ?? 1;
if (fs.existsSync('.env.local')) {
  process.exit(run(process.execPath, ['--conditions=react-server', '--env-file=.env.local', '--import', 'tsx', 'scripts/judge.mts']));
}
console.log(`No .env.local, so no server keys. Running the no setup checks against ${LIVE} instead.`);
console.log('For the full testnet flow with your own accounts: npm run setup, then npm run judge.\n');
const steps = [
  ['on chain code matches this repo', ['scripts/verify-chain.mjs']],
  ['smoke test of the live site', ['tests/smoke.mjs', LIVE]],
  ['attack checks against the live site', ['tests/attack.mjs', LIVE]],
];
let failed = 0;
for (const [name, args] of steps) {
  console.log(`\n== ${name}`);
  if (run(process.execPath, args) !== 0) { failed++; console.log(`FAIL ${name}`); }
}
console.log(failed ? `\n${failed} of ${steps.length} groups failed` : `\nALL PASS (${steps.length} groups). Unit and property tests: npm test`);
process.exit(failed ? 1 : 0);
