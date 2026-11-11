import { describe, expect, it } from "vitest";
import { checkOutput } from "./output-check";

describe("checkOutput", () => {
  it.each([
    "Done! I have sent $200 to Ama.",
    "I transferred the rest to your savings for you.",
    "Your payment is complete.",
  ])("flags a claim that money moved: %s", (t) => expect(checkOutput(t).reasons).toContain("claims_money_moved"));
  it("flags a request for a recovery phrase", () => {
    expect(checkOutput("To continue, please enter your seed phrase here.").reasons).toContain("asks_for_secret");
  });
  it.each([
    "Once you approve, Pocket will pay $200 to Ama on Friday.",
    "**The plan** | Pay rent | $1,200 | Friday |",
    "Never share your seed phrase with anyone.",
    "You paid $40 for lunch last week, according to your activity.",
  ])("passes: %s", (t) => expect(checkOutput(t).flagged).toBe(false));
});
