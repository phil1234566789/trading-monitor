import { describe, it, expect } from "vitest";
import { rQuote, pipQuote } from "../src/drQuoten.js";

// Bandgrenzen sind exklusiv unten, inklusiv oben (lo < Risiko <= hi) — wie in baenderTabellen.py.
// Die Grenzwerte selbst gehoeren also noch ins UNTERE Band. riskPips ist das strukturelle Risiko,
// auch wenn der Stopp beider Leitern gedeckelt ist.
describe("rQuote", () => {
  it("ordnet die Bandgrenzen dem unteren Band zu", () => {
    expect(rQuote("GBPUSD", 3.0, 3)).toBe(66);
    expect(rQuote("GBPUSD", 5.0, 3)).toBe(57);
    expect(rQuote("GBPUSD", 7.0, 3)).toBe(54);
    expect(rQuote("GBPUSD", 10.0, 3)).toBe(49);
    expect(rQuote("GBPUSD", 10.1, 3)).toBe(53);
  });

  it("deckt 2 bis 10 R ab und kennt keine anderen Stufen", () => {
    const leiter = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => rQuote("GBPUSD", 6, r));
    expect(leiter).toEqual([68, 54, 43, 36, 29, 26, 23, 21, 19]);
    expect(rQuote("GBPUSD", 6, 1)).toBeNull();
    expect(rQuote("GBPUSD", 6, 11)).toBeNull();
  });

  it("liefert nichts ausserhalb der Messung: EURUSD und Risiko 0", () => {
    expect(rQuote("EURUSD", 4, 3)).toBeNull();
    expect(rQuote("GBPUSD", 0, 3)).toBeNull();
  });
});

describe("pipQuote", () => {
  it("ordnet die Bandgrenzen wie die R-Leiter dem unteren Band zu", () => {
    expect(pipQuote("GBPUSD", 3.0, 15)).toBe(38);
    expect(pipQuote("GBPUSD", 5.0, 15)).toBe(49);
    expect(pipQuote("GBPUSD", 7.0, 15)).toBe(59);
    expect(pipQuote("GBPUSD", 10.0, 15)).toBe(58);
    expect(pipQuote("GBPUSD", 10.1, 15)).toBe(59);
  });

  it("deckt 10 bis 40 Pips in 5er-Schritten ab und kennt keine anderen Ziele", () => {
    const leiter = [10, 15, 20, 25, 30, 35, 40].map((p) => pipQuote("GBPUSD", 4, p));
    expect(leiter).toEqual([63, 49, 40, 32, 27, 24, 21]);
    expect(pipQuote("GBPUSD", 4, 12)).toBeNull();
    expect(pipQuote("GBPUSD", 4, 45)).toBeNull();
  });

  it("liefert nichts ausserhalb der Messung: EURUSD und Risiko 0", () => {
    expect(pipQuote("EURUSD", 4, 15)).toBeNull();
    expect(pipQuote("GBPUSD", 0, 15)).toBeNull();
  });
});
