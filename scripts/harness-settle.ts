/**
 * POCKET settle harness — typed / spoken / next-day must all block "send the rest".
 * Run: npx tsx scripts/harness-settle.ts
 */
import { parseMoneyPlanFromGoal, parseSpendIntent } from "../src/lib/policy/plan-parser";
import { evaluatePolicy } from "../src/lib/policy/policy-engine";

const plan = parseMoneyPlanFromGoal("Pay rent $1200 and keep $200");
const balanceCents = 80_000; // after rent paid, buffer + idle

function runCase(name: string, text: string, source: "typed" | "spoken" | "system") {
  const intent = parseSpendIntent(text, source);
  const decision = evaluatePolicy(intent, { plan, balanceCents });
  const pass = decision.allowed === false && (decision.code === "SEND_REST" || decision.code === "RESERVE_FLOOR");
  const detail = decision.allowed ? `ALLOWED · ${decision.reason}` : `${decision.code} · ${decision.reason}`;
  console.log(`${pass ? "PASS" : "FAIL"} · ${name} · ${detail}`);
  return pass;
}

const results = [
  runCase("typed", "Send the rest", "typed"),
  runCase("spoken", "send the rest please", "spoken"),
  runCase("next-day", "Send the rest", "typed"),
];

const score = results.filter(Boolean).length;
console.log(`\nHarness ${score}/3 blocked`);
if (score !== 3) process.exit(1);
