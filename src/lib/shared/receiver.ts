// SPDX-License-Identifier: MIT
// Receiver check. Before a send, Pocket looks at who will get the money and answers allow, warn or block,
// with plain reasons. Pure function over facts gathered by the server (chain and activity) and the app
// (contacts), so every rule is unit tested. The server runs it again before relaying and refuses a block.
import { validAccountId } from './policy';

export type Verdict = 'allow' | 'warn' | 'block';
export type Reason = { code: string; level: Verdict; text: string };
export type ReceiverFacts = {
  from: string;
  to: string;
  root: string; // Pocket's root account, like pocket-7e2413.testnet
  services: string[]; // Pocket service and token contract accounts that must never receive a user send
  exists: boolean | null; // null when the chain could not be read
  isContract?: boolean; // the account has code that is not the Pocket wallet
  blocked?: string[]; // the sender's own block list (from the wallet contract)
  allowOnly?: string[]; // the sender's own allow only list (from the wallet contract)
  paidBefore?: string[]; // accounts the sender paid before
  contacts?: { name: string; account: string }[];
};
export type Check = { verdict: Verdict; reasons: Reason[]; to: string };

const IMPLICIT = /^[0-9a-f]{64}$/;
const ETH_IMPLICIT = /^0x[0-9a-f]{40}$/;
export const isImplicit = (a: string) => IMPLICIT.test(a) || ETH_IMPLICIT.test(a);

// Edit distance with an early exit, for lookalike names.
export function distance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev2 = prev; prev = cur;
  }
  return prev[b.length];
}
// Characters people swap to fake a name: 0 for o, 1 for l or i, 5 for s, rn for m, and so on.
export const skeleton = (s: string) => s.toLowerCase().replace(/rn/g, 'm').replace(/vv/g, 'w').replace(/[0]/g, 'o').replace(/[1|!]/g, 'l').replace(/i/g, 'l').replace(/5/g, 's').replace(/3/g, 'e').replace(/[_-]/g, '');
const label = (a: string, root: string) => (a.endsWith('.' + root) ? a.slice(0, -root.length - 1) : a.replace(/\.testnet$/, ''));

export function checkReceiver(f: ReceiverFacts): Check {
  const to = String(f.to || '').trim().toLowerCase();
  const reasons: Reason[] = [];
  const add = (level: Verdict, code: string, text: string) => reasons.push({ level, code, text });
  const done = (): Check => ({ to, reasons, verdict: reasons.some((r) => r.level === 'block') ? 'block' : reasons.some((r) => r.level === 'warn') ? 'warn' : 'allow' });

  if (!validAccountId(to)) { add('block', 'invalid', 'That is not a valid NEAR account name.'); return done(); }
  if (to === f.from) { add('block', 'self', 'That is your own account.'); return done(); }
  const implicit = isImplicit(to);
  if (!implicit && !to.endsWith('.testnet') && to !== 'testnet') { add('block', 'mainnet', 'That looks like a NEAR mainnet account. Pocket is testnet only, so the money would never arrive.'); return done(); }
  if (f.services.includes(to) || to === f.root) add('block', 'service', 'That is a Pocket system contract, not a person. Money sent there would be stuck.');
  if ((f.blocked || []).includes(to)) add('block', 'blocked', 'You blocked this account in your rules.');
  if ((f.allowOnly || []).length && !(f.allowOnly || []).includes(to)) add('block', 'not_allowed', 'Your rules only allow sends to your allowed list, and this account is not on it.');
  if (f.exists === false && !implicit) add('block', 'missing', 'This account does not exist on NEAR testnet.');
  if (reasons.some((r) => r.level === 'block')) return done();

  const contact = (f.contacts || []).find((c) => c.account === to);
  const paid = (f.paidBefore || []).includes(to);
  if (f.exists === null) add('warn', 'unknown', 'Pocket could not reach NEAR to check this account. Check the name carefully.');
  if (implicit && f.exists === false) add('warn', 'new_implicit', 'This address has never been used. Make sure it is copied exactly.');
  if (f.isContract) add('warn', 'contract', 'This is a smart contract, not a Pocket wallet. It may not be able to send money back.');
  if (!to.endsWith('.' + f.root) && !contact && !paid) add('warn', 'outside', 'This account is outside Pocket. Sends cannot be reversed.');
  if (!contact && !paid) {
    const mine = label(to, f.root);
    const known = [...(f.contacts || []).map((c) => ({ name: c.name, account: c.account })), ...(f.paidBefore || []).map((a) => ({ name: '', account: a }))];
    const look = known.find((k) => {
      if (k.account === to) return false;
      const theirs = label(k.account, f.root);
      return (mine.length >= 3 && distance(mine, theirs, 2) <= (theirs.length >= 6 ? 2 : 1)) || (skeleton(mine) === skeleton(theirs));
    });
    if (look) add('warn', 'lookalike', `This name looks like ${look.name ? look.name + ' (' + look.account + ')' : look.account}, someone you paid before. Scammers use names that are one letter off.`);
    add('warn', 'first_time', 'You have not paid this account before.');
  } else add('allow', 'known', contact ? `Saved contact: ${contact.name}.` : 'You paid this account before.');
  return done();
}
