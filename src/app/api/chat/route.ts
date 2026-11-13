import { body, handler, ipOf } from '@/lib/server/http';
import { chat, planFrom, type ChatIn, type Confirm } from '@/lib/server/brain';
import { limit, store, HttpError } from '@/lib/server/store';
import { sessionOf } from '@/lib/server/auth';
import { COST, creditsOf, refund, settleUsage, spend } from '@/lib/server/credits';
import { aiUp } from '@/lib/server/env';

export const POST = handler(async (req) => {
  const b = await body<ChatIn & { confirm?: Confirm }>(req);
  if (!b.ctx || typeof b.ctx.dollars !== 'number') throw new HttpError(400, 'Bad chat request');
  await limit('chat:' + ipOf(req), Number(process.env.CHAT_PER_IP_HOUR || 120), 3600);
  const account = await sessionOf(req, false);
  if (b.confirm) {
    const out = planFrom(b.confirm, b.ctx);
    if (account) await store.addChat(account, { role: 'assistant', content: out.reply, at: Date.now(), meta: { plan: out.plan, check: out.check } });
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
    await store.addChat(account, { role: 'user', content: String(last.content).slice(0, 2000), at: Date.now(), meta: b.voice ? { voice: true } : null });
  }
  const out = await chat({ messages: b.messages, ctx: b.ctx, voice: b.voice, memories, offline: !useAI });
  if (account) {
    for (const f of out.remembered || []) await store.addMemory(account, f);
    if (useAI && out.usd) await settleUsage(account, COST.chat, out.usd);
    if (useAI && out.source !== 'ai') await refund(account, COST.chat);
    await store.addChat(account, { role: 'assistant', content: out.reply, at: Date.now(), meta: { plan: out.plan, check: out.check, confirm: out.confirm, chips: out.chips, source: out.source } });
  }
  const { usd: _u, ...rest } = out; void _u;
  return { ...rest, credits: account ? await creditsOf(account) : undefined };
});
