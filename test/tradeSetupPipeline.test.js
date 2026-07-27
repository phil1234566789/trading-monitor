// Feature-Wunsch Philip 2026-07-26: "sicherstellen, dass M5 Trade Setups immer garantiert
// funktionieren" — im Unterschied zu tradeSetup.test.js (hand-gebaute, synthetische
// LiquidityLevel/OB-Objekte für die einzelnen Verzweigungen von detectTradeSetups) läuft hier die
// GESAMTE Pipeline wie in PriceChart.vue (computeTradeSetups): echte M5-Kerzen-Fixtures ->
// detectLiquidityLevels -> detectSetupObs -> detectTradeSetups, geprüft gegen ein konkretes,
// tatsächlich im Chart beobachtetes Setup (siehe SCENARIOS unten für die Herkunft je Fixture).
// Als data-driven describe.each aufgebaut, damit neue Fixtures (weitere von Philip bestätigte
// Setups) einfach als zusätzlicher SCENARIOS-Eintrag dazukommen, ohne die Testlogik zu duplizieren.
import { describe, expect, it } from "vitest";
import { detectLiquidityLevels } from "../src/liquidity.js";
import { detectSetupObs, detectTradeSetups } from "../src/tradeSetup.js";
import gbpusdM5LongSetup from "./fixtures/gbpusd-m5-2026-07-08-long-setup.json";
import gbpusdH1LongSetup from "./fixtures/gbpusd-h1-2026-07-08-long-setup.json";
import gbpusdM5LongSetup0720 from "./fixtures/gbpusd-m5-2026-07-20-long-setup.json";

// Dieselben Konstanten wie TRADE_SETUP_* in PriceChart.vue/tradeSetupParams in poi-watcher/index.ts
// — bei Änderungen dort auch hier nachziehen, sonst testet dieser Test nicht mehr die echte Config.
const TRADE_SETUP_M5_FRACTAL_PERIOD = 5;
const TRADE_SETUP_H1_FRACTAL_PERIOD = 10;
const TRADE_SETUP_GRACE_SEC = 5 * 60;
const TRADE_SETUP_LS_MAX_LEAD_SEC_H1 = 120 * 60;
const TRADE_SETUP_LS_MAX_LEAD_SEC_M5 = 45 * 60;
const TRADE_SETUP_PIP_SIZE = 0.0001;
const TRADE_SETUP_LS_MAX_DISTANCE_M5 = 5.0 * TRADE_SETUP_PIP_SIZE;
const TRADE_SETUP_OB_MAX_DELAY_SEC = 60 * 60;
const TRADE_SETUP_LOOKBACK_SEC = 6 * 60 * 60;

