/**
 * Otari enforces guardrails on input only today (guardrails-reference.md:
 * `output` "is accepted but not enforced yet"), so Pocket screens the model's
 * answer in code. It never edits the answer; it flags it on the receipt.
 */
export type OutputCheck = { flagged: boolean; reasons: ("claims_money_moved" | "asks_for_secret")[] };

const MOVED = /\b(i|we|pocket)\s+(have\s+|just\s+|already\s+)?(sent|transferred|paid|moved|wired)\b[\s\w$.,]{0,40}\b(to|for)\b/i;
const DONE = /\b(payment|transfer)\s+(is\s+|has\s+been\s+)?(complete|completed|done|sent)\b/i;
const SECRET = /\b(send|share|give|enter|paste|type|tell)\b[\s\w]{0,20}\b(seed phrase|recovery phrase|private key|mnemonic)\b/i;

export function checkOutput(text: string): OutputCheck {
  const reasons: OutputCheck["reasons"] = [];
  if (MOVED.test(text) || DONE.test(text)) reasons.push("claims_money_moved");
  const sentences = text.split(/(?<=[.!?\n])\s+/);
  if (sentences.some((x) => SECRET.test(x) && !/\b(never|don't|do not|not)\b/i.test(x))) reasons.push("asks_for_secret");
  return { flagged: reasons.length > 0, reasons };
}
