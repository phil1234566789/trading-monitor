import { describe, expect, it } from "vitest";
import { mergePinnedLevels, computeHtfLiquidityLevels, mergeDbLiquidityLevels } from "../src/priceChartLiquidity.js";

function candle(time, low, high) {
  return { time, low, high, open: (low + high) / 2, close: (low + high) / 2 };
}

// Task "Pin-Kontext: gepinnte Objekte direkt rendern" (Chat 2026-08-17/18) — ein gepinntes Level
// bleibt sichtbar, auch wenn showLiquidity aus ist oder der Chart auf einem anderen Timeframe steht.
describe("mergePinnedLevels", () => {
  const candles = [candle(100, 1.0, 1.1), candle(200, 1.15, 1.25), candle(300, 0.9, 1.0)];

  it("gibt levels unverändert zurück, wenn keine Pins vorliegen", () => {
    const levels = [{ dir: 1, pivotTime: 100 }];
    expect(mergePinnedLevels(levels, [], candles)).toBe(levels);
  });

  it("dedupliziert per Natural Key — bereits gezeichnetes Level wird nicht doppelt hinzugefügt", () => {
    const levels = [{ dir: 1, pivotTime: 100 }];
    const pinned = [{ dir: 1, pivotTime: 100, touched: false }];
    expect(mergePinnedLevels(levels, pinned, candles)).toHaveLength(1);
  });

  it("übernimmt einen bereits bekannten touched-Status unverändert", () => {
    const pinned = [{ dir: 1, pivotTime: 100, touched: true, endTime: 250, price: 1.2 }];
    expect(mergePinnedLevels([], pinned, candles)).toEqual([{ dir: 1, pivotTime: 100, touched: true, endTime: 250, price: 1.2 }]);
  });

  it("heilt touched===null selbst anhand der geladenen Kerzen (m5_liquidity_level-Snapshot)", () => {
    const pinnedHigh = [{ dir: 1, pivotTime: 100, touched: null, price: 1.2 }]; // dir 1 (High) -> Touch wenn high>=price
    const result = mergePinnedLevels([], pinnedHigh, candles);
    expect(result[0]).toMatchObject({ touched: true, endTime: 200 }); // candle(200, 1.15, 1.25) hat high=1.25 >= 1.2
  });

  it("bleibt unberührt bis zur letzten geladenen Kerze, wenn kein Touch gefunden wird", () => {
    const pinnedLow = [{ dir: -1, pivotTime: 100, touched: null, price: 0.1 }]; // dir -1 (Low), kein low<=0.1 in den Kerzen
    const result = mergePinnedLevels([], pinnedLow, candles);
    expect(result[0]).toMatchObject({ touched: false, endTime: 300 });
  });
});

