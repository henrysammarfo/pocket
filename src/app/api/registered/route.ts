import { handler } from '@/lib/server/http';
import { view } from '@/lib/shared/rpc';
import { USDC } from '@/lib/shared/deployment';
import { validAccountId } from '@/lib/server/pool';
import { HttpError } from '@/lib/server/store';
export const dynamic = 'force-dynamic';
export const GET = handler(async (req) => {
  const a = new URL(req.url).searchParams.get('account') || '';
  if (!validAccountId(a)) throw new HttpError(400, 'Bad account');
  return { registered: !!(await view(USDC, 'storage_balance_of', { account_id: a }).catch(() => null)) };
});