const SCENARIOS = [
  {
    // Bug-Report Philip 2026-07-26: Replay-Beispiel für den neuen Path B (LS hält strukturell,
    // OB kommt via findImmediateLsSetup ohne separat bestätigtes Fraktal — fractal === ls). Von
    // Philip live im Replay am 08.07.2026 12:30 (Chart-Zeit) verifiziert und als JSON aus dem
    // Debug-Metadaten-Panel übernommen (siehe .debug/metadata.json "Long (5)" zu diesem
    // Zeitpunkt) — genau das erwartete Setup unten.
    name: "GBPUSD M5, 06.07.-08.07.2026 (Long via Path B, fractal===ls)",
    fixture: gbpusdM5LongSetup,
    dir: -1,
    expected: {
      fractalPrice: 1.33314,
      fractalPivotTime: 1783327500,
      lsPrice: 1.33314,
      lsPivotTime: 1783327500,
      lsTouchedTime: 1783501800,
      // obTop/obBottom seit Bug-Report Philip 2026-07-27 ("das ist die FVG, nicht die M5-OB")
      // enger — Box geht jetzt bis zur Impuls-Kerzen-Kante statt bis zur aktuellen Kerze, siehe
      // detectSetupObs. Setup-Erkennung selbst (ls.pivotTime/obStartTime) unverändert.
      obTop: 1.33429,
      obBottom: 1.3341,
      obStartTime: 1783503900,
      isPathB: true,
    },
  },
  {
    // Der ursprüngliche Bug-Report-Fall selbst (Chat 2026-07-26: "warum wird im M5 bei der
    // FVG-Candle um 09:00 am 20.07.2026 keine M5 bullische OB erkannt"), jetzt als dauerhafte
    // Regression gesichert — Philip im Replay 20.07.2026 09:10 verifiziert ("Long (5)" im
    // Debug-Metadaten-Panel), 10 Minuten nach dem Sweep, WEIT bevor ein period-5-Fraktal
    // (25min) confirmable wäre -> nur über Path B erkennbar.
    name: "GBPUSD M5, 14.07.-20.07.2026 (Long via Path B, ursprünglicher Bug-Report)",
    fixture: gbpusdM5LongSetup0720,
    dir: -1,
    expected: {
      fractalPrice: 1.34579,
      fractalPivotTime: 1784516700,
      lsPrice: 1.34579,
      lsPivotTime: 1784516700,
      lsTouchedTime: 1784530800,
      // obTop/obBottom seit Bug-Report Philip 2026-07-27 ("das ist die FVG, nicht die M5-OB")
      // enger — Box geht jetzt bis zur Impuls-Kerzen-Kante statt bis zur aktuellen Kerze, siehe
      // detectSetupObs. Setup-Erkennung selbst (ls.pivotTime/obStartTime) unverändert.
      obTop: 1.34619,
      obBottom: 1.34567,
      obStartTime: 1784530800,
      isPathB: true,
    },
  },
  {
    // Path A (bestätigtes Protected-Pivot), aus DERSELBEN M5-Fixture wie der Path-B-Fall oben —
    // zeitgleich zum 1.33314-Sweep gab es einen zweiten, tieferen LQ-Sweep bei 1.33292 (Chat
    // 2026-07-26: "hier kommen zwei LQ-Sweeps auf einmal", sichtbar bei Long-Historie=2). Dieser
    // sweept-und-neu-formt sich zu einem EIGENEN, separat bestätigten M5-Fraktal (1.33239,
    // Williams-Periode 5) — anders als beim Path-B-Fall ist `fractal` hier NICHT `ls` (fractal
    // 1.33239 != ls 1.33292), das ist die Unterscheidung, die diesen Fall als Path A markiert.
    // Braucht (anders als die beiden Fälle oben) ECHTE H1-Kerzen: der 1.33292-Sweep ist H1-
    // Ursprungs (pivotTime 07:00 liegt zufällig auch auf einer M5-Grenze, aber der Abstand
    // Fraktal<->LS von 5,3 Pip liegt knapp ÜBER TRADE_SETUP_LS_MAX_DISTANCE_M5 (5 Pip) — als
    // reines M5-Level würde findLsInArray es also verwerfen; nur der H1-Pfad kennt kein
    // Distanzlimit). H1-Fixture aus demselben Replay-Zeitpunkt/derselben Live-Quelle gezogen wie
    // die M5-Fixture, sonst könnten leicht abweichende OHLC-Werte (anderer Feed/Snapshot) genau
    // diesen knappen Grenzfall verfälschen.
    name: "GBPUSD M5+H1, 06.07.-08.07.2026 (Long via Path A, eigenes bestätigtes Fraktal, zweiter LQ-Sweep zeitgleich zu Path B)",
    fixture: gbpusdM5LongSetup,
    h1Fixture: gbpusdH1LongSetup,
    dir: -1,
    expected: {
      fractalPrice: 1.33239,
      fractalPivotTime: 1783501800,
      lsPrice: 1.33292,
      lsPivotTime: 1783321200,
      lsTouchedTime: 1783501200,
      // obTop/obBottom seit Bug-Report Philip 2026-07-27 ("das ist die FVG, nicht die M5-OB")
      // enger — Box geht jetzt bis zur Impuls-Kerzen-Kante statt bis zur aktuellen Kerze, siehe
      // detectSetupObs. Setup-Erkennung selbst (ls.pivotTime/obStartTime) unverändert.
      obTop: 1.33429,
      obBottom: 1.3341,
      obStartTime: 1783503900,
      isPathB: false,
    },
  },
];

