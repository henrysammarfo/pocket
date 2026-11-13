'use client';
import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/client/session';
import { useMounted } from './kit';

// Pages that need an account send people to /welcome first.
export function Gate({ children }: { children: ReactNode }) {
  const s = useSession();
  const m = useMounted();
  const router = useRouter();
  useEffect(() => { if (m && !s) router.replace('/welcome?next=' + encodeURIComponent(location.pathname + location.search)); }, [m, s, router]);
  if (!m || !s) return <div className="app"><div className="main"><main className="body" aria-busy="true"><div className="skel" style={{ height: '8rem', marginTop: '4rem' }} /><div className="skel" style={{ height: '3rem' }} /><div className="skel" style={{ height: '3rem' }} /></main></div></div>;
  return <>{children}</>;
}
