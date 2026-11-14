'use client';
import { useEffect, useState } from 'react';
import { sha256 } from '@noble/hashes/sha2.js';
import { useProfile, useSession } from '@/lib/client/session';
import { EMOJI, KITS, emo, jersey } from './avatars';

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
export const gravatarUrl = (email: string, size = 128) => `https://gravatar.com/avatar/${hex(sha256(new TextEncoder().encode(email.trim().toLowerCase())))}?s=${size * 2}&d=404`;
export const initialsOf = (n: string) => (n.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2) || '?').toUpperCase();

export function AvatarFor({ value, email, name, size = 36, cls = '' }: { value: string; email?: string; name: string; size?: number; cls?: string }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [email]);
  const st = { width: size, height: size, borderRadius: '50%', overflow: 'hidden', display: 'inline-grid', placeItems: 'center', flex: 'none' } as const;
  if (value.startsWith('kit:')) { const k = KITS.find((x) => x.id === value.slice(4)) || KITS[0]; return <span className={cls} style={st} dangerouslySetInnerHTML={{ __html: jersey(k, { size }) }} />; }
  if (value.startsWith('emo:')) { const e = EMOJI[Number(value.slice(4))] || EMOJI[0]; return <span className={cls} style={st} dangerouslySetInnerHTML={{ __html: emo(e, size) }} />; }
  if (email && email.includes('@') && !bad) {
    // eslint-disable-next-line @next/next/no-img-element
    return <span className={cls} style={st}><img src={gravatarUrl(email, size)} width={size} height={size} alt="" onError={() => setBad(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></span>;
  }
  return <span className={cls + ' av'} style={{ ...st, background: 'var(--accent-soft)', color: 'var(--accent-text)', fontWeight: 700, fontSize: Math.round(size * 0.38) }}>{initialsOf(name)}</span>;
}
export function Avatar({ size = 36, cls = '' }: { size?: number; cls?: string }) {
  const p = useProfile(); const s = useSession();
  return <AvatarFor value={p.avatar} email={p.email} name={p.name || s?.username || '?'} size={size} cls={cls} />;
}
