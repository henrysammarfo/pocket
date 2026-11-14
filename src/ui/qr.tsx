'use client';
import { useEffect, useRef, useState } from 'react';
import { ScanLine } from 'lucide-react';

// Your pay link as a QR code, drawn in the browser.
export function QrCode({ text, size = 200 }: { text: string; size?: number }) {
  const [svg, setSvg] = useState('');
  useEffect(() => { import('qrcode').then((Q) => Q.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b0d0c', light: '#ffffff' } })).then(setSvg).catch(() => setSvg('')); }, [text]);
  return <div className="qr" style={{ width: size, height: size }} role="img" aria-label="QR code of your pay link" dangerouslySetInnerHTML={{ __html: svg }} />;
}

// Read a Pocket pay link or a NEAR account out of a QR photo. Works on iPhone too: the camera opens
// through the file picker, and jsQR decodes the picture in the browser. Nothing is uploaded.
export function parseScan(t: string): { to: string; amt?: string } | null {
  const s = t.trim(); if (!s) return null;
  try {
    const u = new URL(s);
    const m = u.pathname.match(/^\/pay\/([a-z0-9_-]{2,32})\/?$/i);
    if (m) return { to: '@' + m[1].toLowerCase(), amt: u.searchParams.get('amt') || undefined };
    if (u.protocol === 'near:') return { to: u.pathname.replace(/^\/+/, '') };
  } catch { /* not a URL */ }
  if (/^[a-z0-9._-]{2,64}$/i.test(s) || /^0x[0-9a-f]{40}$/i.test(s) || /^@/.test(s)) return { to: s };
  return null;
}
export function ScanButton({ onResult }: { onResult: (r: { to: string; amt?: string } | null, raw: string) => void }) {
  const f = useRef<HTMLInputElement>(null);
  const read = async (file?: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
      const k = Math.min(1, 1200 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext('2d')!; g.drawImage(img, 0, 0, c.width, c.height);
      const { default: jsQR } = await import('jsqr');
      const code = jsQR(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
      onResult(code ? parseScan(code.data) : null, code?.data || '');
    } catch { onResult(null, ''); } finally { URL.revokeObjectURL(url); }
  };
  return (<>
    <input ref={f} type="file" accept="image/*" capture="environment" hidden aria-label="QR photo" onChange={(e) => { read(e.target.files?.[0]); e.target.value = ''; }} />
    <button type="button" className="fb" onClick={() => f.current?.click()}><ScanLine size={15} aria-hidden />Scan</button>
  </>);
}
