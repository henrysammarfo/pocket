'use client';
// Voice input. Records with MediaRecorder and sends the audio to /api/voice (Whisper on NEAR AI Cloud).
// If the server has no speech key, falls back to the browser's own speech recognition.
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiForm } from '@/lib/client/api';

type SR = { start(): void; stop(): void; abort(): void; lang: string; interimResults: boolean; continuous: boolean; onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: ((e: any) => void) | null };
const getSR = (): (new () => SR) | null => (typeof window === 'undefined' ? null : ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null));

export function useVoice({ server, onText, onError }: { server: boolean; onText: (t: string) => void; onError: (m: string) => void }) {
  const [state, setState] = useState<'idle' | 'rec' | 'busy'>('idle');
  const [secs, setSecs] = useState(0);
  const [live, setLive] = useState('');
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const sr = useRef<SR | null>(null);
  const t0 = useRef(0); const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelled = useRef(false);
  const canBrowser = !!getSR();
  const canRecord = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
  const available = (server && canRecord) || canBrowser;

  const tick = () => { t0.current = Date.now(); setSecs(0); timer.current = setInterval(() => setSecs(Math.floor((Date.now() - t0.current) / 1000)), 250); };
  const untick = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };

  const transcribe = useCallback(async (blob: Blob, name = 'voice.webm') => {
    setState('busy');
    try { const fd = new FormData(); fd.append('file', blob, name); const r = await apiForm<{ text: string }>('/api/voice', fd); onText(r.text); }
    catch (e) { onError(e instanceof Error ? e.message : String(e)); }
    finally { setState('idle'); }
  }, [onText, onError]);

  const start = useCallback(async () => {
    if (state !== 'idle') return;
    cancelled.current = false;
    if (server && canRecord) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported?.(m)) || '';
        const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        chunks.current = [];
        mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
        mr.onstop = () => {
          stream.getTracks().forEach((t) => t.stop()); untick();
          const type = mr.mimeType || 'audio/webm';
          const blob = new Blob(chunks.current, { type });
          if (cancelled.current) { setState('idle'); return; }
          if (Date.now() - t0.current < 600 || blob.size < 1200) { setState('idle'); onError('That was too short. Hold the mic, or tap it, and speak.'); return; }
          transcribe(blob, 'voice.' + (type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'));
        };
        rec.current = mr; mr.start(250); setState('rec'); tick();
        return;
      } catch { if (!canBrowser) { onError('Pocket needs your permission to use the microphone.'); return; } }
    }
    const C = getSR();
    if (!C) { onError('Voice is not available in this browser. Type instead, or upload a voice note.'); return; }
    const r = new C(); r.lang = navigator.language || 'en-GB'; r.interimResults = true; r.continuous = true;
    let final = '';
    r.onresult = (e: any) => { let interim = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const x = e.results[i]; if (x.isFinal) final += x[0].transcript + ' '; else interim += x[0].transcript; } setLive((final + interim).trim()); };
    r.onerror = (e: any) => { if (e?.error !== 'aborted' && e?.error !== 'no-speech') onError('The browser could not hear you (' + (e?.error || 'error') + ').'); };
    r.onend = () => { untick(); setState('idle'); const t = final.trim(); setLive(''); if (!cancelled.current && t) onText(t); };
    sr.current = r; r.start(); setState('rec'); tick();
  }, [state, server, canRecord, canBrowser, transcribe, onError, onText]);

  const stop = useCallback(() => { if (rec.current?.state === 'recording') rec.current.stop(); rec.current = null; if (sr.current) { sr.current.stop(); sr.current = null; } }, []);
  const cancel = useCallback(() => { cancelled.current = true; stop(); setLive(''); }, [stop]);
  useEffect(() => () => { cancelled.current = true; stop(); untick(); }, [stop]);
  return { state, secs, live, start, stop, cancel, transcribe, available, mode: server && canRecord ? 'server' as const : canBrowser ? 'browser' as const : 'none' as const };
}

export function speak(text: string) {
  try { if (!('speechSynthesis' in window)) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text.slice(0, 600)); u.rate = 1; speechSynthesis.speak(u); } catch { /* no voice */ }
}