// Task "Chart-Objekte...", Punkt 12/13, Nachbesserung 2026-08-23 — die persistierten HTF-Level
// (1H+4H), unabhängig vom aktuell gewählten Chart-Timeframe.
describe("computeHtfLiquidityLevels", () => {
  const candles = [candle(100, 1.0, 1.1), candle(200, 1.15, 1.25)];
  // Ein 1H-Fraktal ist erst bestaetigt, wenn die 5 Folgekerzen geschlossen haben — der Cutoff muss
  // deshalb 6 Stunden hinter dem Pivot liegen, sonst existiert das Level aus Replay-Sicht noch nicht.
  const CONFIRM_1H = 6 * 3600;
  const REPLAY = 300 + CONFIRM_1H;

  it("filtert nach Instrument und Replay-Cutoff, endTime wird selbst geheilt", () => {
    const dbLevels = [
      { instrument: "GBPUSD", timeframe: "1H", pivotTime: 50, price: 1.2, dir: 1 },
      { instrument: "GBPUSD", timeframe: "1H", pivotTime: 400, price: 1.2, dir: 1 }, // Bestaetigung erst nach replayUntil
      { instrument: "EURUSD", timeframe: "1H", pivotTime: 50, price: 1.2, dir: 1 }, // falsches Instrument
    ];
    const result = computeHtfLiquidityLevels(candles, dbLevels, "GBPUSD", REPLAY, 1.15);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ pivotTime: 50, endTime: 200 }); // selbst geheilt auf letzte Kerze
  });

  // Lookahead-Leak (Task 11.09.2026, GBPUSD 09.09.: ein 1H-Level mit 6h, ein 4H-Level mit 22h
  // Vorsprung): pivotTime ist nur die OEFFNUNG der Pivot-Kerze, das Level EXISTIERT erst, wenn die
  // 5 Folgekerzen geschlossen sind — sein Preis stammt sonst aus noch nicht gelaufener Bewegung.
  it("zeigt einen Pivot erst nach seiner Fraktal-Bestaetigung, je Timeframe gerechnet", () => {
    const h1 = [{ instrument: "GBPUSD", timeframe: "1H", pivotTime: 0, price: 1.2, dir: 1 }];
    expect(computeHtfLiquidityLevels(candles, h1, "GBPUSD", CONFIRM_1H - 60, 1.15)).toHaveLength(0);
    expect(computeHtfLiquidityLevels(candles, h1, "GBPUSD", CONFIRM_1H, 1.15)).toHaveLength(1);
    const h4 = [{ instrument: "GBPUSD", timeframe: "4H", pivotTime: 0, price: 1.2, dir: 1 }];
    expect(computeHtfLiquidityLevels(candles, h4, "GBPUSD", CONFIRM_1H, 1.15)).toHaveLength(0); // 4H braucht 24h
    expect(computeHtfLiquidityLevels(candles, h4, "GBPUSD", 24 * 3600, 1.15)).toHaveLength(1);
  });

  it("ohne replayUntil (live) zählt kein Zeit-Cutoff", () => {
    const dbLevels = [{ instrument: "GBPUSD", timeframe: "1H", pivotTime: 9999, price: 1.2, dir: 1 }];
    const result = computeHtfLiquidityLevels(candles, dbLevels, "GBPUSD", null, 1.15);
    expect(result).toHaveLength(1);
  });

  it("behält ein bereits bekanntes endTime statt es zu überschreiben", () => {
    const dbLevels = [{ instrument: "GBPUSD", timeframe: "1H", pivotTime: 50, endTime: 999, price: 1.2, dir: 1 }];
    const result = computeHtfLiquidityLevels(candles, dbLevels, "GBPUSD", null, 1.15);
    expect(result[0].endTime).toBe(999);
  });

  // Chat 2026-08-26, Philip: "liegt ein 4H LQ-Level auf demselben Preis wie ein 1H-Level, gewinnt
  // das 4H-Level" — vorher wurden 1H/4H unabhängig ausgewählt und beide gezeigt.
  it("4H gewinnt gegen ein 1H-Level auf demselben Preis", () => {
    const dbLevels = [
      { instrument: "GBPUSD", timeframe: "1H", pivotTime: 50, price: 1.2, dir: 1 },
      { instrument: "GBPUSD", timeframe: "4H", pivotTime: 60, price: 1.2, dir: 1 },
    ];
    const result = computeHtfLiquidityLevels(candles, dbLevels, "GBPUSD", null, 1.15);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ timeframe: "4H", pivotTime: 60 });
  });

  it("behält beide, wenn sie preislich nicht kollidieren", () => {
    const dbLevels = [
      { instrument: "GBPUSD", timeframe: "1H", pivotTime: 50, price: 1.2, dir: 1 },
      { instrument: "GBPUSD", timeframe: "4H", pivotTime: 60, price: 1.25, dir: 1 },
    ];
    const result = computeHtfLiquidityLevels(candles, dbLevels, "GBPUSD", null, 1.15);
    expect(result.map((l) => l.timeframe).sort()).toEqual(["1H", "4H"]);
  });

  // Bug-Report Philip 2026-08-26: ein 1H-Level, real erst NACH dem Replay-Zeitpunkt gesweept, zeigte
  // sich auf M5 nicht (dort gibt es keine replay-geclippte Live-Neuerkennung als Fallback, anders
  // als auf dem 1h-Chart selbst) — fetchLiquidityLevelsHtf() liefert immer den LIVE-Sweep-Stand,
  // ohne applyReplayAsOf zählte ein Level dadurch fälschlich als "kürzlich gesweept" mit einem
  // Touch-Zeitpunkt aus der Zukunft und verdrängte andere, aus Replay-Sicht tatsächlich
  // relevantere Level vom recentSwept-Deckel. Pendant zu applyAsOf (db.ts).
  it("setzt touched zurück, wenn der reale Sweep NACH replayUntil liegt", () => {
    const dbLevels = [{ instrument: "GBPUSD", timeframe: "1H", pivotTime: 50, price: 1.2, dir: 1, touched: true, touchedTime: REPLAY + 50, endTime: REPLAY + 50 }];
    const result = computeHtfLiquidityLevels(candles, dbLevels, "GBPUSD", REPLAY, 1.15);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ touched: false, touchedTime: null, endTime: 200 }); // endTime selbst geheilt auf letzte Kerze
  });

  it("behält touched, wenn der Sweep vor/an replayUntil liegt", () => {
    const dbLevels = [{ instrument: "GBPUSD", timeframe: "1H", pivotTime: 50, price: 1.2, dir: 1, touched: true, touchedTime: 150, endTime: 150 }];
    const result = computeHtfLiquidityLevels(candles, dbLevels, "GBPUSD", REPLAY, 1.15);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ touched: true, touchedTime: 150, endTime: 150 });
  });
});

