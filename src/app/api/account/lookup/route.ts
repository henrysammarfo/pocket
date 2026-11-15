import { handler } from '@/lib/server/http';
import { viewAccount } from '@/lib/shared/rpc';
import { ROOT } from '@/lib/shared/deployment';
import { validAccountId } from '@/lib/server/pool';
export const dynamic = 'force-dynamic';
// Resolve @username or a NEAR testnet account and say whether it exists.
export const GET = handler(async (req) => {
  const q = (new URL(req.url).searchParams.get('q') || '').trim().toLowerCase().replace(/^@/, '');
  const account = q.endsWith('.testnet') || /^[a-f0-9]{64}$/.test(q) ? q : `${q}.${ROOT}`; // 64 hex characters is a NEAR implicit account
  if (!validAccountId(account)) return { account, exists: false, pocket: false };
  return { account, exists: !!(await viewAccount(account)), pocket: account.endsWith('.' + ROOT) };
});
