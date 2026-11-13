// NEAR Intents message builders. Shapes follow near/intents defuse v0.4.2
// (core/src/intents, core/src/payload/nep413.rs): the NEP-413 message is JSON
// { signer_id, deadline, intents: [...] }; the verifier comes from `recipient`
// and the nonce from the NEP-413 nonce.
import { randomNonce, type Nep413Payload } from './nep413';

export type TransferIntent = { intent: 'transfer'; receiver_id: string; tokens: Record<string, string>; memo?: string };
export type TokenDiffIntent = { intent: 'token_diff'; diff: Record<string, string>; memo?: string };
export type Intent = TransferIntent | TokenDiffIntent;
export type IntentMessage = { signer_id: string; deadline: string; intents: Intent[] };

export function buildPayload(signer: string, verifier: string, intents: Intent[], ttlSeconds = 120): { payload: Nep413Payload; message: IntentMessage } {
  const message: IntentMessage = { signer_id: signer, deadline: new Date(Date.now() + ttlSeconds * 1000).toISOString(), intents };
  return { message, payload: { message: JSON.stringify(message), nonce: randomNonce(), recipient: verifier } };
}

export function parseMessage(s: string): IntentMessage | null {
  try {
    const m = JSON.parse(s);
    if (typeof m?.signer_id !== 'string' || typeof m?.deadline !== 'string' || !Array.isArray(m?.intents)) return null;
    return m as IntentMessage;
  } catch {
    return null;
  }
}
