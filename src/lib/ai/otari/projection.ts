/**
 * Savings projection. The explainer model runs PROJECTION_PY in Otari's code
 * execution sandbox; Pocket recomputes the same numbers here in TypeScript and
 * shows the member whether they agree. Integer cents only, floor division on
 * both sides, so the two must match exactly.
 */
export type ProjectionInput = {
  start: number;
  income: number;
  fixed: number;
  goal: number;
  drop_pct?: number;
  max_months?: number;
};

export type ProjectionResult = {
  monthly_savings_cents: number;
  months_to_goal: number | null;
  reachable: boolean;
  schedule: { month: number; balance_cents: number }[];
};

const pyFloorDiv = (a: number, b: number) => Math.floor(a / b);

export function project(input: ProjectionInput): ProjectionResult {
  const { start, income, fixed, goal } = input;
  const dropPct = input.drop_pct ?? 0;
  const maxMonths = input.max_months ?? 120;
  const monthly = pyFloorDiv(income * (100 - dropPct), 100) - fixed;
  const schedule: ProjectionResult["schedule"] = [];
  let bal = start;
  let months: number | null = bal >= goal ? 0 : null;
  let m = 0;
  while (months === null && m < maxMonths && monthly > 0) {
    m += 1;
    bal += monthly;
    if (m <= 24) schedule.push({ month: m, balance_cents: bal });
    if (bal >= goal) months = m;
  }
  return { monthly_savings_cents: monthly, months_to_goal: months, reachable: months !== null, schedule };
}

/** The exact program the explainer is told to run. Keep in lockstep with project(). */
export const PROJECTION_PY = `import json

def project(start, income, fixed, goal, drop_pct=0, max_months=120):
    monthly = (income * (100 - drop_pct)) // 100 - fixed
    schedule = []
    bal = start
    months = 0 if bal >= goal else None
    m = 0
    while months is None and m < max_months and monthly > 0:
        m += 1
        bal += monthly
        if m <= 24:
            schedule.append({"month": m, "balance_cents": bal})
        if bal >= goal:
            months = m
    return {"monthly_savings_cents": monthly, "months_to_goal": months, "reachable": months is not None, "schedule": schedule}

INPUT = {"start": 0, "income": 0, "fixed": 0, "goal": 0, "drop_pct": 0}
print(json.dumps(project(**INPUT)))
`;

const KEYS = ["start", "income", "fixed", "goal", "drop_pct", "max_months"] as const;

/** Pull the INPUT dict out of code the model sent the sandbox. */
export function readProjectionInput(code: string): ProjectionInput | null {
  const m = code.match(/INPUT\s*=\s*(\{[^}]*\})/);
  if (!m) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(m[1]!.replace(/'/g, '"'));
  } catch {
    return null;
  }
  if (typeof obj !== "object" || obj === null) return null;
  const o = obj as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const k of Object.keys(o)) {
    if (!(KEYS as readonly string[]).includes(k)) return null;
    const v = o[k];
    if (typeof v !== "number" || !Number.isInteger(v)) return null;
    out[k] = v;
  }
  for (const k of ["start", "income", "fixed", "goal"]) if (!(k in out)) return null;
  return out as ProjectionInput;
}

export type CrossCheck = { status: "match" | "mismatch" | "not_projection"; input?: ProjectionInput; expected?: ProjectionResult };

/** Every projection input dict in the code: the INPUT line, or several scenarios (INPUT_A = {...}, project(**{...})). */
export function readProjectionInputs(code: string): ProjectionInput[] {
  const out: ProjectionInput[] = [];
  for (const m of code.matchAll(/\{[^{}]*["']start["'][^{}]*\}/g)) {
    const one = readProjectionInput(`INPUT = ${m[0]}`);
    if (one && !out.some((o) => JSON.stringify(o) === JSON.stringify(one))) out.push(one);
  }
  return out;
}

/**
 * Compare what the sandbox printed with Pocket's own computation. One run may
 * hold several scenarios (a what-if): every JSON line it printed must equal
 * Pocket's result for one of the inputs in the code, and there must be one per input.
 */
export function crossCheckProjection(code: string | undefined, stdout: string | undefined): CrossCheck {
  if (!code || !code.includes("def project(")) return { status: "not_projection" };
  const inputs = readProjectionInputs(code);
  if (!inputs.length) return { status: "not_projection" };
  const expected = inputs.map(project);
  const printed: unknown[] = [];
  for (const line of (stdout ?? "").split("\n")) {
    const t = line.trim();
    if (!t.startsWith("{")) continue;
    try {
      printed.push(JSON.parse(t));
    } catch {
      return { status: "mismatch", input: inputs[0]!, expected: expected[0]! };
    }
  }
  const same = (g: unknown, e: ProjectionResult) => JSON.stringify(g) === JSON.stringify(e);
  // A what-if is often one INPUT plus a loop or an override of drop_pct
  // (for d in [0, 20]: project(**{**INPUT, "drop_pct": d})). Those scenarios
  // never appear as literal dicts, so also accept a printed result that equals
  // Pocket's own result for a parsed input at some whole drop_pct.
  const variants = (g: unknown) =>
    inputs.some((inp) => {
      for (let d = 0; d <= 100; d++) if (same(g, project({ ...inp, drop_pct: d }))) return true;
      return false;
    });
  const ok =
    printed.length >= inputs.length &&
    printed.every((g) => expected.some((e) => same(g, e)) || variants(g));
  return { status: ok ? "match" : "mismatch", input: inputs[0]!, expected: expected[0]! };
}
