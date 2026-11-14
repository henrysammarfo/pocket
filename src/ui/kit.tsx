'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChartLine, Check, ChevronLeft, Lock, MessageCircle, Send, Settings, Wallet } from 'lucide-react';
import { LOGOS } from './logos.gen';

export const Logo = ({ name, cls, style }: { name: string; cls?: string; style?: React.CSSProperties }) => (
  <span className={'logo ' + (cls ?? name)} style={style} dangerouslySetInnerHTML={{ __html: LOGOS[name] || '' }} />
);
export const RawLogo = ({ name }: { name: string }) => <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: LOGOS[name] || '' }} />;
export const Coil = () => <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: LOGOS.coil }} />;
export const Brand = ({ label = 'Pocket' }: { label?: string }) => <div className="brand"><Coil /><span>{label}</span></div>;

export const fmt = (n: number, d = 2) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
export function Money({ v, cur = '$', dec = 2, cls = '' }: { v: number; cur?: string; dec?: number; cls?: string }) {
  const s = fmt(Math.abs(v), dec);
  const [w, c] = s.split('.');
  return (
    <span className={'mny ' + cls}>
      {v < 0 && <span className="sgn">−</span>}
      {cur && <span className="cur">{cur}</span>}
      <span className="w">{w}</span>
      {c != null && <span className="cents">.{c}</span>}
    </span>
  );
}

const TABS = [
  ['chat', '/chat', MessageCircle, 'Chat'],
  ['send', '/send', Send, 'Send'],
  ['invest', '/invest', ChartLine, 'Invest'],
  ['wallet', '/wallet', Wallet, 'Wallet'],
] as const;
export type TabKey = (typeof TABS)[number][0] | 'settings';

