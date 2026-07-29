// Bug-Report Philip 2026-07-26: ein M5-OB, das SOFORT nach einem LQ-Sweep entsteht, wurde nicht als
// Trade-Setup erkannt, weil detectTradeSetups bisher IMMER ein separat bestätigtes M5-Fraktal
// ("Protected Low/High", Williams-Periode 5 -> mind. 5 Kerzen/25min Bestätigungszeit) verlangte.
// Laut Philips Strategie ist aber BEIDES gültig: (Path A) ein bestätigtes Protected-Pivot, ODER
// (Path B) ein LS, das seit dem Sweep strukturell nicht gebrochen wurde (keine M5-Kerze schließt
// dagegen) + ein M5-OB kurz danach — explizit NICHT als Ersatz für Path A gedacht (Replay-Beispiel
// 08.07.2026 11:50: ein 1H-LS hält als Setup, obwohl zwischenzeitlich M5-Kerzen dagegen schließen —
// das funktioniert nur über Path A, weil dort keine closesBeyondLevel-Prüfung läuft).
import { describe, expect, it } from "vitest";
import { detectTradeSetups, tradeSetupObBoxBounds } from "../src/tradeSetup.js";

const params = {
  graceSec: 300,
  lsMaxLeadSecH1: 7200,
  lsMaxLeadSecM5: 2700,
  maxDistanceM5: 0.0005,
  maxLookbackSec: 6 * 3600,
  obMaxDelaySec: 3600,
  nowTime: 100_000,
};

// Long-Setup (dir=-1): fractal/ls sind "low"-Level (dir=-1 in ihrer eigenen LiquidityLevel-Form),
// setupObs mit dir=1 (bullische Lücke) bestätigen. Preise/Zeiten frei erfunden, nur die relative
// Lage zählt (LS unter dem Fraktal, OB nach dem jeweiligen Ankerzeitpunkt).
function lowLevel({ price, pivotTime, touched = true, touchedTime = null }) {
  return { price, dir: -1, pivotTime, touched, touchedTime: touchedTime ?? pivotTime, endTime: touchedTime ?? pivotTime };
}
function bullOb({ startTime, top = 1.35, bottom = 1.34 }) {
  return { dir: 1, top, bottom, startTime };
}

// Short-Setup (dir=1): fractal/ls sind "high"-Level (dir=1), setupObs mit dir=-1 (bärische Lücke)
// bestätigen. Spiegelbildlich zu lowLevel/bullOb oben — dir-Parametrisierung ist symmetrisch,
// diese Tests stellen sicher, dass das auch tatsächlich stimmt und nicht nur für Long getestet ist.
function highLevel({ price, pivotTime, touched = true, touchedTime = null }) {
  return { price, dir: 1, pivotTime, touched, touchedTime: touchedTime ?? pivotTime, endTime: touchedTime ?? pivotTime };
}
function bearOb({ startTime, top = 1.35, bottom = 1.34 }) {
  return { dir: -1, top, bottom, startTime };
}

describe("detectTradeSetups — Path A (bestätigtes Protected-Pivot, Altverhalten)", () => {
  it("findet ein Setup über ein noch unberührtes Fraktal + passendes LS + OB danach", () => {
    const fractal = lowLevel({ price: 1.3, pivotTime: 1000, touched: false });
    const ls = lowLevel({ price: 1.31, pivotTime: 500, touchedTime: 900 }); // über dem Fraktal (far side für dir=-1)
    const setupObs = [bullOb({ startTime: 1100 })];
    const setups = detectTradeSetups(-1, [fractal], [ls], [fractal], setupObs, params);
    expect(setups).toHaveLength(1);
    expect(setups[0].fractal).toBe(fractal);
    expect(setups[0].ls).toBe(ls);
  });

  it("bleibt gültig, auch wenn zwischenzeitlich eine M5-Kerze gegen das LS geschlossen hat (Replay-Beispiel 08.07. 11:50)", () => {
    const fractal = lowLevel({ price: 1.3, pivotTime: 1000, touched: false });
    const ls = lowLevel({ price: 1.31, pivotTime: 500, touchedTime: 900 });
    const setupObs = [bullOb({ startTime: 1100 })];
    // Kerze zwischen Sweep (900) und Fraktal (1000) schließt UNTER dem LS-Preis — für Path A
    // irrelevant, nur Path B prüft closesBeyondLevel.
    const m5Candles = [{ time: 950, open: 1.305, high: 1.306, low: 1.304, close: 1.305 }];
    const setups = detectTradeSetups(-1, [fractal], [ls], [fractal], setupObs, params, m5Candles);
    expect(setups).toHaveLength(1);
  });

  it("findet weiterhin nichts ohne passenden OB nach dem Fraktal (unverändert)", () => {
    const fractal = lowLevel({ price: 1.3, pivotTime: 1000, touched: false });
    const ls = lowLevel({ price: 1.31, pivotTime: 500, touchedTime: 900 });
    expect(detectTradeSetups(-1, [fractal], [ls], [fractal], [], params)).toEqual([]);
  });
});

