'use client';
import { useState } from 'react';
import { ChevronRight, Copy, ExternalLink } from 'lucide-react';
import { Coil, Logo, Sheet, fmt, toast, toastErr } from './kit';
import { claimFaucet } from '@/lib/client/api';
import { useSession } from '@/lib/client/session';
import { QrCode } from './qr';

export const copy = async (t: string, what = 'Copied') => { try { await navigator.clipboard.writeText(t); toast(what); } catch { toast(t); } };

export function ReceiveSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useSession();
  if (!s) return null;
  const link = `${location.origin}/pay/${s.username}`;
  return (
    <Sheet open={open} onClose={onClose} label="Receive">
      <h3 className="sh-t">Receive</h3>
      <p className="sh-s">Show this code, or share a link. Pocket users can also just type <b>@{s.username}</b>.</p>
      <div className="qrwrap"><QrCode text={link} size={188} /><span>Scan with Pocket to pay @{s.username}</span></div>
      <div className="group list">
        <button className="row" onClick={() => copy(s.account, 'Account copied')}><span className="logo near"><Logo name="near" /></span><span className="rn"><span className="nm">{s.account}</span><span className="sb">Your NEAR testnet account</span></span><Copy size={16} aria-hidden /></button>
        <button className="row" onClick={() => copy(link, 'Pay link copied')}><span className="logo txt"><Coil /></span><span className="rn"><span className="nm">Pay link</span><span className="sb">{link.replace(/^https?:\/\//, '')}</span></span><Copy size={16} aria-hidden /></button>
      </div>
      <p className="fine">Only send NEAR testnet tokens here. Other networks are on the roadmap.</p>
    </Sheet>
  );
}
export function AddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const s = useSession();
  const go = async () => { setBusy(true); try { const f = await claimFaucet(); toast(`Added ${fmt(Number(f.amount))} pUSD`); onClose(); } catch (e) { toastErr(e); } finally { setBusy(false); } };
  return (
    <Sheet open={open} onClose={onClose} label="Add test money">
      <h3 className="sh-t">Add test money</h3>
      <p className="sh-s">Free test dollars to try everything. Nothing here has real value.</p>
      <div className="group list">
        <button className="row" onClick={go} disabled={busy}><span className="logo"><Logo name="pusd" /></span><span className="rn"><span className="nm">{busy ? 'Claiming…' : 'Claim 1,000 pUSD'}</span><span className="sb">Pocket faucet, up to 3 times a day</span></span><ChevronRight size={16} aria-hidden /></button>
        <a className="row" href="https://faucet.circle.com/" target="_blank" rel="noreferrer" onClick={() => s && copy(s.account, 'Account copied, paste it at Circle')}><span className="logo usdc"><Logo name="usdc" /></span><span className="rn"><span className="nm">Get testnet USDC</span><span className="sb">Circle faucet, pick NEAR testnet</span></span><ExternalLink size={16} aria-hidden /></a>
      </div>
    </Sheet>
  );
}

