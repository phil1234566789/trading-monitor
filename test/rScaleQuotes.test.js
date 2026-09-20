import { describe, it, expect } from "vitest";
import { rQuote } from "../src/rScaleQuotes.js";

// Bandgrenzen sind exklusiv unten, inklusiv oben (lo < Risiko <= hi) — wie in baenderTabellen.py.
// Die Grenzwerte selbst gehoeren also noch ins UNTERE Band.
describe("rQuote", () => {
  it("ordnet die Bandgrenzen dem unteren Band zu", () => {
    expect(rQuote("GBPUSD", 3.0, 3)).toBe(72);
    expect(rQuote("GBPUSD", 5.0, 3)).toBe(60);
    expect(rQuote("GBPUSD", 7.0, 3)).toBe(57);
    expect(rQuote("GBPUSD", 10.0, 3)).toBe(46);
    expect(rQuote("GBPUSD", 10.1, 3)).toBe(36);
  });

  it("deckt alle fuenf R-Stufen ab und kennt keine anderen", () => {
    expect([2, 3, 4, 5, 6].map((r) => rQuote("GBPUSD", 6, r))).toEqual([74, 57, 44, 38, 33]);
    expect(rQuote("GBPUSD", 6, 1)).toBeNull();
  });

  it("liefert nichts ausserhalb der Messung: EURUSD und Risiko 0", () => {
    expect(rQuote("EURUSD", 4, 3)).toBeNull();
    expect(rQuote("GBPUSD", 0, 3)).toBeNull();
  });
});