describe("detectTradeSetups — Path B (sofortige Bestätigung ohne separates Fraktal)", () => {
  it("findet ein Setup, wenn der M5-OB sofort nach dem LS kommt, ohne bestätigtes Fraktal (Bug-Report-Fall)", () => {
    const ls = lowLevel({ price: 1.34579, pivotTime: 200, touchedTime: 90_000 });
    const setupObs = [bullOb({ startTime: 90_300, top: 1.34633, bottom: 1.34619 })];
    const m5Candles = [{ time: 90_100, open: 1.346, high: 1.3462, low: 1.3459, close: 1.3461 }]; // schließt nicht unter ls.price
    const setups = detectTradeSetups(-1, [], [ls], [], setupObs, params, m5Candles);
    expect(setups).toHaveLength(1);
    expect(setups[0].ls).toBe(ls);
    expect(setups[0].fractal).toBe(ls); // kein eigenes Fraktal -> fractal fällt auf ls zurück
    expect(setups[0].obTop).toBe(1.34633);
  });

  it("findet NICHTS, wenn seit dem Sweep eine M5-Kerze unter den LS-Preis geschlossen hat", () => {
    const ls = lowLevel({ price: 1.34579, pivotTime: 200, touchedTime: 90_000 });
    const setupObs = [bullOb({ startTime: 90_300 })];
    const m5Candles = [{ time: 90_100, open: 1.3455, high: 1.3456, low: 1.3453, close: 1.3454 }]; // Close < 1.34579
    expect(detectTradeSetups(-1, [], [ls], [], setupObs, params, m5Candles)).toEqual([]);
  });

  it("ignoriert Path B ohne m5Candles-Argument (Rückwärtskompatibilität, kein Crash)", () => {
    const ls = lowLevel({ price: 1.34579, pivotTime: 200, touchedTime: 90_000 });
    const setupObs = [bullOb({ startTime: 90_300 })];
    expect(detectTradeSetups(-1, [], [ls], [], setupObs, params)).toEqual([]);
  });

  it("meldet dasselbe (ls, ob)-Paar nicht doppelt, wenn Path A UND Path B zutreffen", () => {
    // fractal ist selbst das LS-Level (touched=false macht es zum gültigen Path-A-Fraktal-
    // Kandidaten UND Path B würde theoretisch dasselbe ls erneut finden, wenn es in h1/m5Levels
    // separat als touched-Level vorläge) — hier stattdessen der einfachere Fall: fractal und ls
    // sind identisch bepreist/zeitlich, sodass beide Pfade denselben setupKey erzeugen.
    const shared = lowLevel({ price: 1.3, pivotTime: 500, touched: false, touchedTime: 500 });
    const lsForPathA = lowLevel({ price: 1.31, pivotTime: 400, touchedTime: 450 });
    const setupObs = [bullOb({ startTime: 600 })];
    const m5Candles = [];
    // Path A: shared als Fraktal (touched=false), lsForPathA als LS.
    // Path B: lsForPathA selbst (touched=true) direkt als LS, mit demselben OB.
    const setups = detectTradeSetups(-1, [shared], [lsForPathA], [shared], setupObs, params, m5Candles);
    expect(setups).toHaveLength(1); // nicht 2 (einmal je Pfad)
    expect(setups[0].fractal).toBe(shared); // Path A gewinnt (bringt den echten Fraktal-Datensatz mit)
  });
});

