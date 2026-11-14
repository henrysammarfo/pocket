// Speech to text. Audio goes to NEAR AI Cloud first (openai/whisper-large-v3 in an attested TEE),
// then Groq (whisper-large-v3) if NEAR AI is down or at its daily cap.
// Pocket never stores the audio.
import { handler, ipOf } from '@/lib/server/http';
import { limit, HttpError } from '@/lib/server/store';
import { sessionOf } from '@/lib/server/auth';
import { COST, creditsOf, spend } from '@/lib/server/credits';
import { anyUp, transcribe } from '@/lib/server/llm';
import { refund } from '@/lib/server/credits';
export const maxDuration = 60;

const PROMPT = 'Pocket money app. Names: Mum, Dad, Kofi, Ama, Kwame, Akosua, Yaw, Efua. Words: send, pay, buy, sell, Tesla, NVIDIA, Apple, S&P 500, Nasdaq, pUSD, USDC, NEAR, dollars, cedis, abeg, chale. Ghanaian English and Pidgin are welcome.';
export const POST = handler(async (req) => {
  const account = (await sessionOf(req))!;
  if (!anyUp('stt')) throw new HttpError(503, 'Voice transcription is not set up on this server. Your browser can still listen if it supports speech.');
  await limit('voice:' + ipOf(req), Number(process.env.VOICE_PER_IP_HOUR || 60), 3600);
  const form = await req.formData();
  const f = form.get('file');
  if (!(f instanceof Blob) || f.size < 500) throw new HttpError(400, 'No audio, or it was too short.');
  if (f.size > 20 * 1024 * 1024) throw new HttpError(413, 'Voice notes up to 20 MB, please.');
  // Stay inside the provider's free tier for the whole server (Groq free Whisper: 20 a minute, 2K a day).
  await limit('voice:all:min', Number(process.env.VOICE_GLOBAL_PER_MIN || 18), 60).catch(() => { throw new HttpError(429, 'Lots of people are talking to Pocket right now. Try again in a minute, or type it.'); });
  await limit('voice:all:day', Number(process.env.VOICE_GLOBAL_PER_DAY || 1800), 86400).catch(() => { throw new HttpError(429, 'Voice is busy for today. Please type it.'); });
  await spend(account, COST.voice);
  const name = (f as File).name || 'voice.webm';
  const make = (p: { stt: string }) => { const out = new FormData(); out.append('file', f, /\.[a-z0-9]+$/i.test(name) ? name : name + '.webm'); out.append('model', p.stt); out.append('prompt', PROMPT); out.append('response_format', 'verbose_json'); out.append('temperature', '0'); return out; };
  let j: any;
  try { j = (await transcribe(make)).j; } catch { await refund(account, COST.voice); throw new HttpError(502, 'Transcription failed. Try again, or type it.'); }
  // Whisper invents words on silence or noise ("you", "Thank you."). Drop segments it marks as no speech.
  const segs: { text?: string; no_speech_prob?: number; avg_logprob?: number }[] = Array.isArray(j.segments) ? j.segments : [];
  const kept = segs.length ? segs.filter((s) => (s.no_speech_prob ?? 0) < 0.6 && (s.avg_logprob ?? 0) > -1.2).map((s) => s.text || '').join(' ') : String(j.text || '');
  let text = kept.replace(/\s+/g, ' ').trim();
  if (/^(you|thank you|thanks|thanks for watching|bye|okay|\.|,)[.!]?$/i.test(text)) text = '';
  if (!text) throw new HttpError(422, 'I could not hear any words in that. Try again a bit closer to the mic.');
  return { text, credits: await creditsOf(account) };
});
