'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/client/session';
import { useMounted } from '@/ui/kit';
export default function Home() {
  const s = useSession(); const m = useMounted(); const r = useRouter();
  useEffect(() => { if (m) r.replace(s ? '/chat' : '/welcome'); }, [m, s, r]);
  return null;
}
