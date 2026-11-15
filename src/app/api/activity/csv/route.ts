import { handler } from '@/lib/server/http';
import { sessionOf } from '@/lib/server/auth';
import { store } from '@/lib/server/store';
import { csvFileName, receiptsCsv } from '@/lib/shared/csv';
export const dynamic = 'force-dynamic';
// Your receipts as a CSV file. Needs your signed session, so nobody else can download your history.
export const GET = async (req: Request) => {
  try {
    const a = (await sessionOf(req))!;
    const csv = receiptsCsv(await store.activity(a, 1000), new URL(req.url).origin);
    return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${csvFileName(a)}"`, 'cache-control': 'no-store' } });
  } catch (e) { return handler(async () => { throw e; })(req); }
};
