// `npm run verify:chain`: proves the contracts live on NEAR testnet are exactly the code in this repo.
// For the verifier and every token it compares the on chain code_hash (base58 sha256 of the wasm)
// with the sha256 of vendor/defuse.wasm and vendor/pocket_token.wasm. No keys, no setup.
import fs from 'node:fs';
import crypto from 'node:crypto';
import bs58 from 'bs58';

const dep = JSON.parse(fs.readFileSync(new URL('../deployment/testnet.json', import.meta.url)));
const RPCS = [process.env.NEAR_RPC_URL, 'https://test.rpc.fastnear.com', 'https://rpc.testnet.near.org'].filter(Boolean);
const hashOf = (f) => bs58.encode(crypto.createHash('sha256').update(fs.readFileSync(new URL('../vendor/' + f, import.meta.url))).digest());
async function codeHash(account) {
  for (const url of RPCS) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(10000), body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'query', params: { request_type: 'view_account', finality: 'final', account_id: account } }) }).then((x) => x.json());
      if (r.result) return r.result.code_hash;
    } catch { /* next rpc */ }
  }
  return null;
}
const want = { verifier: hashOf('defuse.wasm'), token: hashOf('pocket_token.wasm') };
const checks = [[dep.verifier, want.verifier, 'NEAR Intents verifier, defuse v0.4.2 release wasm'], ...dep.tokens.map((t) => [t.contract, want.token, `${t.symbol} fixed supply NEP-141`])];
let fail = 0;
for (const [account, expected, what] of checks) {
  const got = await codeHash(account);
  const ok = got === expected;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${account} (${what}) code_hash ${got ?? 'not found'}${ok ? '' : ' expected ' + expected}`);
}
console.log(fail ? `${fail} FAIL` : 'ALL PASS: on chain code matches vendor/*.wasm');
process.exit(fail ? 1 : 0);
