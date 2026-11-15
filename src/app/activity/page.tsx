'use client';
import { Download } from 'lucide-react';
import { AppShell, BackNav, toast, toastErr } from '@/ui/kit';
import { Gate } from '@/ui/Gate';
import { ActivityList, useActivity } from '@/ui/Activity';
import { downloadReceiptsCsv } from '@/lib/client/api';

function CsvButton() {
  const { items } = useActivity();
  return <button className="nb" aria-label="Download receipts as CSV" title="Download receipts as CSV" disabled={!items.length}
    onClick={() => { try { downloadReceiptsCsv(items); toast(`Saved ${items.length} receipts as CSV`); } catch (e) { toastErr(e); } }}><Download size={20} aria-hidden /></button>;
}
export default function Page() {
  return <Gate><AppShell screen="activity" tab="wallet"><BackNav href="/wallet" title="Activity" right={<CsvButton />} /><main className="body"><ActivityList max={200} /><div className="src">Every row opens a receipt rebuilt from NEAR testnet. The download button saves them all as a CSV file with links to each receipt and to NearBlocks.</div></main></AppShell></Gate>;
}
