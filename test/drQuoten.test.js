import { describe, it, expect } from "vitest";
import { rQuote, pipQuote, drQuotenBlock, fvgQuote, FVG_BAND_N } from "../src/drQuoten.js";

// Bandgrenzen sind exklusiv unten, inklusiv oben (lo < Risiko <= hi) — wie in baenderTabellen.py.
// Die Grenzwerte selbst gehoeren also noch ins UNTERE Band. riskPips ist das strukturelle Risiko,
// auch wenn der Stopp beider Leitern gedeckelt ist.
describe("rQuote", () => {
  it("ordnet die Bandgrenzen dem unteren Band zu", () => {
    expect(rQuote("GBPUSD", 3.0, 3)).toBe(66);
    expect(rQuote("GBPUSD", 5.0, 3)).toBe(57);
    expect(rQuote("GBPUSD", 7.0, 3)).toBe(54);
    expect(rQuote("GBPUSD", 10.0, 3)).toBe(49);
    expect(rQuote("GBPUSD", 10.1, 3)).toBe(55);
  });

  it("deckt 2 bis 10 R ab und kennt keine anderen Stufen", () => {
    const leiter = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => rQuote("GBPUSD", 6, r));
    expect(leiter).toEqual([68, 54, 43, 36, 30, 26, 23, 21, 19]);
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
    expect(pipQuote("GBPUSD", 10.1, 15)).toBe(61);
  });

  it("deckt 10 bis 40 Pips in 5er-Schritten ab und kennt keine anderen Ziele", () => {
    const leiter = [10, 15, 20, 25, 30, 35, 40].map((p) => pipQuote("GBPUSD", 4, p));
    expect(leiter).toEqual([64, 49, 40, 33, 28, 24, 21]);
    expect(pipQuote("GBPUSD", 4, 12)).toBeNull();
    expect(pipQuote("GBPUSD", 4, 45)).toBeNull();
  });

  it("liefert nichts ausserhalb der Messung: EURUSD und Risiko 0", () => {
    expect(pipQuote("EURUSD", 4, 15)).toBeNull();
    expect(pipQuote("GBPUSD", 0, 15)).toBeNull();
  });
});

describe("drQuotenBlock", () => {
  it("liefert beide Leitern fuer das Band der Range", () => {
    const block = drQuotenBlock("GBPUSD", 4.3, "minor");
    expect(block.pipLeiter).toEqual([
      { ziel: 10, einheit: "P", quote: 64 },
      { ziel: 15, einheit: "P", quote: 49 },
      { ziel: 20, einheit: "P", quote: 40 },
      { ziel: 30, einheit: "P", quote: 28 },
    ]);
    expect(block.rLeiter.map((s) => s.quote)).toEqual([73, 57, 47, 34]);
  });

  it("zeigt die Vergleichszeile nur bei Minor-Sweep", () => {
    expect(drQuotenBlock("GBPUSD", 4.3, "minor").vergleich.stufen).toEqual([
      { ziel: 15, einheit: "P", quote: 66 },
      { ziel: 3, einheit: "R", quote: 44 },
    ]);
    // Ein reifer Sweep wuerde die Zeile darueber nur wiederholen, ohne Sweep gibt es kein Alter.
    expect(drQuotenBlock("GBPUSD", 4.3, "major").vergleich).toBeNull();
    expect(drQuotenBlock("GBPUSD", 4.3, null).vergleich).toBeNull();
  });

  it("entfaellt ganz, wo nichts gemessen wurde", () => {
    expect(drQuotenBlock("EURUSD", 4.3, "minor")).toBeNull();
    expect(drQuotenBlock("GBPUSD", 0, "minor")).toBeNull();
  });

  // Die angezeigten Stufen und die Tabellen sind getrennte Konstanten -- eine Stufe ohne Zahl
  // wuerde sonst als leere Zelle im TSC landen.
  it("hat in jedem Risiko-Band fuer jede angezeigte Stufe eine Quote", () => {
    for (const risiko of [2, 4, 6, 8, 20]) {
      const block = drQuotenBlock("GBPUSD", risiko, "minor");
      expect([...block.pipLeiter, ...block.rLeiter].map((s) => s.quote)).not.toContain(null);
    }
  });
});

// Zweiter Schnitt (23.09.2026): die FVG-Baender schneiden dieselbe Grundgesamtheit nach der Luecke
// statt nach dem Risiko -- und ihre Grenzen liegen andersherum (lo <= FVG < hi), weil die
// Untergrenze die harte 0,5-Pip-Erkennungsschwelle ist. Genau dort kippt ein Off-by-one still.
describe("fvgQuote", () => {
  it("ordnet an den Bandgrenzen inklusiv unten, exklusiv oben zu", () => {
    expect(fvgQuote("GBPUSD", 0.5, 3)).toBe(47);   // Erkennungsschwelle, unterstes Band
    expect(fvgQuote("GBPUSD", 0.99, 3)).toBe(47);
    expect(fvgQuote("GBPUSD", 1, 3)).toBe(52);     // Bandwechsel genau auf der Grenze
    expect(fvgQuote("GBPUSD", 7.99, 3)).toBe(75);
    expect(fvgQuote("GBPUSD", 8, 3)).toBe(91);     // oberstes Band, nach oben offen
    expect(fvgQuote("GBPUSD", 60, 3)).toBe(91);
  });

  it("kennt beide Einheiten, R als Default", () => {
    expect(fvgQuote("GBPUSD", 0.7, 3)).toBe(fvgQuote("GBPUSD", 0.7, 3, "R"));
    expect(fvgQuote("GBPUSD", 0.7, 15, "P")).toBe(42);
    expect(fvgQuote("GBPUSD", 10, 15, "P")).toBe(96);
  });

  it("liefert null, wo nichts gemessen wurde", () => {
    expect(fvgQuote("EURUSD", 2, 3)).toBeNull();
    expect(fvgQuote("GBPUSD", 0, 3)).toBeNull();
    expect(fvgQuote("GBPUSD", 2, 99)).toBeNull();  // Ziel ausserhalb der Leiter
  });

  // Die Baender sind von Hand aus ergebnis-fvg.txt uebertragen -- eine ausgelassene Zelle faellt
  // sonst erst auf, wenn die Anzeige sie braucht.
  it("hat in jedem Band jede Stufe beider Leitern", () => {
    for (const fvg of [0.5, 1.5, 2.5, 4, 6, 20]) {
      for (const r of [2, 3, 4, 5, 6, 7, 8, 9, 10]) expect(fvgQuote("GBPUSD", fvg, r)).toBeGreaterThan(0);
      for (const p of [10, 15, 20, 25, 30, 35, 40]) expect(fvgQuote("GBPUSD", fvg, p, "P")).toBeGreaterThan(0);
    }
    expect(FVG_BAND_N).toHaveLength(6);
    expect(FVG_BAND_N.reduce((a, b) => a + b, 0)).toBe(3282);
  });
});
