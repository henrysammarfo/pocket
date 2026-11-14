'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMounted } from '@/ui/kit';
import { useSession } from '@/lib/client/session';

// Signed in? The buttons open the app. Opened from the home screen as an installed app? Go straight in.
export function Cta({ label = 'Create your Pocket', cls = 'btn big' }: { label?: string; cls?: string }) {
  const s = useSession(); const m = useMounted();
  return <a className={cls} href={m && s ? '/chat' : '/welcome'}>{m && s ? `Open Pocket as @${s.username}` : label}</a>;
}
export function StandaloneGate() {
  const s = useSession(); const m = useMounted(); const r = useRouter();
  useEffect(() => { if (m && s && matchMedia('(display-mode: standalone)').matches) r.replace('/chat'); }, [m, s, r]);
  return null;
}
// Reveal sections as they scroll in. Pure CSS does the motion; this only adds a class.
export function Reveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.rv');
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    els.forEach((e) => io.observe(e)); return () => io.disconnect();
  }, []);
  return null;
}
