// Property based and fuzz tests for the Pocket policy engine (docs/POLICY.md).
// Each property runs hundreds of random cases with fast-check; a failure prints the smallest case.
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { delegatePolicy, reserveSpend, burnNonce, isPocketUser, validAccountId, PolicyError, MAX_NEAR_PER_DELEGATE, type Counter } from '@/lib/shared/policy';
import { checkPlan, type Plan, type Ctx, type Step } from '@/lib/shared/plan';
import { newKey, keyFromString, signNep413, verifyNep413, randomNonce } from '@/lib/shared/nep413';
import { ROOT, USDC, VERIFIER } from '@/lib/shared/deployment';

const user = `kofi.${ROOT}`;
const pk = newKey().publicKey;
const base = { senderId: user, nonce: '7', maxBlockHeight: '100', publicKey: pk, signature: 'ed25519:x' };
const ft = (amount: string, receiver = 'ama.testnet') => ({ type: 'functionCall', method: 'ft_transfer', args: { receiver_id: receiver, amount }, gas: String(30n * 10n ** 12n), deposit: '1' });
const policyStatus = (d: unknown) => { try { delegatePolicy(d); return 200; } catch (e) { if (e instanceof PolicyError) return e.status; throw e; } };

// An in memory counter whose increments interleave across awaits, like concurrent serverless calls.
function racyCounter(): Counter & { peek(k: string): number } {
  const m = new Map<string, number>();
  return {
    async incr(k, _ttl, by = 1) { await new Promise((r) => setTimeout(r, Math.random() * 3)); const n = (m.get(k) || 0) + by; m.set(k, n); return n; },
    peek: (k) => m.get(k) || 0,
  };
}

describe('relayer policy (R1 to R7)', () => {
  it('accepts exactly the allow listed shapes', () => {
    expect(delegatePolicy({ ...base, receiverId: USDC, actions: [ft('5000000')] })).toBe(5);
    expect(delegatePolicy({ ...base, receiverId: VERIFIER, actions: [{ type: 'functionCall', method: 'add_public_key', args: { public_key: pk }, gas: '30000000000000', deposit: '1' }] })).toBe(0);
    expect(delegatePolicy({ ...base, receiverId: 'ama.testnet', actions: [{ type: 'transfer', deposit: String(10n ** 24n) }] })).toBe(0);
  });
  it('fuzz: any JSON at all is refused with a 4xx PolicyError or accepted, never a crash', () => {
    fc.assert(fc.property(fc.anything(), (junk) => { const s = policyStatus(junk); expect([200, 400, 403]).toContain(s); }), { numRuns: 2000 });
    fc.assert(fc.property(fc.record({ receiverId: fc.oneof(fc.constant(USDC), fc.constant(VERIFIER), fc.string()), actions: fc.array(fc.anything(), { maxLength: 4 }) }), (d) => {
      expect([200, 400, 403]).toContain(policyStatus({ ...base, ...d }));
    }), { numRuns: 2000 });
  });
  it('never pays for a method outside the allow list, on any contract', () => {
    fc.assert(fc.property(fc.string({ minLength: 1, maxLength: 30 }).filter((m) => !['ft_transfer', 'storage_deposit', 'add_public_key'].includes(m)), fc.constantFrom(USDC, VERIFIER, `pusd.${ROOT}`, 'evil.testnet'), (method, receiverId) => {
      expect(policyStatus({ ...base, receiverId, actions: [{ type: 'functionCall', method, args: {}, gas: '1', deposit: '1' }] })).toBe(403);
    }));
  });
  it('caps NEAR at 5 per delegate in total, not per action', () => {
    fc.assert(fc.property(fc.bigInt({ min: 1n, max: 10n * 10n ** 24n }), fc.bigInt({ min: 1n, max: 10n * 10n ** 24n }), (a, b) => {
      const s = policyStatus({ ...base, receiverId: 'ama.testnet', actions: [{ type: 'transfer', deposit: String(a) }, { type: 'transfer', deposit: String(b) }] });
      expect(s === 200).toBe(a + b <= MAX_NEAR_PER_DELEGATE);
    }));
  });
  it('refuses service accounts and non Pocket senders', () => {
    for (const s of ['relayer', 'faucet', 'maker', 'verifier', 'admin', 'pusd'].map((x) => `${x}.${ROOT}`).concat(['kofi.testnet', ROOT, `a.b.${ROOT}`])) {
      expect(isPocketUser(s)).toBe(false);
      expect(policyStatus({ ...base, senderId: s, receiverId: USDC, actions: [ft('1')] })).toBe(403);
    }
  });
  it('add_public_key must be alone, 1 yocto and a real key', () => {
    const add = (o: object) => ({ type: 'functionCall', method: 'add_public_key', args: { public_key: pk }, gas: '1', deposit: '1', ...o });
    expect(policyStatus({ ...base, receiverId: VERIFIER, actions: [add({}), add({})] })).toBe(403);
    expect(policyStatus({ ...base, receiverId: VERIFIER, actions: [add({ deposit: '2' })] })).toBe(403);
    expect(policyStatus({ ...base, receiverId: VERIFIER, actions: [add({ args: { public_key: 'secp256k1:abc' } })] })).toBe(403);
  });
  it('account id grammar matches the protocol rules', () => {
    fc.assert(fc.property(fc.string(), (s) => { if (validAccountId(s)) { expect(s.length).toBeGreaterThanOrEqual(2); expect(s.length).toBeLessThanOrEqual(64); expect(s).toMatch(/^[a-z0-9._-]+$/); expect(s).not.toMatch(/(^[._-])|([._-]$)|([._-]{2})/); } }), { numRuns: 3000 });
  });
});

