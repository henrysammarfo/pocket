import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { crossCheckProjection, project, PROJECTION_PY, readProjectionInput, type ProjectionInput } from "./projection";

const CASES: ProjectionInput[] = [
  { start: 0, income: 280_000, fixed: 190_000, goal: 300_000 },
  { start: 50_000, income: 280_000, fixed: 190_000, goal: 300_000, drop_pct: 20 },
  { start: 300_000, income: 1, fixed: 0, goal: 300_000 },
  { start: 0, income: 100_000, fixed: 100_000, goal: 10 },
  { start: 0, income: 333_333, fixed: 12_345, goal: 9_999_999, drop_pct: 7 },
  { start: 1_000, income: 50_001, fixed: 49_000, goal: 2_000_000, max_months: 36 },
];

const withInput = (i: ProjectionInput) => PROJECTION_PY.replace(/^INPUT = .*$/m, `INPUT = ${JSON.stringify(i)}`);

function hasPython(): boolean {
  try {
    execFileSync("python3", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

describe("project", () => {
  it("counts months to a goal", () => {
    const r = project(CASES[0]!);
    expect(r.monthly_savings_cents).toBe(90_000);
    expect(r.months_to_goal).toBe(4);
    expect(r.schedule.at(-1)).toEqual({ month: 4, balance_cents: 360_000 });
  });
  it("applies an income drop with floor division", () => {
    expect(project(CASES[1]!).monthly_savings_cents).toBe(34_000);
  });
  it("is reached at month 0 when already there", () => {
    expect(project(CASES[2]!)).toMatchObject({ months_to_goal: 0, reachable: true, schedule: [] });
  });
  it("is unreachable when nothing is saved", () => {
    expect(project(CASES[3]!)).toMatchObject({ months_to_goal: null, reachable: false });
  });
  it("respects max_months", () => {
    expect(project(CASES[5]!)).toMatchObject({ reachable: false });
  });
});

describe.skipIf(!hasPython())("TypeScript and the sandbox's Python agree exactly", () => {
  const dir = mkdtempSync(join(tmpdir(), "pocket-proj-"));
  it.each(CASES.map((c, i) => [i, c] as const))("case %i", (i, c) => {
    const file = join(dir, `p${i}.py`);
    writeFileSync(file, withInput(c));
    const stdout = execFileSync("python3", [file], { encoding: "utf8" });
    expect(JSON.parse(stdout)).toEqual(project(c));
    expect(crossCheckProjection(withInput(c), stdout).status).toBe("match");
  });
});

describe("crossCheckProjection", () => {
  it("flags a sandbox result that differs", () => {
    const code = withInput(CASES[0]!);
    const wrong = JSON.stringify({ ...project(CASES[0]!), months_to_goal: 3 });
    expect(crossCheckProjection(code, wrong).status).toBe("mismatch");
  });
  it("flags unparseable output", () => {
    expect(crossCheckProjection(withInput(CASES[0]!), "Traceback").status).toBe("mismatch");
  });
  it("ignores code that is not the projection", () => {
    expect(crossCheckProjection("print(1+1)", "2").status).toBe("not_projection");
  });
  it("rejects INPUT with unknown keys or non-integers", () => {
    expect(readProjectionInput('INPUT = {"start": 0, "income": 1.5, "fixed": 0, "goal": 1}')).toBeNull();
    expect(readProjectionInput('INPUT = {"start": 0, "income": 1, "fixed": 0, "goal": 1, "evil": 1}')).toBeNull();
    expect(readProjectionInput("INPUT = {'start': 0, 'income': 1, 'fixed': 0, 'goal': 1}")).toEqual({ start: 0, income: 1, fixed: 0, goal: 1 });
  });
});
