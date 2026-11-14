'use client';
import { AppShell, BackNav } from '@/ui/kit';
import { Gate } from '@/ui/Gate';
import { ActivityList } from '@/ui/Activity';
export default function Page() {
  return <Gate><AppShell screen="activity" tab="wallet"><BackNav href="/wallet" title="Activity" /><main className="body"><ActivityList max={200} /><div className="src">Every row opens a receipt rebuilt from NEAR testnet.</div></main></AppShell></Gate>;
}