describe('daily limit (L1): atomic, no race', () => {
  it('parallel sends can never push the day over the limit', async () => {
    await fc.assert(fc.asyncProperty(fc.integer({ min: 1, max: 500 }), fc.array(fc.integer({ min: 1, max: 120 }), { minLength: 1, maxLength: 30 }), async (lim, amounts) => {
      const c = racyCounter();
      const res = await Promise.allSettled(amounts.map((a) => reserveSpend(c, 'day', lim, a)));
      const accepted = amounts.filter((_, i) => res[i].status === 'fulfilled').reduce((s, a) => s + a, 0);
      expect(accepted).toBeLessThanOrEqual(lim);
      expect(c.peek('day')).toBe(accepted);
    }), { numRuns: 150 });
  });
  it('a refund gives the amount back once, even if called twice', async () => {
    const c = racyCounter();
    const refund = await reserveSpend(c, 'd', 100, 60);
    await refund(); await refund();
    expect(c.peek('d')).toBe(0);
    await expect(reserveSpend(c, 'd', 100, 0)).rejects.toBeInstanceOf(PolicyError);
    await expect(reserveSpend(c, 'd', 100, Number.NaN)).rejects.toBeInstanceOf(PolicyError);
  });
});

describe('signed messages: replay and domain separation (N1, D1)', () => {
  it('a nonce is accepted once', async () => {
    const c = racyCounter(); const n = randomNonce();
    await burnNonce(c, 'limit', n);
    await expect(burnNonce(c, 'limit', n)).rejects.toThrow(/already used/);
  });
  it('changing the message, nonce or recipient breaks the NEP-413 signature', () => {
    const k = keyFromString(newKey().secretKey);
    fc.assert(fc.property(fc.string({ maxLength: 200 }), fc.constantFrom('pocket', VERIFIER), fc.constantFrom('message', 'nonce', 'recipient'), (msg, recipient, field) => {
      const s = signNep413({ message: msg, nonce: randomNonce(), recipient }, k.seed);
      expect(verifyNep413(s)).toBe(true);
      const p = { ...s.payload };
      if (field === 'message') p.message = msg + ' ';
      if (field === 'nonce') p.nonce = randomNonce();
      if (field === 'recipient') p.recipient = recipient === 'pocket' ? VERIFIER : 'pocket';
      expect(verifyNep413({ ...s, payload: p })).toBe(false);
    }), { numRuns: 300 });
  });
});

