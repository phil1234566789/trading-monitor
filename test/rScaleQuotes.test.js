import { describe, it, expect } from "vitest";
import { rQuote } from "../src/rScaleQuotes.js";

// Bandgrenzen sind exklusiv unten, inklusiv oben (lo < Risiko <= hi) — wie in baenderTabellen.py.
// Die Grenzwerte selbst gehoeren also noch ins UNTERE Band. riskPips ist das strukturelle Risiko,
// auch wenn der Stopp der Skala gedeckelt ist.
describe("rQuote", () => {
  it("ordnet die Bandgrenzen dem unteren Band zu", () => {
    expect(rQuote("GBPUSD", 3.0, 3)).toBe(63);
    expect(rQuote("GBPUSD", 5.0, 3)).toBe(57);
    expect(rQuote("GBPUSD", 7.0, 3)).toBe(58);
    expect(rQuote("GBPUSD", 10.0, 3)).toBe(50);
    expect(rQuote("GBPUSD", 10.1, 3)).toBe(56);
  });

  it("deckt 2 bis 10 R ab und kennt keine anderen Stufen", () => {
    const leiter = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => rQuote("GBPUSD", 6, r));
    expect(leiter).toEqual([73, 58, 46, 39, 33, 30, 26, 24, 21]);
    expect(rQuote("GBPUSD", 6, 1)).toBeNull();
    expect(rQuote("GBPUSD", 6, 11)).toBeNull();
  });

  it("liefert nichts ausserhalb der Messung: EURUSD und Risiko 0", () => {
    expect(rQuote("EURUSD", 4, 3)).toBeNull();
    expect(rQuote("GBPUSD", 0, 3)).toBeNull();
  });
});
