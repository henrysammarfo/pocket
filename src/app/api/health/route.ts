import { handler } from '@/lib/server/http';
import { chainInfo } from '@/lib/server/pool';
import { has, AI, aiUp, sttUp, probeAI } from '@/lib/server/env';
import { storeKind } from '@/lib/server/store';
import { VERIFIER_SHA256, VERIFIER_RELEASE, ROOT, TOKENS } from '@/lib/shared/deployment';
export const dynamic = 'force-dynamic';
export const GET = handler(async () => {
  const [c] = await Promise.all([chainInfo().catch((e) => ({ error: String(e) })), probeAI()]);
  return {
    ok: true, network: 'testnet', root: ROOT, ...c, verifierWasmSha256: VERIFIER_SHA256, verifierRelease: VERIFIER_RELEASE,
    tokens: TOKENS.map((t) => t.contract), store: storeKind,
    services: { sponsor: has('SPONSOR'), relayer: has('RELAYER'), maker: has('MAKER'), faucet: has('FAUCET'), ai: aiUp(), voice: sttUp(), aiConfigured: !!AI.apiKey, aiNote: aiUp() ? null : AI.apiKey ? 'The AI provider is not accepting calls right now (no credit or bad key). Pocket uses its built in parser and browser speech.' : 'No AI key set. Pocket uses its built in parser and browser speech.' },
    aiModel: AI.apiKey ? AI.model : null, aiProvider: AI.apiKey ? AI.label : null, sttModel: AI.sttKey ? AI.sttModel : null,
  };
});
