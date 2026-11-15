// Makes contracts/pool/tests/vector.json: three notes, their roots and a real proof, for the contract unit tests.
import fs from 'node:fs';
import { makeNote, merklePath, proveWithdraw } from '../src/lib/shared/zkpool';

const wasm = 'public/zk/withdraw.wasm', zkey = 'public/zk/withdraw.zkey';
const notes = [await makeNote('pool', '1'), await makeNote('pool', '1'), await makeNote('pool', '1')];
const leaves = notes.map((n) => BigInt(n.commitment));
const roots = [];
for (let i = 1; i <= leaves.length; i++) roots.push((await merklePath(leaves.slice(0, i), 0)).root);
const w = await proveWithdraw(notes[1], leaves, 'bob.testnet', 'relay.testnet', 1000n, wasm, zkey);
const vk = JSON.parse(fs.readFileSync('public/zk/verification_key.json', 'utf8'));
const emptyRoot = (await merklePath([], 0)).root;
fs.mkdirSync('contracts/pool/tests', { recursive: true });
fs.writeFileSync('contracts/pool/tests/vector.json', JSON.stringify({ vk, commitments: notes.map((n) => n.commitment), emptyRoot, roots, withdraw: w }, null, 1));
console.log('wrote contracts/pool/tests/vector.json');
process.exit(0);
