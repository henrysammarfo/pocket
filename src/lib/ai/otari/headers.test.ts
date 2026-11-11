import { describe, expect, it } from "vitest";
import { parseGuardrails, parseOtariHeaders, parseRetryAfter } from "./headers";
import { classifyOtariFailure, otariErrorFromResponse } from "./errors";
import { ROUTED } from "./test-helpers";

describe("parseOtariHeaders", () => {
  it("reads routing, fallback, timing and cost", () => {
    const m = parseOtariHeaders(new Headers(ROUTED));
    expect(m).toMatchObject({ requestId: "req_123", provider: "groq", model: "openai/gpt-oss-120b", attempts: 2, fallback: true, durationMs: 812, costUsd: 0.000412 });
  });
  it("treats missing headers as unknown, never as zero", () => {
    const m = parseOtariHeaders(new Headers());
    expect(m.attempts).toBeNull();
    expect(m.costUsd).toBeNull();
    expect(m.fallback).toBe(false);
    expect(m.guardrails).toEqual([]);
  });
  it("reads budget refusal headers", () => {
    const m = parseOtariHeaders(new Headers({ "otari-error-code": "budget_exceeded", "otari-budget-scope": "user", "otari-end-user-budget": "b1", "retry-after": "3600" }));
    expect(m).toMatchObject({ errorCode: "budget_exceeded", budgetScope: "user", endUserBudget: "b1", retryAfterSec: 3600 });
  });
});

describe("parseRetryAfter", () => {
  it("accepts seconds and HTTP dates", () => {
    const now = new Date("2026-11-11T10:00:00Z");
    expect(parseRetryAfter("120", now)).toBe(120);
    expect(parseRetryAfter("Wed, 11 Nov 2026 10:05:00 GMT", now)).toBe(300);
    expect(parseRetryAfter("soon", now)).toBeNull();
    expect(parseRetryAfter(null, now)).toBeNull();
  });
});

describe("parseGuardrails", () => {
  it("reads the Otari-Guardrails JSON list", () => {
    const g = parseGuardrails('[{"profile":"pocket-money-rules","mode":"block","valid":true,"score":0.1,"status":"ok"}]');
    expect(g).toEqual([{ profile: "pocket-money-rules", mode: "block", valid: true, score: 0.1, status: "ok" }]);
  });
  it("ignores malformed values", () => {
    expect(parseGuardrails("not json")).toEqual([]);
    expect(parseGuardrails('{"a":1}')).toEqual([]);
  });
});

describe("classifyOtariFailure", () => {
  it.each([
    [403, "budget_exceeded", "user", "allowance_used"],
    [403, "budget_exceeded", "api_token", "app_paused"],
    [403, "budget_exceeded", "organization", "app_paused"],
    [403, "user_blocked", null, "allowance_used"],
    [403, "guardrail_violation", null, "guard_blocked"],
    [502, null, null, "guard_offline"],
    [429, "rate_limited", null, "busy"],
    [429, "upstream_rate_limited", null, "busy"],
    [424, "provider_not_configured", null, "models_down"],
    [400, "all_candidates_rejected", null, "models_down"],
    [200, "provider_stream_interrupted", null, "models_down"],
    [502, "provider_error", null, "models_down"],
    [401, null, null, "not_configured"],
    [500, null, null, "models_down"],
    [400, "invalid_request", null, "unknown"],
  ] as const)("%i %s %s -> %s", (status, code, scope, want) => {
    expect(classifyOtariFailure(status, code, scope)).toBe(want);
  });
});

describe("otariErrorFromResponse", () => {
  it("prefers the header code and falls back to the body code", async () => {
    const res = new Response(JSON.stringify({ detail: "x has exceeded budget limit", code: "budget_exceeded" }), { status: 403 });
    const e = await otariErrorFromResponse(res, parseOtariHeaders(new Headers({ "otari-budget-scope": "user", "retry-after": "60" })));
    expect(e.code).toBe("budget_exceeded");
    expect(e.state).toBe("allowance_used");
    expect(e.retryAfterSec).toBe(60);
    expect(e.message).toContain("exceeded");
  });
});
