import { handler } from '@/lib/server/http';
import { webUp } from '@/lib/server/web';
import { visionUp } from '@/lib/server/vision';
import { chainInfo } from '@/lib/server/pool';
import { has } from '@/lib/server/env';
import { ORDER, PRIMARY, anyUp, nearaiSpentToday } from '@/lib/server/llm';
import { storeKind } from '@/lib/server/store';
import { VERIFIER_SHA256, VERIFIER_RELEASE, ROOT, TOKENS } from '@/lib/shared/deployment';
export const dynamic = 'force-dynamic';
export const GET = handler(async () => {
  const [c, spent] = await Promise.all([chainInfo().catch((e) => ({ error: String(e) })), nearaiSpentToday().catch(() => 0)]);
  const ai = anyUp(), voice = anyUp('stt');
  return {
    ok: true, network: 'testnet', root: ROOT, ...c, verifierWasmSha256: VERIFIER_SHA256, verifierRelease: VERIFIER_RELEASE,
    tokens: TOKENS.map((t) => t.contract), store: storeKind,
    services: { sponsor: has('SPONSOR'), relayer: has('RELAYER'), maker: has('MAKER'), faucet: has('FAUCET'), ai, voice, web: webUp() && ai, vision: visionUp(), aiConfigured: ORDER.length > 0, aiNote: ai ? null : ORDER.length ? 'The AI providers are not accepting calls right now. Pocket uses its built in parser and browser speech.' : 'No AI key set. Pocket uses its built in parser and browser speech.' },
    aiProvider: PRIMARY?.label || null, aiPrivate: !!PRIMARY?.private, aiModel: PRIMARY?.chat || null, visionModel: PRIMARY?.vision || null, sttModel: PRIMARY?.stt || null,
    aiFallback: ORDER[1] ? { provider: ORDER[1].label, model: ORDER[1].chat } : null, nearaiSpentTodayUsd: Number(spent.toFixed(4)), nearaiDailyCapUsd: Number(process.env.NEARAI_USD_PER_DAY || 0.8),
  };
});