describe("Trade-Setup-Pipeline (echte M5-/H1-Kerzen-Fixtures, wie computeTradeSetups in PriceChart.vue)", () => {
  it.each(SCENARIOS)("$name", ({ fixture, h1Fixture, dir, expected }) => {
    const { highs: m5Highs, lows: m5Lows } = detectLiquidityLevels(fixture, TRADE_SETUP_M5_FRACTAL_PERIOD);
    // h1Fixture optional: die meisten Setups sind reine M5-Sweeps und brauchen kein H1-Fixture
    // (leeres h1Levels-Array reicht) — nur wenn das erwartete LS tatsächlich H1-Ursprungs ist
    // (siehe Kommentar beim Path-A-Szenario oben), braucht es echte H1-Kerzen.
    const { highs: h1Highs, lows: h1Lows } = h1Fixture
      ? detectLiquidityLevels(h1Fixture, TRADE_SETUP_H1_FRACTAL_PERIOD)
      : { highs: [], lows: [] };
    const setupObs = detectSetupObs(fixture);
    const params = {
      graceSec: TRADE_SETUP_GRACE_SEC,
      lsMaxLeadSecH1: TRADE_SETUP_LS_MAX_LEAD_SEC_H1,
      lsMaxLeadSecM5: TRADE_SETUP_LS_MAX_LEAD_SEC_M5,
      maxDistanceM5: TRADE_SETUP_LS_MAX_DISTANCE_M5,
      maxLookbackSec: TRADE_SETUP_LOOKBACK_SEC,
      obMaxDelaySec: TRADE_SETUP_OB_MAX_DELAY_SEC,
      nowTime: fixture[fixture.length - 1].time,
    };
    const fractalLevels = dir === 1 ? m5Highs : m5Lows;
    const h1Levels = dir === 1 ? h1Highs : h1Lows;
    const m5Levels = fractalLevels;
    const setups = detectTradeSetups(dir, fractalLevels, h1Levels, m5Levels, setupObs, params, fixture);

    const match = setups.find(
      (s) => s.ls.pivotTime === expected.lsPivotTime && s.obStartTime === expected.obStartTime,
    );
    expect(match, `kein Setup mit ls.pivotTime=${expected.lsPivotTime}/obStartTime=${expected.obStartTime} gefunden (${setups.length} Setups gesamt)`).toBeDefined();
    expect(match.fractal.price).toBeCloseTo(expected.fractalPrice, 5);
    expect(match.fractal.pivotTime).toBe(expected.fractalPivotTime);
    expect(match.ls.price).toBeCloseTo(expected.lsPrice, 5);
    expect(match.ls.touchedTime).toBe(expected.lsTouchedTime);
    expect(match.obTop).toBeCloseTo(expected.obTop, 5);
    expect(match.obBottom).toBeCloseTo(expected.obBottom, 5);
    // fractal === ls (Path B, kein separat bestätigtes Fraktal) vs. fractal !== ls (Path A, echtes
    // Protected-Pivot) — dokumentiert/prüft, über welchen Pfad das Setup gefunden wurde.
    expect(match.fractal === match.ls).toBe(expected.isPathB);
    // pathType ("A"/"B", Chat 2026-07-26) speist die "Typ A/B"-Beschriftung in TSC/OB-Label —
    // muss mit derselben fractal===ls-Unterscheidung übereinstimmen.
    expect(match.pathType).toBe(expected.isPathB ? "B" : "A");
  });
});
