// Writes .env.local (gitignored) from the keys bootstrap saved. Never prints a key.
// Usage: POCKET_SECRETS_DIR=.secrets ROOT=yourroot.testnet node scripts/write-env.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const ROOT = process.env.ROOT || JSON.parse(fs.readFileSync('deployment/testnet.json', 'utf8')).root;
const SECRETS = path.resolve(process.env.POCKET_SECRETS_DIR || '.secrets');
const read = (id) => JSON.parse(fs.readFileSync(path.join(SECRETS, id + '.json'), 'utf8')).private_key;
const rootFile = path.join(os.homedir(), '.near-credentials/testnet', ROOT + '.json');
const rootKey = fs.existsSync(path.join(SECRETS, ROOT + '.json')) ? read(ROOT) : JSON.parse(fs.readFileSync(rootFile, 'utf8')).private_key;
const keep = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l && !/^(SPONSOR|RELAYER|MAKER|FAUCET)_PRIVATE_KEY=|^NEXT_PUBLIC_POCKET_ROOT=/.test(l)) : [];
const lines = [
  ...keep,
  `NEXT_PUBLIC_POCKET_ROOT=${ROOT}`,
  `SPONSOR_PRIVATE_KEY=${rootKey}`,
  `RELAYER_PRIVATE_KEY=${read('relayer.' + ROOT)}`,
  `MAKER_PRIVATE_KEY=${read('maker.' + ROOT)}`,
  `FAUCET_PRIVATE_KEY=${read('faucet.' + ROOT)}`,
];
fs.writeFileSync('.env.local', lines.join('\n') + '\n', { mode: 0o600 });
console.log('wrote .env.local with 4 server keys for', ROOT);
