import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { convert, isEcbFetch, parseEcbDaily } from "./ecb";

// Real ECB daily file, saved 2026-11-11 from the public URL.
const xml = readFileSync(join(__dirname, "__fixtures__", "eurofxref-daily.xml"), "utf8");

describe("parseEcbDaily", () => {
  it("reads the date and rates from the real file", () => {
    const r = parseEcbDaily(xml)!;
    expect(r.date).toBe("2026-11-10");
    expect(r.perEur["USD"]).toBe(1.1214);
    expect(r.perEur["GBP"]).toBe(0.83545);
    expect(r.perEur["EUR"]).toBe(1);
  });
  it("returns null on a page without rates", () => {
    expect(parseEcbDaily("<html>maintenance</html>")).toBeNull();
  });
  it("converts through EUR and refuses unknown currencies", () => {
    const r = parseEcbDaily(xml)!;
    expect(convert(1.1214, "USD", "EUR", r)).toBeCloseTo(1, 10);
    expect(convert(100, "USD", "GBP", r)).toBeCloseTo((100 / 1.1214) * 0.83545, 10);
    expect(convert(100, "USD", "GHS", r)).toBeNull();
  });
});

describe("isEcbFetch", () => {
  it("only accepts https ecb.europa.eu and its subdomains", () => {
    expect(isEcbFetch("https://ecb.europa.eu/x")).toBe(true);
    expect(isEcbFetch("https://notecb.europa.eu/x")).toBe(false);
    expect(isEcbFetch("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml")).toBe(true);
    expect(isEcbFetch("http://www.ecb.europa.eu/x")).toBe(false);
    expect(isEcbFetch("https://ecb.europa.eu.evil.test/x")).toBe(false);
    expect(isEcbFetch(undefined)).toBe(false);
  });
});
