// Receiver check: allow, warn or block with reasons, for every rule, plus properties over random names.
import { describe, expect, it } from 'vitest';
import { checkReceiver, distance, isImplicit, skeleton, type ReceiverFacts } from '@/lib/shared/receiver';

const ROOT = 'pocket-7e2413.testnet';
const ME = `ama.${ROOT}`;
const SERVICES = [ROOT, `verifier.${ROOT}`, `maker.${ROOT}`, `faucet.${ROOT}`, `relayer.${ROOT}`, `market.${ROOT}`, `admin.${ROOT}`, `pusd.${ROOT}`, `tslaon.${ROOT}`, 'usdc.fakes.testnet'];
const f = (to: string, x: Partial<ReceiverFacts> = {}): ReceiverFacts => ({ from: ME, to, root: ROOT, services: SERVICES, exists: true, ...x });
const codes = (x: Partial<ReceiverFacts> & { to: string }) => checkReceiver(f(x.to, x)).reasons.map((r) => r.code);
const verdict = (to: string, x: Partial<ReceiverFacts> = {}) => checkReceiver(f(to, x)).verdict;
const H64 = 'a'.repeat(64), ETH = '0x' + 'b'.repeat(40);

describe('blocks', () => {
  it('upper case is read as lower case, not refused', () => expect(checkReceiver(f('BOB.testnet')).to).toBe('bob.testnet'));
  it.each(['', ' ', 'a', 'has space.testnet', 'x'.repeat(65), 'bad..dots.testnet', '-lead.testnet', 'trail-.testnet', 'émile.testnet', 'a@b.testnet'])('invalid name %j', (to) => {
    const c = checkReceiver(f(to)); expect(c.verdict).toBe('block'); expect(c.reasons.map((x) => x.code)).toEqual(['invalid']);
  });
  it('your own account', () => expect(codes({ to: ME })).toEqual(['self']));
  it('your own account in upper case or with spaces', () => expect(codes({ to: ' AMA.' + ROOT.toUpperCase() + ' ' })).toEqual(['self']));
  it.each(['bob.near', 'alice.eth', 'foo.bar', 'binance.near', 'x.tg'])('mainnet or other network name %s', (to) => expect(codes({ to })).toEqual(['mainnet']));
  it.each(SERVICES)('Pocket system contract %s', (to) => expect(codes({ to })).toContain('service'));
  it('an account on your block list', () => expect(codes({ to: `bob.${ROOT}`, blocked: [`bob.${ROOT}`] })).toEqual(['blocked']));
  it('an account outside your allow only list', () => expect(codes({ to: `bob.${ROOT}`, allowOnly: [`mum.${ROOT}`] })).toEqual(['not_allowed']));
  it('a named account that does not exist', () => expect(codes({ to: 'ghost.testnet', exists: false })).toEqual(['missing']));
  it('several blocks are all listed', () => expect(codes({ to: `pusd.${ROOT}`, blocked: [`pusd.${ROOT}`], exists: false })).toEqual(['service', 'blocked', 'missing']));
  it('a block hides the softer warnings', () => expect(checkReceiver(f('ghost.testnet', { exists: false })).reasons.every((r) => r.level === 'block')).toBe(true));
});

describe('warnings', () => {
  it('a new Pocket user you never paid: first time only', () => { const c = checkReceiver(f(`kofi.${ROOT}`)); expect(c.verdict).toBe('warn'); expect(c.reasons.map((r) => r.code)).toEqual(['first_time']); });
  it('a plain testnet account outside Pocket', () => expect(codes({ to: 'bob.testnet' })).toEqual(['outside', 'first_time']));
  it('a smart contract that is not a Pocket wallet', () => expect(codes({ to: 'dex.testnet', isContract: true })).toContain('contract'));
  it('chain unreachable', () => expect(codes({ to: `kofi.${ROOT}`, exists: null })).toContain('unknown'));
  it.each([H64, ETH])('an unused implicit address %s warns instead of blocking', (to) => { expect(verdict(to, { exists: false })).toBe('warn'); expect(codes({ to, exists: false })).toContain('new_implicit'); });
  it.each([
    ['one letter changed', `mun.${ROOT}`, `mum.${ROOT}`],
    ['one letter added', `kwamee.${ROOT}`, `kwame.${ROOT}`],
    ['letters swapped', `kawme.${ROOT}`, `kwame.${ROOT}`],
    ['zero for o', `j0hn.${ROOT}`, `john.${ROOT}`],
    ['one for l', `a1ice.${ROOT}`, `alice.${ROOT}`],
    ['rn for m', `rnum.${ROOT}`, `mum.${ROOT}`],
    ['same name outside Pocket', 'kwame.testnet', `kwame.${ROOT}`],
    ['dash added', `kwa-me.${ROOT}`, `kwame.${ROOT}`],
  ])('lookalike: %s', (_n, to, known) => {
    expect(codes({ to, contacts: [{ name: 'Known', account: known }] })).toContain('lookalike');
    expect(codes({ to, paidBefore: [known] })).toContain('lookalike');
  });
  it('lookalike text names the contact', () => expect(checkReceiver(f(`mun.${ROOT}`, { contacts: [{ name: 'Mum', account: `mum.${ROOT}` }] })).reasons.find((r) => r.code === 'lookalike')?.text).toContain('Mum'));
  it.each([[`bob.${ROOT}`, `mum.${ROOT}`], [`kofi.${ROOT}`, `kwame.${ROOT}`], [`ab.${ROOT}`, `ax.${ROOT}`]])('not a lookalike: %s vs %s', (to, known) => expect(codes({ to, contacts: [{ name: 'K', account: known }] })).not.toContain('lookalike'));
});