// Bug-Report Philip 2026-08-23: die DB-Version (poi-watcher) gewinnt IMMER bei einer Überschneidung
// mit der Live-Neuberechnung — nur was NUR live erkannt wurde, kommt zusätzlich dazu.
describe("mergeDbLiquidityLevels", () => {
  it("gibt levels unverändert zurück, wenn keine DB-Level vorliegen", () => {
    const levels = [{ dir: 1, pivotTime: 100 }];
    expect(mergeDbLiquidityLevels(levels, [])).toBe(levels);
  });

  it("DB-Version gewinnt bei einer Überschneidung (gleicher Natural Key)", () => {
    const levels = [{ dir: 1, pivotTime: 100, touched: false, source: "live" }];
    const dbLevels = [{ dir: 1, pivotTime: 100, touched: true, source: "db" }];
    expect(mergeDbLiquidityLevels(levels, dbLevels)).toEqual([{ dir: 1, pivotTime: 100, touched: true, source: "db" }]);
  });

  it("live-only Level (kein DB-Pendant) bleibt zusätzlich erhalten", () => {
    const levels = [{ dir: 1, pivotTime: 100, source: "live" }];
    const dbLevels = [{ dir: -1, pivotTime: 200, source: "db" }];
    expect(mergeDbLiquidityLevels(levels, dbLevels)).toEqual([
      { dir: 1, pivotTime: 100, source: "live" },
      { dir: -1, pivotTime: 200, source: "db" },
    ]);
  });

  // Chat 2026-08-26, Philip: ein M5-Level auf demselben Preis wie ein angezeigtes HTF-Level ist
  // redundant — das HTF-Level ist bedeutsamer, das M5-Level fällt raus statt doppelt gezeichnet zu werden.
  it("verwirft ein live M5-Level, das preislich mit einem HTF-Level derselben Richtung zusammenfällt", () => {
    const levels = [{ dir: 1, pivotTime: 100, price: 1.2, source: "live-m5" }];
    const dbLevels = [{ dir: 1, pivotTime: 999, price: 1.2, source: "db-1h" }];
    expect(mergeDbLiquidityLevels(levels, dbLevels)).toEqual([{ dir: 1, pivotTime: 999, price: 1.2, source: "db-1h" }]);
  });

  it("verwirft NICHT bei unterschiedlicher Richtung, selbst bei identischem Preis", () => {
    const levels = [{ dir: -1, pivotTime: 100, price: 1.2, source: "live-m5" }];
    const dbLevels = [{ dir: 1, pivotTime: 999, price: 1.2, source: "db-1h" }];
    expect(mergeDbLiquidityLevels(levels, dbLevels)).toEqual([
      { dir: -1, pivotTime: 100, price: 1.2, source: "live-m5" },
      { dir: 1, pivotTime: 999, price: 1.2, source: "db-1h" },
    ]);
  });

  it("toleriert minimale Float-Differenzen, verwirft aber nicht bei echtem Preisabstand", () => {
    const levels = [
      { dir: 1, pivotTime: 100, price: 1.2 + 1e-9, source: "live-m5-nah" }, // Float-Rundung, keine echte Distanz
      { dir: 1, pivotTime: 101, price: 1.2005, source: "live-m5-fern" }, // 5 Pip entfernt, eigenständiges Level
    ];
    const dbLevels = [{ dir: 1, pivotTime: 999, price: 1.2, source: "db-1h" }];
    expect(mergeDbLiquidityLevels(levels, dbLevels)).toEqual([
      { dir: 1, pivotTime: 101, price: 1.2005, source: "live-m5-fern" },
      { dir: 1, pivotTime: 999, price: 1.2, source: "db-1h" },
    ]);
  });
});