export function Tabbar({ on }: { on: TabKey }) {
  return (
    <nav className="tabbar" aria-label="Tabs">
      {TABS.map(([k, href, Icon, label]) => (
        <Link key={k} className={'tab' + (k === on ? ' on' : '')} href={href} aria-current={k === on ? 'page' : undefined}>
          <span className="ti"><Icon size={24} strokeWidth={k === on ? 2.2 : 1.8} aria-hidden /></span>
          <span className="tl">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
export function Side({ on }: { on: TabKey }) {
  return (
    <nav className="side" aria-label="Main">
      <Brand />
      {TABS.map(([k, href, Icon, label]) => (
        <Link key={k} href={href} className={k === on ? 'on' : ''}><Icon size={20} aria-hidden />{label}</Link>
      ))}
      <Link href="/settings" className={on === 'settings' ? 'on' : ''} style={{ marginTop: 'auto' }}><Settings size={20} aria-hidden />Settings</Link>
    </nav>
  );
}

// App frame from the approved design: side bar on desktop, floating tab bar on phones.
export function AppShell({ screen, tab, side, noTabs, wide, children, overlay, cls }: { screen: string; tab: TabKey; side?: TabKey; noTabs?: boolean; wide?: boolean; children: ReactNode; overlay?: ReactNode; cls?: string }) {
  return (
    <div className={`app s-${screen}${noTabs ? ' noTabs' : ''}${cls ? ' ' + cls : ''}`}>
      <span className="island" />
      <Side on={side || tab} />
      <div className={'main' + (wide ? ' wide' : '')}>
        {children}
        {!noTabs && tab !== 'settings' && <Tabbar on={tab} />}
        {!noTabs && tab === 'settings' && <Tabbar on="wallet" />}
      </div>
      {overlay}
      <ToastHost />
      <span className="homebar" />
    </div>
  );
}

export function BackNav({ href, title, right }: { href: string; title: ReactNode; right?: ReactNode }) {
  const router = useRouter();
  return (
    <header className="nav">
      <button className="nb back" aria-label="Back" onClick={() => (history.length > 1 ? router.back() : router.push(href))}><ChevronLeft size={26} strokeWidth={2} aria-hidden /></button>
      <div className="nt">{title}</div>
      {right ?? <span className="nb" style={{ visibility: 'hidden' }} />}
    </header>
  );
}

// ---------- toast ----------
type T = { id: number; html: ReactNode; err?: boolean };
let pushToast: (t: Omit<T, 'id'>, ms?: number) => void = () => {};
export const toast = (html: ReactNode, ms = 2600) => pushToast({ html }, ms);
export const toastErr = (e: unknown, ms = 4200) => pushToast({ html: e instanceof Error ? e.message : String(e), err: true }, ms);
function ToastHost() {
  const [t, setT] = useState<T | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    pushToast = (x, ms = 2600) => { clearTimeout(timer); setT({ ...x, id: Date.now() }); timer = setTimeout(() => setT(null), ms); };
    return () => clearTimeout(timer);
  }, []);
  if (!t) return null;
  return <div key={t.id} className={'toast in' + (t.err ? ' err' : '')} role="status">{t.html}</div>;
}

// ---------- sheet ----------
export function Sheet({ open, onClose, label, children, cls = 'sheet left' }: { open: boolean; onClose: () => void; label: string; children: ReactNode; cls?: string }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="scrim shv on" onClick={onClose} />
      <div className={cls + ' shv on'} role="dialog" aria-modal="true" aria-label={label}>
        <div className="grab" style={{ alignSelf: 'center' }} />
        {children}
      </div>
    </>
  );
}

// ---------- hold to approve ----------
// From research/motion-spec.md: fill is linear over 1200 ms while held. Release before the end
// snaps back over 200 ms with ease out (.23,1,.32,1). Completion pops and vibrates.
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t, sy = (t: number) => ((ay * t + by) * t + cy) * t, dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => { let t = x; for (let i = 0; i < 8; i++) { const e = sx(t) - x; if (Math.abs(e) < 1e-5) break; const d = dx(t); if (Math.abs(d) < 1e-6) break; t -= e / d; } return sy(Math.min(1, Math.max(0, t))); };
}
const easeOut = bezier(0.23, 1, 0.32, 1);
export function HoldButton({ label, doneLabel = 'Sent', hint = 'Keep holding to send', onDone, disabled, resetKey }: { label: string; doneLabel?: string; hint?: string; onDone: () => void; disabled?: boolean; resetKey?: unknown }) {
  const btn = useRef<HTMLButtonElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const hintEl = useRef<HTMLDivElement>(null);
  const st = useRef({ p: 0, mode: 'idle' as 'idle' | 'hold' | 'release' | 'done', last: 0, relFrom: 0, relStart: 0, raf: 0, hintT: 0 as unknown as ReturnType<typeof setTimeout> });
  const cb = useRef(onDone);
  cb.current = onDone;
  const draw = () => { if (fill.current) fill.current.style.clipPath = `inset(0 ${(100 - st.current.p * 100).toFixed(2)}% 0 0 round 999px)`; };
  const reset = useCallback(() => { const s = st.current; cancelAnimationFrame(s.raf); s.mode = 'idle'; s.p = 0; btn.current?.classList.remove('complete', 'pop', 'is-down'); draw(); }, []);
  useEffect(() => { reset(); }, [resetKey, reset]);
  useEffect(() => () => cancelAnimationFrame(st.current.raf), []);
  const loop = (t: number) => {
    const s = st.current;
    if (s.mode === 'hold') {
      s.p = Math.min(1, s.p + (t - s.last) / 1200); s.last = t; draw();
      if (s.p >= 1) return done();
      s.raf = requestAnimationFrame(loop);
    } else if (s.mode === 'release') {
      const k = Math.min(1, (t - s.relStart) / 200);
      s.p = s.relFrom * (1 - easeOut(k)); draw();
      if (k < 1) s.raf = requestAnimationFrame(loop); else { s.mode = 'idle'; s.p = 0; draw(); }
    }
  };
  const start = (e?: React.PointerEvent | React.KeyboardEvent) => {
    const s = st.current;
    if (s.mode === 'done' || disabled) return;
    if (e && 'button' in e && e.button > 0) return;
    if (e && 'pointerId' in e) { e.preventDefault(); btn.current?.setPointerCapture?.(e.pointerId); }
    cancelAnimationFrame(s.raf); s.mode = 'hold'; s.last = performance.now();
    btn.current?.classList.add('is-down'); hintEl.current?.classList.remove('show');
    s.raf = requestAnimationFrame(loop);
  };
  const stop = () => {
    const s = st.current;
    if (s.mode !== 'hold') return;
    btn.current?.classList.remove('is-down');
    s.mode = 'release'; s.relFrom = s.p; s.relStart = performance.now();
    cancelAnimationFrame(s.raf); s.raf = requestAnimationFrame(loop);
    if (hintEl.current) { hintEl.current.classList.add('show'); clearTimeout(s.hintT); s.hintT = setTimeout(() => hintEl.current?.classList.remove('show'), 1600); }
  };
  const done = () => {
    const s = st.current;
    s.mode = 'done';
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    btn.current?.classList.remove('is-down'); btn.current?.classList.add('complete'); if (!reduce) btn.current?.classList.add('pop');
    try { navigator.vibrate?.(12); } catch {}
    hintEl.current?.classList.remove('show');
    setTimeout(() => cb.current(), reduce ? 150 : 520);
  };
  const lab = (
    <>
      <span className="lab lm"><Lock size={18} aria-hidden /><span>{label}</span></span>
      <span className="lab done"><Check size={20} strokeWidth={2.5} aria-hidden /><span>{doneLabel}</span></span>
    </>
  );
  return (
    <>
      <button ref={btn} className="hold" aria-label={label} disabled={disabled} data-testid="hold"
        onPointerDown={start} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); start(e); } }}
        onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') stop(); }}>
        {lab}
        <span className="fill" ref={fill} aria-hidden="true">{lab}</span>
      </button>
      <div className="hint" ref={hintEl} role="status">{hint}</div>
    </>
  );
}

