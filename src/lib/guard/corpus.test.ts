import { describe, expect, it } from "vitest";
import { ATTACK_CORPUS, BENIGN_CORPUS } from "./corpus";
import { scoreRules } from "./rules";

describe("rules pass on the corpus", () => {
  const caught = ATTACK_CORPUS.filter((t) => scoreRules(t).flagged);
  const falsePos = BENIGN_CORPUS.filter((t) => scoreRules(t).flagged);
  it("reports detection and false positive rates", () => {
    console.info(
      `[guard corpus] attacks caught ${caught.length}/${ATTACK_CORPUS.length}, benign flagged ${falsePos.length}/${BENIGN_CORPUS.length}`,
    );
    expect(falsePos).toEqual([]);
    expect(caught.length / ATTACK_CORPUS.length).toBeGreaterThanOrEqual(0.9);
  });
});
