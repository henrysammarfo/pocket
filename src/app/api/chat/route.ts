import { body, handler, ipOf } from '@/lib/server/http';
import { chat, type ChatIn } from '@/lib/server/brain';
import { limit, HttpError } from '@/lib/server/store';
export const POST = handler(async (req) => {
  const b = await body<ChatIn>(req);
  if (!Array.isArray(b.messages) || !b.ctx) throw new HttpError(400, 'Bad chat request');
  await limit('chat:' + ipOf(req), Number(process.env.CHAT_PER_IP_HOUR || 120), 3600);
  return chat(b);
});
