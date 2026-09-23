import { describe, it, expect } from "vitest";
import { rQuote, pipQuote, fvgBewertung, FVG_BAND_N } from "../src/drQuoten.js";

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

// Der Bewertungs-Bereich zeigt ALLE Baender (nicht nur das eigene) und markiert das der laufenden
// Dealing Range — die Markierung ist die einzige Stelle, an der die Bandgrenzen zweimal gelesen
// werden (einmal fuer die Quote, einmal fuer den Treffer), deshalb hier festgenagelt.
describe("fvgBewertung", () => {
  it("markiert genau ein Band, und zwar das der uebergebenen FVG", () => {
    const t = fvgBewertung("GBPUSD", 4.6);
    expect(t.baender.filter((b) => b.treffer).map((b) => b.label)).toEqual(["3–5 P"]);
    expect(t.baender).toHaveLength(6);
    expect(t.baender[0].quoten).toHaveLength(6);
  });

  it("legt die Bandgrenze ins OBERE Band (lo <= FVG < hi, wie fvgBaender.py)", () => {
    expect(fvgBewertung("GBPUSD", 3).baender.find((b) => b.treffer).label).toBe("3–5 P");
    expect(fvgBewertung("GBPUSD", 2.99).baender.find((b) => b.treffer).label).toBe("2–3 P");
  });

  it("zeigt die Tabelle ohne Markierung, wenn keine FVG verknuepft ist", () => {
    const t = fvgBewertung("GBPUSD", null);
    expect(t.baender.some((b) => b.treffer)).toBe(false);
    expect(t.referenz).toHaveLength(6);
  });

  it("liefert fuer ungemessene Instrumente nichts", () => {
    expect(fvgBewertung("EURUSD", 4.6)).toBeNull();
  });

  // Die Baender sind von Hand aus ergebnis-fvg.txt uebertragen -- eine ausgelassene Zelle faellt
  // sonst erst auf, wenn die Anzeige sie braucht.
  it("hat in jedem Band jede angezeigte Stufe", () => {
    for (const band of fvgBewertung("GBPUSD", null).baender) {
      expect(band.quoten.every((q) => q > 0), band.label).toBe(true);
      expect(band.n).toBeGreaterThan(50);
    }
    expect(FVG_BAND_N).toHaveLength(6);
    expect(FVG_BAND_N.reduce((a, b) => a + b, 0)).toBe(3179);
  });
});
