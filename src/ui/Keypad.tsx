'use client';
import { Delete } from 'lucide-react';
export function press(cur: string, k: string, dec = 2) {
  if (k === 'del') return cur.slice(0, -1);
  if (k === '.') return cur.includes('.') ? cur : (cur || '0') + '.';
  const n = cur === '0' ? k : cur + k;
  const [, f] = n.split('.');
  if (f && f.length > dec) return cur;
  if (n.replace('.', '').length > 9) return cur;
  return n;
}
export function Keypad({ onKey }: { onKey: (k: string) => void }) {
  return (
    <div className="keys">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((k) => <button key={k} onClick={() => onKey(k)}>{k}</button>)}
      <button aria-label="Delete" onClick={() => onKey('del')}><Delete size={24} strokeWidth={1.8} aria-hidden /></button>
    </div>
  );
}
