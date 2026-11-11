import { describe, expect, it } from "vitest";
import { isMemberId } from "./data.server";

describe("isMemberId", () => {
  it("accepts uuids only", () => {
    expect(isMemberId("3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c")).toBe(true);
    expect(isMemberId("live-test-3")).toBe(false);
    expect(isMemberId("")).toBe(false);
  });
});
