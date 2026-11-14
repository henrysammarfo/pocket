import { body, handler, ipOf } from '@/lib/server/http';
import { chat, planFrom, type ChatIn, type Confirm } from '@/lib/server/brain';
import { limit, store, HttpError } from '@/lib/server/store';
import { sessionOf } from '@/lib/server/auth';
import { COST, creditsOf, refund, settleUsage, spend } from '@/lib/server/credits';
import { anyUp as aiUp } from '@/lib/server/llm';
import { okImage, readImage, visionUp } from '@/lib/server/vision';

// Privacy: chat text is never written to the server. The browser keeps the history (localStorage);
// this route only answers. Saved memory items are the one thing kept, and only when the user asks
// Pocket to remember something. See README, "What is stored, where".
export const POST = handler(async (req) => {
  const b = await body<ChatIn & { confirm?: Confirm; image?: string }>(req);
  if (!b.ctx || typeof b.ctx.dollars !== 'number') throw new HttpError(400, 'Bad chat request');
  await limit('chat:' + ipOf(req), Number(process.env.CHAT_PER_IP_HOUR || 120), 3600);
  const account = await sessionOf(req, false);
  if (b.confirm) {
    const out = planFrom(b.confirm, b.ctx);
    return out;
  }
  if (!Array.isArray(b.messages) || !b.messages.length) throw new HttpError(400, 'Bad chat request');
  const last = b.messages[b.messages.length - 1];
  if (last.role !== 'user' || !String(last.content || '').trim()) throw new HttpError(400, 'Say something first.');
  let memories: string[] = [];
  let useAI = aiUp() && !!account;
  // Stay inside the provider's free tier for the whole server (Groq free chat: 30 a minute, 1K a day).
  // Over the line, Pocket answers with its free built in helper instead of failing.
  if (useAI) {
    try { await limit('ai:all:min', Number(process.env.AI_GLOBAL_PER_MIN || 25), 60); await limit('ai:all:day', Number(process.env.AI_GLOBAL_PER_DAY || 900), 86400); }
    catch { useAI = false; }
  }
  if (account) {
    await limit('chat:acct:' + account, Number(process.env.CHAT_PER_ACCOUNT_HOUR || 90), 3600);
    memories = (await store.memories(account)).map((m) => m.text);
    if (useAI) await spend(account, COST.chat);
  }
  // A shared photo (receipt, bill): read it into text first, then the chat model works with that text.
  let photoUsd = 0; let photoText = '';
  if (b.image) {
    if (!account) throw new HttpError(401, 'Sign in to share photos.');
    if (!okImage(b.image)) throw new HttpError(400, 'Use a JPEG, PNG or WebP photo under 3 MB.');
    if (!useAI || !visionUp()) throw new HttpError(503, 'Reading photos needs the AI, which is not available right now.');
    await limit('photo:acct:' + account, Number(process.env.PHOTO_PER_ACCOUNT_HOUR || 20), 3600);
    await spend(account, COST.photo);
    try { const v = await readImage(b.image); photoUsd = v.usd; photoText = v.text; last.content = `${String(last.content || '').trim() || 'I shared a photo.'}\n\n[Photo the user shared, read by Pocket: ${v.text}]`; }
    catch { await refund(account, COST.photo); throw new HttpError(502, 'I could not read that photo just now. Try again in a moment.'); }
  }
  const out = await chat({ messages: b.messages, ctx: b.ctx, voice: b.voice, memories, offline: !useAI });
  if (account && photoUsd) await settleUsage(account, COST.photo, photoUsd);
  if (account) {
    for (const f of out.remembered || []) await store.addMemory(account, f);
    if (useAI && out.usd) await settleUsage(account, COST.chat, out.usd);
    if (useAI && out.source !== 'ai') await refund(account, COST.chat);
  }
  const { usd: _u, ...rest } = out; void _u;
  return { ...rest, ...(photoText ? { photoText } : {}), credits: account ? await creditsOf(account) : undefined };
});
