// Speech to text. Audio goes to NEAR AI Cloud (openai/whisper-large-v3, private TEE) by default,
// or any OpenAI compatible /audio/transcriptions endpoint set by STT_BASE_URL and STT_API_KEY.
// Pocket never stores the audio.
import { handler, ipOf } from '@/lib/server/http';
import { limit, HttpError } from '@/lib/server/store';
import { sessionOf } from '@/lib/server/auth';
import { COST, creditsOf, spend } from '@/lib/server/credits';
import { AI, aiState, sttUp } from '@/lib/server/env';
import { refund } from '@/lib/server/credits';
export const maxDuration = 60;

const PROMPT = 'Pocket money app. Names: Mum, Dad, Kofi, Ama, Kwame, Akosua, Yaw, Efua. Words: send, pay, buy, sell, Tesla, NVIDIA, Apple, S&P 500, Nasdaq, pUSD, USDC, NEAR, dollars, cedis, abeg, chale. Ghanaian English and Pidgin are welcome.';
export const POST = handler(async (req) => {
  if (!sttUp()) throw new HttpError(503, 'Voice transcription is not set up on this server. Your browser can still listen if it supports speech.');
  const account = (await sessionOf(req))!;
  await limit('voice:' + ipOf(req), Number(process.env.VOICE_PER_IP_HOUR || 60), 3600);
  const form = await req.formData();
  const f = form.get('file');
  if (!(f instanceof Blob) || f.size < 500) throw new HttpError(400, 'No audio, or it was too short.');
  if (f.size > 20 * 1024 * 1024) throw new HttpError(413, 'Voice notes up to 20 MB, please.');
  await spend(account, COST.voice);
  const out = new FormData();
  const name = (f as File).name || 'voice.webm';
  out.append('file', f, /\.[a-z0-9]+$/i.test(name) ? name : name + '.webm');
  out.append('model', AI.sttModel);
  out.append('prompt', PROMPT);
  out.append('response_format', 'json');
  const r = await fetch(AI.sttBaseUrl.replace(/\/$/, '') + '/audio/transcriptions', { method: 'POST', headers: { authorization: `Bearer ${AI.sttKey}` }, body: out, signal: AbortSignal.timeout(55000) });
  if (!r.ok) { await refund(account, COST.voice); if ([401, 402, 403].includes(r.status)) aiState.sttDownUntil = Date.now() + 10 * 60e3; }
  if (!r.ok) throw new HttpError(r.status === 402 ? 503 : 502, `Transcription failed (${r.status}). Try again, or type it.`);
  const j = await r.json();
  const text = String(j.text || '').trim();
  if (!text) throw new HttpError(422, 'I could not hear any words in that. Try again a bit closer to the mic.');
  return { text, credits: await creditsOf(account) };
});