describe("detectTradeSetups — Short (dir=1, spiegelbildlich zu Long)", () => {
  it("Path A: findet ein Short-Setup über ein noch unberührtes Fraktal + passendes LS + OB danach", () => {
    const fractal = highLevel({ price: 1.31, pivotTime: 1000, touched: false });
    const ls = highLevel({ price: 1.3, pivotTime: 500, touchedTime: 900 }); // unter dem Fraktal (far side für dir=1)
    const setupObs = [bearOb({ startTime: 1100 })];
    const setups = detectTradeSetups(1, [fractal], [ls], [fractal], setupObs, params);
    expect(setups).toHaveLength(1);
    expect(setups[0].fractal).toBe(fractal);
    expect(setups[0].ls).toBe(ls);
  });

  it("Path B: findet ein Short-Setup, wenn der M5-OB sofort nach dem LS kommt, ohne bestätigtes Fraktal", () => {
    const ls = highLevel({ price: 1.34579, pivotTime: 200, touchedTime: 90_000 });
    const setupObs = [bearOb({ startTime: 90_300, top: 1.34633, bottom: 1.34619 })];
    const m5Candles = [{ time: 90_100, open: 1.3455, high: 1.3457, low: 1.3453, close: 1.3454 }]; // schließt nicht über ls.price
    const setups = detectTradeSetups(1, [], [ls], [], setupObs, params, m5Candles);
    expect(setups).toHaveLength(1);
    expect(setups[0].fractal).toBe(ls); // kein eigenes Fraktal -> fractal fällt auf ls zurück
  });

  it("Path B: findet NICHTS, wenn seit dem Sweep eine M5-Kerze über den LS-Preis geschlossen hat", () => {
    const ls = highLevel({ price: 1.34579, pivotTime: 200, touchedTime: 90_000 });
    const setupObs = [bearOb({ startTime: 90_300 })];
    const m5Candles = [{ time: 90_100, open: 1.3461, high: 1.3463, low: 1.346, close: 1.3462 }]; // Close > 1.34579
    expect(detectTradeSetups(1, [], [ls], [], setupObs, params, m5Candles)).toEqual([]);
  });
});

// Bug-Report Philip 2026-07-29 ("Box Oberkante = OB Oberkante = FVG Unterkante, alles dasselbe"):
// das bullische OB {top: c1.high, bottom: impulse.low} (siehe orderBlocks.js) teilt sich mit
// seiner zugehörigen FVG GENAU eine Kante — c1.high, also obTop. tradeSetupObBoxBounds() nutzte
// für Long fälschlich obBottom (die GEGENÜBERLIEGENDE OB-Kante, tief im Docht der Impuls-Kerze —
// hat mit der FVG nichts zu tun), für Short spiegelbildlich obTop statt obBottom. Zahlen aus dem
// echten EURUSD-28.07.-Fall (siehe tradeSetupPipeline.test.js): Fraktal 1,13542, OB 1,13564–1,13578.
describe("tradeSetupObBoxBounds", () => {
  it("Long: Box-Oberkante ist obTop (= FVG-Unterkante), nicht obBottom", () => {
    const setup = { dir: -1, fractal: { price: 1.13542 }, obTop: 1.13578, obBottom: 1.13564 };
    expect(tradeSetupObBoxBounds(setup)).toEqual({ top: 1.13578, bottom: 1.13542 });
  });

  it("Short: Box-Unterkante ist obBottom (= FVG-Oberkante), nicht obTop", () => {
    const setup = { dir: 1, fractal: { price: 1.34633 }, obTop: 1.3462, obBottom: 1.34605 };
    expect(tradeSetupObBoxBounds(setup)).toEqual({ top: 1.34633, bottom: 1.34605 });
  });
});