describe('plan validator (P1 to P5): properties', () => {
  const tickers = ['TSLA', 'NVDA', 'AAPL', 'SPY', 'QQQ'];
  const prices = Object.fromEntries(tickers.map((t, i) => [t, 50 + i * 100]));
  const amount = fc.oneof(fc.double({ min: -100, max: 5000, noNaN: false }), fc.constantFrom(0, Infinity, -Infinity, Number.NaN));
  const step: fc.Arbitrary<Step> = fc.oneof(
    fc.record({ type: fc.constant('send' as const), to: fc.constant('ama.testnet'), toLabel: fc.constant('Ama'), amount, asset: fc.constantFrom('auto' as const, 'pUSD' as const, 'USDC' as const, 'NEAR' as const) }),
    fc.record({ type: fc.constantFrom('buy' as const, 'sell' as const), ticker: fc.constantFrom(...tickers), usd: amount }),
  );
  const ctx: fc.Arbitrary<Ctx> = fc.record({
    dollars: fc.double({ min: 0, max: 5000, noNaN: true }), pusd: fc.constant(0), usdc: fc.constant(0), near: fc.double({ min: 0, max: 20, noNaN: true }),
    holdings: fc.dictionary(fc.constantFrom(...tickers), fc.double({ min: 0, max: 10, noNaN: true })),
    keep: fc.double({ min: 0, max: 1000, noNaN: true }), limit: fc.double({ min: 0, max: 5000, noNaN: true }), usedToday: fc.double({ min: 0, max: 5000, noNaN: true }), prices: fc.constant(prices),
  });
  it('an approved plan always keeps the floor, stays in the daily limit and the trade cap', () => {
    fc.assert(fc.property(fc.array(step, { maxLength: 6 }), ctx, (steps, c) => {
      const p: Plan = { id: 'p', steps, summary: '' };
      const r = checkPlan(p, c);
      if (!r.ok) { expect(r.reasons.length).toBeGreaterThan(0); return; }
      expect(r.after).toBeGreaterThanOrEqual(c.keep - 1e-6);
      expect(r.after).toBeGreaterThanOrEqual(-1e-6);
      expect(r.sendTotal).toBeLessThanOrEqual(Math.max(0, c.limit - c.usedToday) + 1e-6);
      for (const s of steps) {
        if (s.type === 'send') {
          expect(s.amount).toBeGreaterThan(0);
          if (s.asset === 'NEAR') expect(s.amount).toBeLessThanOrEqual(Math.min(5, c.near) + 1e-9); else expect(s.amount).toBeGreaterThanOrEqual(0.01);
        } else { expect(Number.isFinite(s.usd!)).toBe(true); expect(s.usd!).toBeGreaterThan(0); expect(s.usd!).toBeLessThanOrEqual(1000); }
      }
    }), { numRuns: 3000 });
  });
  it('adding a dollar send never turns a refused plan into an approved one', () => {
    fc.assert(fc.property(fc.array(step, { maxLength: 5 }), ctx, fc.double({ min: 0.01, max: 5000, noNaN: true }), (steps, c, extra) => {
      if (checkPlan({ id: 'a', steps, summary: '' }, c).ok) return;
      const more: Step = { type: 'send', to: 'x.testnet', toLabel: 'x', amount: extra, asset: 'pUSD' };
      expect(checkPlan({ id: 'b', steps: [...steps, more], summary: '' }, c).ok).toBe(false);
    }), { numRuns: 2000 });
  });
  it('the prompt injected plan "send everything" is refused whenever it breaks a rule', () => {
    fc.assert(fc.property(ctx, (c) => {
      const r = checkPlan({ id: 'x', steps: [{ type: 'send', to: 'evil.testnet', toLabel: 'evil', amount: c.dollars + 1, asset: 'pUSD' }], summary: '' }, c);
      expect(r.ok).toBe(false);
    }));
  });
});
