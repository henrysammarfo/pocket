import { describe, expect, it } from "vitest";
import { AI_STATE_COPY, decodeAiState, encodeAiState, formatWait } from "./ai-states";

describe("ai states", () => {
  it("round-trips through the stream error text", () => {
    expect(decodeAiState(encodeAiState("allowance_used", 120))).toEqual({ pocketAi: true, code: "allowance_used", retryAfterSec: 120 });
  });
  it("ignores other errors", () => {
    expect(decodeAiState("Failed to fetch")).toBeNull();
    expect(decodeAiState('{"pocketAi":true,"code":"made_up"}')).toBeNull();
    expect(decodeAiState(null)).toBeNull();
  });
  it("never uses a dash as punctuation in member copy", () => {
    for (const c of Object.values(AI_STATE_COPY)) {
      expect(`${c.title} ${c.body}`).not.toMatch(/ [-–—] |—|–/);
    }
  });
  it("formats waits", () => {
    expect(formatWait(45)).toBe("in 45 s");
    expect(formatWait(600)).toBe("in 10 min");
    expect(formatWait(12_000)).toBe("in 3 h 20 min");
    expect(formatWait(null)).toBeNull();
  });
});