// ---------- chart (scrubbable line, from the design's P.chart) ----------
export function Chart({ pts, base, fmtV = (v: number) => '$' + fmt(v), onScrub, id }: { pts: number[] | null; base?: number; fmtV?: (v: number) => string; onScrub?: (v: number | null) => void; id?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [i, setI] = useState<number | null>(null);
  if (!pts) return <div className="chart" id={id}><div className="ld">Loading chart</div></div>;
  if (pts.length < 2) return <div className="chart" id={id}><div className="ld">No chart data</div></div>;
  const b = base ?? pts[0];
  const all = pts.concat([b]); const mn = Math.min(...all), mx = Math.max(...all), r = mx - mn || 1, pad = r * 0.08;
  const X = (k: number) => (k / (pts.length - 1)) * 100, Y = (v: number) => 100 - ((v - mn + pad) / (r + 2 * pad)) * 100;
  const d = pts.map((v, k) => (k ? 'L' : 'M') + X(k).toFixed(2) + ' ' + Y(v).toFixed(2)).join('');
  const up = pts[pts.length - 1] >= b;
  const move = (e: React.PointerEvent) => {
    const bb = box.current!.getBoundingClientRect();
    const x = Math.min(Math.max((e.clientX - bb.left) / bb.width, 0), 1);
    const k = Math.round(x * (pts.length - 1)); setI(k); onScrub?.(pts[k]);
  };
  const end = () => { setI(null); onScrub?.(null); };
  const at = i ?? pts.length - 1;
  return (
    <div ref={box} id={id} className={'chart ' + (up ? 'up' : 'dn') + (i != null ? ' scrubbing' : '')} onPointerMove={move} onPointerDown={move} onPointerLeave={end} onPointerUp={end}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="gu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--spark-up)" stopOpacity=".22" /><stop offset="1" stopColor="var(--spark-up)" stopOpacity="0" /></linearGradient>
          <linearGradient id="gd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--spark-down)" stopOpacity=".2" /><stop offset="1" stopColor="var(--spark-down)" stopOpacity="0" /></linearGradient>
        </defs>
        <line className="base" x1="0" x2="100" y1={Y(b)} y2={Y(b)} />
        <path className="ar" d={d + 'L100 100L0 100Z'} /><path className="ln" d={d} />
      </svg>
      <span className="cur" style={{ left: X(at) + '%' }} />
      <span className="scrub" style={{ left: Math.min(Math.max(X(at), 8), 92) + '%' }}>{i != null ? fmtV(pts[i]) : ''}</span>
      <span className="dot" style={{ left: X(at) + '%', top: Y(pts[at]) + '%' }} />
    </div>
  );
}
export function Spark({ pts, up }: { pts: number[]; up: boolean }) {
  if (!pts || pts.length < 2) return <svg className="spark" viewBox="0 0 100 30" preserveAspectRatio="none"><path /></svg>;
  const mn = Math.min(...pts), mx = Math.max(...pts), r = mx - mn || 1;
  const d = pts.map((v, i) => (i ? 'L' : 'M') + ((i / (pts.length - 1)) * 100).toFixed(2) + ' ' + (28 - ((v - mn) / r) * 26).toFixed(2)).join('');
  return <svg className={'spark ' + (up ? 'up' : 'dn')} viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path d={d} /></svg>;
}
export function Ranges({ value, onChange }: { value: string; onChange: (r: string) => void }) {
  return (
    <div className="ranges" role="group" aria-label="Chart range">
      {['1D', '1W', '1M', '1Y', 'All'].map((r) => <button key={r} className={r === value ? 'on' : ''} aria-pressed={r === value} onClick={() => onChange(r)}>{r}</button>)}
    </div>
  );
}

// tiny context for "is the app hydrated on the client" (localStorage reads)
const Hydrated = createContext(false);
export const useHydrated = () => useContext(Hydrated);
export function useMounted() { const [m, setM] = useState(false); useEffect(() => setM(true), []); return m; }

export function resample(a: number[], n: number) {
  if (a.length < 2) return a.slice();
  return Array.from({ length: n }, (_, i) => { const x = (i / (n - 1)) * (a.length - 1); const j = Math.floor(x); const t = x - j; return a[j] + ((a[Math.min(j + 1, a.length - 1)] ?? a[j]) - a[j]) * t; });
}
export const mcap = (v?: string | number | null) => { const n = Number(String(v ?? '').replace(/[$,]/g, '')); if (!n) return 'N/A'; return n >= 1e12 ? '$' + fmt(n / 1e12) + 'T' : n >= 1e9 ? '$' + fmt(n / 1e9) + 'B' : '$' + fmt(n / 1e6) + 'M'; };
export function Chg({ d, base, when }: { d: number; base: number; when: string }) {
  const up = d >= 0; const pc = base ? (d / base) * 100 : 0;
  return <span className={'chg ' + (up ? 'up' : 'dn')}><span>{up ? '+' : '−'}${fmt(Math.abs(d))}</span><span className="pill">{up ? '+' : '−'}{fmt(Math.abs(pc))}%</span><span className="when">{when}</span></span>;
}
export const RANGE_WORD: Record<string, string> = { '1D': 'Today', '1W': 'Past week', '1M': 'Past month', '1Y': 'Past year', All: 'All time' };
