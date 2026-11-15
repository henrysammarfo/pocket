import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { accountField, makeNote, merklePath, hash } from '../../src/lib/shared/zkpool';
import { walletPolicy } from '../../src/lib/shared/policy';

const v = JSON.parse(fs.readFileSync('contracts/pool/tests/vector.json', 'utf8'));

describe('private pool shared code', () => {
  it('builds the same roots the contract computes (vector checked by the Rust tests)', async () => {
    expect((await merklePath([], 0)).root).toBe(v.emptyRoot);
    const leaves = v.commitments.map((c: string) => BigInt(c));
    for (let i = 1; i <= leaves.length; i++) expect((await merklePath(leaves.slice(0, i), 0)).root).toBe(v.roots[i - 1]);
  });
  it('makes notes whose commitment and nullifier hash match MiMC', async () => {
    const n = await makeNote('pool.testnet', '1');
    expect(n.commitment).toBe((await hash(BigInt(n.secret), BigInt(n.nullifier))).toString());
    expect(n.nullifierHash).toBe((await hash(BigInt(n.nullifier))).toString());
  });
  it('maps an account to a field element below 2^248', () => {
    expect(accountField('bob.testnet') < 2n ** 248n).toBe(true);
    expect(accountField('bob.testnet')).not.toBe(accountField('bob2.testnet'));
  });
});

describe('relayer policy for send_private', () => {
  const d = (args: Record<string, unknown>) => ({ senderId: 'a.pocket.testnet', receiverId: 'a.pocket.testnet', nonce: '1', maxBlockHeight: '1', publicKey: 'ed25519:x', signature: 'x', actions: [{ type: 'functionCall', method: 'send_private', args, gas: String(250n * 10n ** 12n), deposit: '0' }] });
  it('accepts one 0.1 NEAR note', () => {
    expect(walletPolicy(d({ commitment: '123', amount: String(10n ** 23n) }) as never).method).toBe('send_private');
  });
  it('refuses any other amount', () => {
    expect(() => walletPolicy(d({ commitment: '123', amount: String(2n * 10n ** 23n) }) as never)).toThrow(/exactly 0.1 NEAR/);
  });
  it('refuses a commitment that is not a number', () => {
    expect(() => walletPolicy(d({ commitment: '0xabc', amount: String(10n ** 23n) }) as never)).toThrow(/Bad commitment/);
  });
});
