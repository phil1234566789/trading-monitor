// Bug-Report Philip 2026-07-26: ein M5-OB, das SOFORT nach einem LQ-Sweep entsteht, wurde nicht als
// Trade-Setup erkannt, weil detectTradeSetups bisher IMMER ein separat bestätigtes M5-Fraktal
// ("Protected Low/High", Williams-Periode 5 -> mind. 5 Kerzen/25min Bestätigungszeit) verlangte.
// Laut Philips Strategie ist aber BEIDES gültig: (Path A) ein bestätigtes Protected-Pivot, ODER
// (Path B) ein LS, das seit dem Sweep strukturell nicht gebrochen wurde (keine M5-Kerze schließt
// dagegen) + ein M5-OB kurz danach — explizit NICHT als Ersatz für Path A gedacht (Replay-Beispiel
// 08.07.2026 11:50: ein 1H-LS hält als Setup, obwohl zwischenzeitlich M5-Kerzen dagegen schließen —
// das funktioniert nur über Path A, weil dort keine closesBeyondLevel-Prüfung läuft).
import { describe, expect, it } from "vitest";
import { detectTradeSetups } from "../src/tradeSetup.js";

const params = {
  graceSec: 300,
  lsMaxLeadSecH1: 7200,
  lsMaxLeadSecM5: 2700,
  maxDistanceM5: 0.0005,
  maxSweepDistance: 0.0020, // 20 Pip ab dem Extrempunkt, wie der Produktions-Default
  maxLookbackSec: 6 * 3600,
  obMaxDelaySec: 3600,
  // Produktions-Default seit 2026-09-21: Check aus (Messergebnis, siehe
  // analysis/dr-reichweite/ergebnis-close-check.txt). Die Tests zur Regel selbst setzen ihn
  // explizit hoch — sonst würde die Regel hier gar nicht geprüft.
  closeCheckMaxAgeSec: 0,
  nowTime: 100_000,
};

// Long-Setup (dir=-1): fractal/ls sind "low"-Level (dir=-1 in ihrer eigenen LiquidityLevel-Form),
// setupObs mit dir=1 (bullische Lücke) bestätigen. Preise/Zeiten frei erfunden, nur die relative
// Lage zählt (LS unter dem Fraktal, OB nach dem jeweiligen Ankerzeitpunkt).
function lowLevel({ price, pivotTime, touched = true, touchedTime = null }) {
  return { price, dir: -1, pivotTime, touched, touchedTime: touchedTime ?? pivotTime, endTime: touchedTime ?? pivotTime };
}
function bullOb({ startTime, top = 1.3015, bottom = 1.2995 }) {
  return { dir: 1, top, bottom, startTime };
}

// Short-Setup (dir=1): fractal/ls sind "high"-Level (dir=1), setupObs mit dir=-1 (bärische Lücke)
// bestätigen. Spiegelbildlich zu lowLevel/bullOb oben — dir-Parametrisierung ist symmetrisch,
// diese Tests stellen sicher, dass das auch tatsächlich stimmt und nicht nur für Long getestet ist.
function highLevel({ price, pivotTime, touched = true, touchedTime = null }) {
  return { price, dir: 1, pivotTime, touched, touchedTime: touchedTime ?? pivotTime, endTime: touchedTime ?? pivotTime };
}
function bearOb({ startTime, top = 1.3015, bottom = 1.2995 }) {
  return { dir: -1, top, bottom, startTime };
}

