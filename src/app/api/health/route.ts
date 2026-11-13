import { handler } from '@/lib/server/http';
import { chainInfo } from '@/lib/server/pool';
import { has, AI } from '@/lib/server/env';
import { storeKind } from '@/lib/server/store';
import { VERIFIER_SHA256, VERIFIER_RELEASE, ROOT, TOKENS } from '@/lib/shared/deployment';
export const dynamic = 'force-dynamic';
export const GET = handler(async () => {
  const c = await chainInfo().catch((e) => ({ error: String(e) }));
  return {
    ok: true, network: 'testnet', root: ROOT, ...c, verifierWasmSha256: VERIFIER_SHA256, verifierRelease: VERIFIER_RELEASE,
    tokens: TOKENS.map((t) => t.contract), store: storeKind,
    services: { sponsor: has('SPONSOR'), relayer: has('RELAYER'), maker: has('MAKER'), faucet: has('FAUCET'), ai: !!AI.apiKey },
  };
});
