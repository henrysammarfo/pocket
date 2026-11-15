'use client';
// Request status: Pending, Paid or Refunded.
export function StatusChip({ status }: { status: string }) {
  const c = status === 'paid' ? 'ok' : status === 'refunded' ? '' : 'warn';
  return <span className={'chip ' + c} data-status={status}>{status === 'paid' ? 'Paid' : status === 'refunded' ? 'Refunded' : 'Pending'}</span>;
}