describe("detectTradeSetups — Path A (bestätigtes Protected-Pivot, Altverhalten)", () => {
  it("findet ein Setup über ein noch unberührtes Fraktal + passendes LS + OB danach", () => {
    const fractal = lowLevel({ price: 1.3, pivotTime: 1000, touched: false });
    const ls = lowLevel({ price: 1.301, pivotTime: 500, touchedTime: 900 }); // über dem Fraktal (far side für dir=-1)
    const setupObs = [bullOb({ startTime: 1100 })];
    const setups = detectTradeSetups(-1, [fractal], [ls], [fractal], setupObs, params);
    expect(setups).toHaveLength(1);
    expect(setups[0].fractal).toBe(fractal);
    expect(setups[0].ls).toBe(ls);
  });

  it("bleibt gültig, auch wenn zwischenzeitlich eine M5-Kerze gegen das LS geschlossen hat (Replay-Beispiel 08.07. 11:50)", () => {
    const fractal = lowLevel({ price: 1.3, pivotTime: 1000, touched: false });
    const ls = lowLevel({ price: 1.301, pivotTime: 500, touchedTime: 900 });
    const setupObs = [bullOb({ startTime: 1100 })];
    // Kerze zwischen Sweep (900) und Fraktal (1000) schließt UNTER dem LS-Preis — für Path A
    // irrelevant, nur Path B prüft closesBeyondLevel.
    const m5Candles = [{ time: 950, open: 1.3005, high: 1.3006, low: 1.2998, close: 1.3 }];
    const setups = detectTradeSetups(-1, [fractal], [ls], [fractal], setupObs, params, m5Candles);
    expect(setups).toHaveLength(1);
  });

  it("findet weiterhin nichts ohne passenden OB nach dem Fraktal (unverändert)", () => {
    const fractal = lowLevel({ price: 1.3, pivotTime: 1000, touched: false });
    const ls = lowLevel({ price: 1.301, pivotTime: 500, touchedTime: 900 });
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

  // Regel 2 (Philip 2026-09-21): der Close-Check gilt nur noch für JUNGE gesweepte Level. Vorher
  // galt er unbegrenzt — genau das hat den schnellen Pfad bei jedem Sweep-and-Reclaim ausgeschaltet
  // und den Alarm 15 Minuten kosten lassen (Setup #1617).
  describe("Regel 2: Close-Check altersabhängig", () => {
    const setupObs = [bullOb({ startTime: 90_300, top: 1.34633, bottom: 1.34619 })];
    // Close UNTER dem LS-Preis, nach dem Sweep
    const m5Candles = [{ time: 90_100, open: 1.3455, high: 1.3456, low: 1.3453, close: 1.3454 }];
    const mitSchwelle = { ...params, closeCheckMaxAgeSec: 4 * 3600 };

    it("junges Level (Alter unter der Schwelle): der Close disqualifiziert den Sweep", () => {
      const jung = lowLevel({ price: 1.34579, pivotTime: 86_400, touchedTime: 90_000 }); // 1h alt
      expect(detectTradeSetups(-1, [], [jung], [], setupObs, mitSchwelle, m5Candles)).toEqual([]);
    });

    it("altes Level (Alter über der Schwelle): derselbe Close disqualifiziert nicht mehr", () => {
      const alt = lowLevel({ price: 1.34579, pivotTime: 200, touchedTime: 90_000 }); // ~25h alt
      const setups = detectTradeSetups(-1, [], [alt], [], setupObs, mitSchwelle, m5Candles);
      expect(setups).toHaveLength(1);
      expect(setups[0].ls).toBe(alt);
    });

    it("mit dem gemessenen Default (Check aus) hält auch das junge Level", () => {
      const jung = lowLevel({ price: 1.34579, pivotTime: 86_400, touchedTime: 90_000 });
      expect(detectTradeSetups(-1, [], [jung], [], setupObs, params, m5Candles)).toHaveLength(1);
    });
  });

  it("ignoriert Path B ohne m5Candles-Argument (Rückwärtskompatibilität, kein Crash)", () => {
    const ls = lowLevel({ price: 1.34579, pivotTime: 200, touchedTime: 90_000 });
    const setupObs = [bullOb({ startTime: 90_300, top: 1.34633, bottom: 1.34619 })];
    expect(detectTradeSetups(-1, [], [ls], [], setupObs, params)).toEqual([]);
  });

  it("meldet dasselbe (ls, ob)-Paar nicht doppelt, wenn Path A UND Path B zutreffen", () => {
    // Path A: shared als Fraktal (touched=false), lsForPathA als LS.
    // Path B: lsForPathA selbst (touched=true) direkt als LS, mit demselben OB.
    const shared = lowLevel({ price: 1.3, pivotTime: 500, touched: false, touchedTime: 500 });
    const lsForPathA = lowLevel({ price: 1.301, pivotTime: 400, touchedTime: 450 });
    const setupObs = [bullOb({ startTime: 600 })];
    const m5Candles = [];
    const setups = detectTradeSetups(-1, [shared], [lsForPathA], [shared], setupObs, params, m5Candles);
    expect(setups).toHaveLength(1); // nicht 2 (einmal je Pfad)
    expect(setups[0].fractal).toBe(shared); // Path A gewinnt (bringt den echten Fraktal-Datensatz mit)
  });
});

// Philip 2026-09-20: "sobald es erkannt worden ist, gilt es halt einfach als Trade Setup" — ein
// OB = ein Setup, auch wenn die beiden Pfade auf VERSCHIEDENE Sweeps laufen. Vorher schlüsselte
// die Entduplizierung auf (ls, ob) und ließ genau diesen Fall als zwei Setups durch (295 solcher
// Paare im Bestand, 20 davon mit unterschiedlichem ls).
describe("detectTradeSetups — ein Setup je bestätigender M5-OB", () => {
  it("meldet denselben OB nur einmal, auch wenn Path A und Path B verschiedene Sweeps gefunden haben", () => {
    const fractal = lowLevel({ price: 1.3, pivotTime: 500, touched: false });
    const lsForPathA = lowLevel({ price: 1.3005, pivotTime: 400, touchedTime: 450 });
    const lsForPathB = lowLevel({ price: 1.301, pivotTime: 300, touchedTime: 480 });
    const setupObs = [bullOb({ startTime: 600 })];
    const setups = detectTradeSetups(-1, [fractal], [lsForPathA, lsForPathB], [fractal], setupObs, params, []);
    expect(setups).toHaveLength(1);
    expect(setups[0].pathType).toBe("A"); // Path A beansprucht den OB, Path B füllt nur freie
  });

  it("nimmt bei zwei Fraktalen auf denselben OB das jüngere (wie findProtectedFractal in der Deno-Kopie)", () => {
    const frueh = lowLevel({ price: 1.3, pivotTime: 500, touched: false });
    const spaet = lowLevel({ price: 1.3005, pivotTime: 560, touched: false });
    const ls = lowLevel({ price: 1.301, pivotTime: 400, touchedTime: 550 });
    const setupObs = [bullOb({ startTime: 600 })];
    const setups = detectTradeSetups(-1, [frueh, spaet], [ls], [frueh, spaet], setupObs, params, []);
    expect(setups).toHaveLength(1);
    expect(setups[0].fractal).toBe(spaet);
  });
});

// Regel 3 (Philip 2026-09-21): wurden bis zum bestätigenden OB MEHRERE Level gesweept, entscheiden
// zwei verschiedene davon — das älteste trägt die Qualität (ls_price/ls_timeframe/Alter im Alarm),
// das früheste den Fenster-Start von widenObForSweep und damit die Invalidierung.
describe("detectTradeSetups — mehrere Sweeps je OB", () => {
  // lsAlt wurde früher berührt UND ist älter; das tiefste Low liegt in der Kerze seines Touches,
  // liegt also nur im Fenster, wenn der FRÜHESTE Touch den Start setzt.
  const lsAlt = lowLevel({ price: 1.3003, pivotTime: 100, touchedTime: 800 }); // Alter 700
  const lsJung = lowLevel({ price: 1.3002, pivotTime: 700, touchedTime: 900 }); // Alter 200
  const setupObs = [bullOb({ startTime: 1100, top: 1.301, bottom: 1.3005 })];
  const nah = { ...params, nowTime: 1100 }; // Touch-Zeiten liegen hier dicht am Jetzt (maxLookbackSec)
  const m5Candles = [
    { time: 800, open: 1.3, high: 1.3005, low: 1.2995, close: 1.3004 },
    { time: 900, open: 1.3, high: 1.3005, low: 1.2998, close: 1.3004 },
    { time: 1100, open: 1.3005, high: 1.301, low: 1.3004, close: 1.301 },
  ];

  it("nimmt den ÄLTESTEN Sweep als ls und den FRÜHESTEN Touch als Fenster-Start", () => {
    const setups = detectTradeSetups(-1, [], [], [lsAlt, lsJung], setupObs, nah, m5Candles);
    expect(setups).toHaveLength(1);
    expect(setups[0].ls).toBe(lsAlt);
    expect(setups[0].obBottom).toBe(1.2995); // Fenster ab 800, nicht ab 900 (das wäre 1.2998)
  });

  it("gibt ALLE Sweeps mit, ältester zuerst und je mit seiner Zeitebene", () => {
    const lsH1 = lowLevel({ price: 1.3004, pivotTime: 50, touchedTime: 850 }); // Alter 800, der älteste
    const setups = detectTradeSetups(-1, [], [lsH1], [lsAlt, lsJung], setupObs, nah, m5Candles);
    expect(setups).toHaveLength(1);
    expect(setups[0].ls).toBe(lsH1);
    // Reihenfolge und Zeitebene sind das, was die Kindtabelle trade_setup_sweeps speichert
    // (Migration 20260921210000) — sweeps[0] ist der, der in trade_setups.ls_* landet.
    expect(setups[0].sweeps.map((sw) => [sw.level.price, sw.timeframe])).toEqual([
      [1.3004, "1H"],
      [1.3003, "5M"],
      [1.3002, "5M"],
    ]);
  });

  it("sammelt kein Level ein, das weiter als maxSweepDistance weg liegt", () => {
    // 35 Pip unter dem Extremtief (1.2995) — zeitlich im Fenster, preislich ein anderes Ereignis.
    // Genau der Fall aus GBPUSD-Setup #1139 (17.04.2026), nur kleiner.
    const lsFern = lowLevel({ price: 1.296, pivotTime: 100, touchedTime: 850 });
    const setups = detectTradeSetups(-1, [], [], [lsAlt, lsJung, lsFern], setupObs, nah, m5Candles);
    expect(setups).toHaveLength(1);
    expect(setups[0].sweeps.map((sw) => sw.level.price)).toEqual([1.3003, 1.3002]);
  });

  it("filtert nicht gegen den ältesten Sweep — der wird erst aus dem gefilterten Topf gekürt", () => {
    // lsFern ist mit Abstand das ÄLTESTE (Alter 750) und läge damit als Anker vorne. Gefiltert
    // wird trotzdem gegen das Extrem, also bleibt lsAlt drin und lsFern fliegt raus — andersherum
    // wäre lsAlt das Opfer gewesen.
    const lsFern = lowLevel({ price: 1.296, pivotTime: 100, touchedTime: 850 });
    const setups = detectTradeSetups(-1, [], [], [lsJung, lsAlt, lsFern], setupObs, nah, m5Candles);
    expect(setups[0].sweeps.map((sw) => sw.level.price)).toEqual([1.3003, 1.3002]);
    expect(setups[0].ls.price).toBe(1.3003);
  });

  // Eigene Fixture für die Radius-Tests: Extremtief 1.2995 liegt in der Kerze des ersten Touches,
  // der OB selbst reicht nur bis 1.3005 herunter.
  const extremObs = [bullOb({ startTime: 1100, top: 1.3015, bottom: 1.3005 })];
  const extremKerzen = [
    { time: 800, open: 1.301, high: 1.3012, low: 1.2995, close: 1.3 },
    { time: 850, open: 1.3, high: 1.3005, low: 1.2998, close: 1.3004 },
    { time: 1100, open: 1.3005, high: 1.3015, low: 1.3004, close: 1.3015 },
  ];

  it("misst maxSweepDistance ab dem Extrempunkt, nicht ab dem gefundenen Sweep", () => {
    // Auslöser GBPUSD-Setup #4678 (23.09.2026): das fachlich tragende Level liegt am Extrem des
    // Moves. Ab lsPfad gemessen sind es 25 Pip und es flog raus, ab dem Extremtief 1.2995 sind es
    // 10 Pip und es bleibt — und trägt als das ältere sogar die ls_*-Spalten.
    const lsPfad = lowLevel({ price: 1.301, pivotTime: 400, touchedTime: 800 });
    const lsAmExtrem = lowLevel({ price: 1.2985, pivotTime: 100, touchedTime: 850 });
    const setups = detectTradeSetups(-1, [], [], [lsPfad, lsAmExtrem], extremObs, nah, extremKerzen);
    expect(setups[0].sweeps.map((sw) => sw.level.price)).toEqual([1.2985, 1.301]);
  });

  // Philip 2026-09-23: "die sweeps, die von extrempunkt aus mehr als 20 pips entfernt sind sollen
  // nicht mehr als trade-setup gelten" — der Radius gilt auch für den tragenden Sweep selbst, über
  // den der Pfad hereinkam. Vorher kam ownLs ungefiltert in die Menge und füllte weiter ls_*.
  it("verwirft das Setup ganz, wenn auch der gefundene Sweep zu weit vom Extrem liegt", () => {
    // 35 Pip über dem Extremtief 1.2995 — der Sweep erklärt die Umkehr nicht.
    const lsZuWeit = lowLevel({ price: 1.303, pivotTime: 400, touchedTime: 800 });
    expect(detectTradeSetups(-1, [], [], [lsZuWeit], extremObs, nah, extremKerzen)).toEqual([]);
  });

  it("behält das Setup, wenn neben dem zu weiten Sweep ein gültiger liegt", () => {
    // Derselbe zu weite Sweep, aber ein zweites Level 5 Pip neben dem Extrem: das Setup bleibt und
    // wird von diesem getragen, statt mit dem falschen Level gemeldet zu werden.
    const lsZuWeit = lowLevel({ price: 1.303, pivotTime: 400, touchedTime: 800 });
    const lsGueltig = lowLevel({ price: 1.299, pivotTime: 300, touchedTime: 850 });
    const setups = detectTradeSetups(-1, [], [], [lsZuWeit, lsGueltig], extremObs, nah, extremKerzen);
    expect(setups).toHaveLength(1);
    expect(setups[0].sweeps.map((sw) => sw.level.price)).toEqual([1.299]);
    expect(setups[0].ls.price).toBe(1.299);
  });

  it("rechnet über Path A dieselben Zahlen aus (ein OB, ein Ergebnis, egal welcher Pfad zuerst war)", () => {
    const fractal = lowLevel({ price: 1.3, pivotTime: 1000, touched: false });
    const setups = detectTradeSetups(-1, [fractal], [], [lsAlt, lsJung, fractal], setupObs, nah, m5Candles);
    expect(setups).toHaveLength(1);
    expect(setups[0].pathType).toBe("A");
    expect(setups[0].fractal).toBe(fractal);
    expect(setups[0].ls).toBe(lsAlt); // nicht der jüngste Sweep, den findBestLsMatch für Path A fand
    expect(setups[0].obBottom).toBe(1.2995);
  });
});

describe("detectTradeSetups — Short (dir=1, spiegelbildlich zu Long)", () => {
  it("Path A: findet ein Short-Setup über ein noch unberührtes Fraktal + passendes LS + OB danach", () => {
    const fractal = highLevel({ price: 1.301, pivotTime: 1000, touched: false });
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

  it("Path B: der Close-Check disqualifiziert auch beim Short nur ein junges Level", () => {
    const setupObs = [bearOb({ startTime: 90_300, top: 1.34633, bottom: 1.34619 })];
    const m5Candles = [{ time: 90_100, open: 1.3461, high: 1.3463, low: 1.346, close: 1.3462 }]; // Close > 1.34579
    const mitSchwelle = { ...params, closeCheckMaxAgeSec: 4 * 3600 };
    const jung = highLevel({ price: 1.34579, pivotTime: 86_400, touchedTime: 90_000 });
    const alt = highLevel({ price: 1.34579, pivotTime: 200, touchedTime: 90_000 });
    expect(detectTradeSetups(1, [], [jung], [], setupObs, mitSchwelle, m5Candles)).toEqual([]);
    expect(detectTradeSetups(1, [], [alt], [], setupObs, mitSchwelle, m5Candles)).toHaveLength(1);
  });
});
