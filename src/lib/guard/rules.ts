/**
 * Deterministic first pass of Pocket's guardrail. It looks for attempts to
 * rewrite Pocket's rules, unlock money, or impersonate the system. Each
 * pattern carries a weight; a total at or above FLAG_AT flags the input.
 */
type Rule = { id: string; weight: number; re: RegExp };

export const RULES: Rule[] = [
  { id: "ignore_instructions", weight: 0.9, re: /\b(ignore|disregard|forget|override)\b[\s\w,]{0,30}\b(previous|prior|above|all|your|system|earlier)\b[\s\w]{0,20}\b(instructions?|rules?|prompts?|guardrails?|polic(y|ies))\b/i },
  { id: "new_instructions", weight: 0.6, re: /\b(new|updated|real|actual)\s+(system\s+)?(instructions?|rules?|prompt)\s*[:=]/i },
  { id: "role_hijack", weight: 0.6, re: /\b(you are now|from now on you are|act as|pretend (to be|you are)|roleplay as)\b/i },
  { id: "system_tag", weight: 0.9, re: /<\/?\s*(system|assistant|developer|instructions?)\s*>|\[\/?(system|inst)\]|^\s*(system|developer)\s*:/im },
  { id: "mode_unlock", weight: 0.7, re: /\b(developer|god|admin|debug|jailbreak|dan|unrestricted)\s+mode\b/i },
  { id: "reveal_prompt", weight: 0.6, re: /\b(reveal|print|show|repeat|leak)\b[\s\w]{0,20}\b(system prompt|hidden (rules|instructions)|your (prompt|instructions))\b/i },
  { id: "bypass_and_move", weight: 0.9, re: /\b(ignore|bypass|override|disable|skip)\b[\s\w]{0,25}\b(keep|reserve|floor|cap|allowlist|approval|rules?)\b[\s\w,]{0,30}\b(send|pay|move|transfer|withdraw)\b/i },
  { id: "disable_keep", weight: 0.6, re: /\b(disable|remove|bypass|turn off|lift|ignore|unlock|skip)\b[\s\w]{0,20}\b(keep|reserve floor|reserve|floor|spending cap|allowlist|policy engine|guardrails?|approval|limits?)\b/i },
  { id: "pre_approved", weight: 0.6, re: /\b(already|pre)[- ]?approved\b|\bapproved by (the )?(admin|system|pocket|developer)\b|\bauthori[sz]ed by (the )?(admin|system|pocket)\b/i },
  { id: "tool_injection", weight: 0.7, re: /\b(call|invoke|run|use)\b[\s\w]{0,15}\b(tool|function|mcp)\b[\s\w]{0,30}\b(transfer|send|pay|withdraw)\b/i },
];

export const FLAG_AT = 0.85;

export type RuleVerdict = { flagged: boolean; score: number; hits: string[] };

export function scoreRules(input: string): RuleVerdict {
  const text = input.slice(0, 8000);
  const hits = RULES.filter((r) => r.re.test(text)).map((r) => r.id);
  // Combine as independent evidence: 1 - prod(1 - w).
  const score = 1 - RULES.filter((r) => hits.includes(r.id)).reduce((acc, r) => acc * (1 - r.weight), 1);
  const rounded = Math.round(score * 1000) / 1000;
  return { flagged: rounded >= FLAG_AT, score: rounded, hits };
}
