import 'server-only';
// Who is asking. The browser signs a short NEP-413 "session" message with its device key
// (recipient "pocket", action pocket.session, expires within 24 h). We check the signature and
// that the key is a full access key of the account on NEAR testnet. Cached for 10 minutes.
import { verifyNep413, type SignedNep413 } from '../shared/nep413';
import { assertKeyOf, isPocketUser } from './pool';
import { HttpError } from './store';

const cache = new Map<string, { account: string; until: number }>();
export async function sessionOf(req: Request, required = true): Promise<string | null> {
  const h = req.headers.get('x-pocket-session');
  if (!h) { if (required) throw new HttpError(401, 'Sign in first.'); return null; }
  const hit = cache.get(h);
  if (hit && hit.until > Date.now()) return hit.account;
  let s: SignedNep413;
  try { s = JSON.parse(Buffer.from(h, 'base64').toString('utf8')); } catch { throw new HttpError(401, 'Bad session.'); }
  if (!verifyNep413(s) || s.payload.recipient !== 'pocket') throw new HttpError(401, 'Bad session signature.');
  let m: { action?: string; account?: string; exp?: number };
  try { m = JSON.parse(s.payload.message); } catch { throw new HttpError(401, 'Bad session.'); }
  if (m.action !== 'pocket.session' || !m.account || !m.exp || m.exp < Date.now() || m.exp > Date.now() + 25 * 3600e3) throw new HttpError(401, 'Session expired.');
  if (!isPocketUser(m.account)) throw new HttpError(403, 'Not a Pocket account.');
  await assertKeyOf(m.account, s.public_key);
  cache.set(h, { account: m.account, until: Math.min(m.exp, Date.now() + 600e3) });
  if (cache.size > 5000) cache.clear();
  return m.account;
}