describe('allows', () => {
  it('a saved contact', () => { const c = checkReceiver(f(`mum.${ROOT}`, { contacts: [{ name: 'Mum', account: `mum.${ROOT}` }] })); expect(c.verdict).toBe('allow'); expect(c.reasons[0].text).toContain('Mum'); });
  it('someone you paid before', () => expect(verdict(`kofi.${ROOT}`, { paidBefore: [`kofi.${ROOT}`] })).toBe('allow'));
  it('a known account outside Pocket', () => expect(verdict('bob.testnet', { paidBefore: ['bob.testnet'] })).toBe('allow'));
  it('an account on your allow only list that you paid before', () => expect(verdict(`mum.${ROOT}`, { allowOnly: [`mum.${ROOT}`], paidBefore: [`mum.${ROOT}`] })).toBe('allow'));
  it('a known contract still warns', () => expect(verdict('dex.testnet', { paidBefore: ['dex.testnet'], isContract: true })).toBe('warn'));
});

describe('properties over random names', () => {
  let s = 11; const r = () => ((s = (s * 48271) % 2147483647) / 2147483647);
  const name = () => Array.from({ length: 2 + Math.floor(r() * 10) }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(r() * 36)]).join('');
  it('verdict is block exactly when some reason is block, warn when some is warn (1000 cases)', () => {
    for (let i = 0; i < 1000; i++) {
      const to = r() < 0.7 ? `${name()}.${ROOT}` : r() < 0.5 ? `${name()}.testnet` : name() + '.near';
      const c = checkReceiver(f(to, { exists: r() < 0.8 ? true : r() < 0.5 ? false : null, isContract: r() < 0.1, blocked: r() < 0.1 ? [to] : [], paidBefore: r() < 0.3 ? [to] : [] }));
      const lv = c.reasons.map((x) => x.level);
      expect(c.verdict).toBe(lv.includes('block') ? 'block' : lv.includes('warn') ? 'warn' : 'allow');
      expect(c.reasons.length).toBeGreaterThan(0);
    }
  });
  it('your block list always wins, even over a saved contact (500 cases)', () => {
    for (let i = 0; i < 500; i++) { const to = `${name()}.${ROOT}`; expect(verdict(to, { blocked: [to], contacts: [{ name: 'C', account: to }] })).toBe('block'); }
  });
  it('an allow only list always blocks everyone not on it (500 cases)', () => {
    for (let i = 0; i < 500; i++) { const to = `${name()}x.${ROOT}`; expect(verdict(to, { allowOnly: [`mum.${ROOT}`], paidBefore: [to] })).toBe('block'); }
  });
  it('a saved contact that exists and is not a contract is always allowed (500 cases)', () => {
    for (let i = 0; i < 500; i++) { const to = `${name()}.${ROOT}`; expect(verdict(to, { contacts: [{ name: 'C', account: to }] })).toBe('allow'); }
  });
});

describe('helpers', () => {
  it.each([['kitten', 'sitting', 3], ['abc', 'abc', 0], ['abc', 'acb', 1], ['', 'abc', 3], ['mum', 'mun', 1], ['flaw', 'lawn', 2]])('distance(%s, %s) = %i', (a, b, d) => expect(distance(a, b, 3)).toBe(d));
  it('distance stops early past the max', () => expect(distance('a', 'abcdefgh', 2)).toBe(3));
  it('distance is symmetric (300 random pairs)', () => { let s = 5; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647); const w = () => Array.from({ length: Math.floor(r() * 8) }, () => 'abc'[Math.floor(r() * 3)]).join(''); for (let i = 0; i < 300; i++) { const a = w(), b = w(); expect(distance(a, b, 10)).toBe(distance(b, a, 10)); } });
  it.each([['j0hn', 'john'], ['a1ice', 'alice'], ['rnum', 'mum'], ['5am', 'sam'], ['kwa-me', 'kwame'], ['vvill', 'will']])('skeleton(%s) = skeleton(%s)', (a, b) => expect(skeleton(a)).toBe(skeleton(b)));
  it.each([[H64, true], [ETH, true], ['0x' + 'b'.repeat(39), false], ['A'.repeat(64), false], ['bob.testnet', false]])('isImplicit(%s) = %s', (a, want) => expect(isImplicit(a)).toBe(want));
});
