import { describe, expect, it } from "vitest";
import {
  matchTradeSetup,
  matchLiquidityLevel,
  matchOBZone,
  matchFibLevel,
  matchDivergence,
  findNearbyPinCandidates,
  hasNearbyPinCandidate,
  LIQUIDITY_LINE_CLICK_TOLERANCE_PX,
  FIB_TICK_CLICK_TOLERANCE_PX,
  DIVERGENCE_CLICK_TOLERANCE_PX,
  PIN_SEARCH_RADIUS,
} from "../src/priceChartHitTest.js";
import { OrderBlockPrimitive } from "../src/orderBlocks.js";

// Trade-Modus-Klick-Hittest (Chat 2026-07-27) — testet gegen genau die Box, die
// renderTradeSetupsInternal tatsächlich zeichnet, respektiert Long/Short-Toggle + Replay-Cutoff.
describe("matchTradeSetup", () => {
  const opts = { replayUntil: null, showTradeSetupsShort: true, showTradeSetupsLong: true, obWidthSec: 100 };
  // tradeSetupObBoxBounds (tradeSetup.js) baut {top,bottom} aus fractal.price + obTop/obBottom, je
  // nach Richtung (dir=1/Short: top=fractal.price, bottom=obBottom; dir=-1/Long: top=obTop,
  // bottom=fractal.price) — der Helfer hier baut testweise ein Setup, dessen resultierende Box
  // exakt [bottom, top] ist, unabhängig von dir.
  function setup(dir, obStartTime, top, bottom, fractalPivotTime = obStartTime) {
    return dir === 1
      ? { dir, obStartTime, obBottom: bottom, fractal: { pivotTime: fractalPivotTime, price: top } }
      : { dir, obStartTime, obTop: top, fractal: { pivotTime: fractalPivotTime, price: bottom } };
  }

  it("findet ein Setup, dessen OB-Box Zeit und Preis trifft", () => {
    const setups = [setup(1, 100, 1.2, 1.1)];
    expect(matchTradeSetup(setups, 1.15, 150, opts)).toBe(setups[0]);
  });

  it("gibt null zurück, wenn der Preis außerhalb der Box liegt", () => {
    const setups = [setup(1, 100, 1.2, 1.1)];
    expect(matchTradeSetup(setups, 5.0, 150, opts)).toBeNull();
  });

  it("gibt null zurück, wenn die Zeit außerhalb der Box-Breite liegt", () => {
    const setups = [setup(1, 100, 1.2, 1.1)];
    expect(matchTradeSetup(setups, 1.15, 500, opts)).toBeNull();
  });

  it("respektiert showTradeSetupsShort/-Long — dir=1 ist Short, dir=-1 ist Long", () => {
    const setups = [setup(1, 100, 1.2, 1.1)];
    expect(matchTradeSetup(setups, 1.15, 150, { ...opts, showTradeSetupsShort: false })).toBeNull();
  });

  it("respektiert den Replay-Cutoff (fractal.pivotTime nach replayUntil = unsichtbar)", () => {
    const setups = [setup(1, 100, 1.2, 1.1, 100)];
    expect(matchTradeSetup(setups, 1.15, 150, { ...opts, replayUntil: 50 })).toBeNull();
    expect(matchTradeSetup(setups, 1.15, 150, { ...opts, replayUntil: 150 })).toBe(setups[0]);
  });
});

// Ziel-Modus-Klick-Hittest (Chat 2026-07-27) — Pixel-Toleranz auf der Y-Achse statt Preisbereich,
// priceToCoordinate wird als einzelne Funktion injiziert statt eines ganzen candleSeries-Mocks.
describe("matchLiquidityLevel", () => {
  const levels = [{ dir: 1, pivotTime: 100, endTime: 300, price: 1.2 }];
  const priceToCoordinate = (price) => (price === 1.2 ? 500 : null);

  it("findet ein Level innerhalb der Y-Pixel-Toleranz und im Zeitbereich", () => {
    expect(matchLiquidityLevel(levels, 200, 500 + LIQUIDITY_LINE_CLICK_TOLERANCE_PX, priceToCoordinate)).toBe(levels[0]);
  });

  it("gibt null zurück außerhalb der Y-Pixel-Toleranz", () => {
    expect(matchLiquidityLevel(levels, 200, 500 + LIQUIDITY_LINE_CLICK_TOLERANCE_PX + 1, priceToCoordinate)).toBeNull();
  });

  it("gibt null zurück außerhalb des Zeitbereichs [pivotTime, endTime]", () => {
    expect(matchLiquidityLevel(levels, 50, 500, priceToCoordinate)).toBeNull();
    expect(matchLiquidityLevel(levels, 400, 500, priceToCoordinate)).toBeNull();
  });

  it("gibt null zurück, wenn priceToCoordinate null liefert (Preis außerhalb sichtbarer Skala)", () => {
    expect(matchLiquidityLevel(levels, 200, 500, () => null)).toBeNull();
  });
});

// Ziel-Modus, zweite Klick-Fläche (Chat 2026-07-28) — dem Klick nähere Kante wird als Target-Preis
// übernommen, invalidierte Zonen sind nie klickbar.
describe("matchOBZone", () => {
  const zones = [{ top: 1.2, bottom: 1.1, startTime: 100, endTime: 300, dir: 1, timeframe: "1H", touched: true, invalidated: false }];

  it("übernimmt die dem Klick NÄHERE Kante als Preis", () => {
    const result = matchOBZone(zones, 1.18, 200, "GBPUSD"); // näher an top (1.2) als an bottom (1.1)
    expect(result).toMatchObject({ kind: "ob", price: 1.2, sourceTime: 100, direction: "long", instrument: "GBPUSD", timeframe: "1H" });
  });

  it("übernimmt bottom, wenn der Klick näher an der Unterkante liegt", () => {
    const result = matchOBZone(zones, 1.12, 200, "GBPUSD");
    expect(result.price).toBe(1.1);
  });

  it("touchedTime ist nur gesetzt, wenn die Zone touched ist", () => {
    expect(matchOBZone(zones, 1.18, 200, "GBPUSD").touchedTime).toBe(300);
    const untouched = [{ ...zones[0], touched: false }];
    expect(matchOBZone(untouched, 1.18, 200, "GBPUSD").touchedTime).toBeNull();
  });

  it("ignoriert invalidierte Zonen", () => {
    const invalidated = [{ ...zones[0], invalidated: true }];
    expect(matchOBZone(invalidated, 1.18, 200, "GBPUSD")).toBeNull();
  });

  it("gibt null zurück, wenn keine Zone Zeit und Preis trifft", () => {
    expect(matchOBZone(zones, 1.18, 9999, "GBPUSD")).toBeNull();
    expect(matchOBZone(zones, 5.0, 200, "GBPUSD")).toBeNull();
  });

  it("kommt ohne zones-Array (null/undefined) klar", () => {
    expect(matchOBZone(null, 1.18, 200, "GBPUSD")).toBeNull();
  });
});

// Bestätigungs-Modus, dritte Klick-Fläche (Chat 2026-07-30) — 2D-Pixel-Abstand zum Mittelpunkt der
// Fib-Spanne statt Zeitbereich+Y-Toleranz.
describe("matchFibLevel", () => {
  const levels = [{ a: { pivotTime: 100, price: 1.1 }, b: { pivotTime: 200, price: 1.2 }, price: 1.15 }];
  const timeToCoordinate = (t) => (t === 100 ? 400 : t === 200 ? 600 : null); // Mittelpunkt x = 500
  const priceToCoordinate = () => 300;

  it("findet ein Fib-Level innerhalb der Klick-Toleranz um den Mittelpunkt", () => {
    const result = matchFibLevel(levels, 500, 300 + FIB_TICK_CLICK_TOLERANCE_PX, timeToCoordinate, priceToCoordinate);
    expect(result).toMatchObject({ kind: "fib", price: 1.15, sourceTime: 200, rangeLow: 1.1, rangeHigh: 1.2 });
  });

  it("gibt null zurück außerhalb der Klick-Toleranz", () => {
    expect(matchFibLevel(levels, 500, 300 + FIB_TICK_CLICK_TOLERANCE_PX + 5, timeToCoordinate, priceToCoordinate)).toBeNull();
  });

  it("überspringt ein Level, dessen Anker gerade außerhalb des sichtbaren Bereichs liegen (timeToCoordinate=null)", () => {
    const outOfView = [{ a: { pivotTime: 999, price: 1.1 }, b: { pivotTime: 200, price: 1.2 }, price: 1.15 }];
    expect(matchFibLevel(outOfView, 500, 300, timeToCoordinate, priceToCoordinate)).toBeNull();
  });
});

// Bestätigungs-Modus, vierte Klick-Fläche (2026-08-15) — braucht keine Koordinaten-Umrechnung,
// nutzt distanceTo() der Primitive-Instanz selbst.
describe("matchDivergence", () => {
  function primitive(distance, divergence) {
    return { distanceTo: () => distance, divergence };
  }
  const divergence = { toPrice: 1.2, fromTime: 100, toTime: 200, fromPrice: 1.1, fromRsi: 30, toRsi: 70, type: "bullish" };

  it("findet die erste Primitive innerhalb der Klick-Toleranz", () => {
    const result = matchDivergence([primitive(DIVERGENCE_CLICK_TOLERANCE_PX, divergence)], 10, 20);
    expect(result).toMatchObject({ kind: "rsi_divergence", price: 1.2, sourceTime: 100, touchedTime: 200, divergenceType: "bullish" });
  });

  it("gibt null zurück außerhalb der Klick-Toleranz aller Primitives", () => {
    expect(matchDivergence([primitive(DIVERGENCE_CLICK_TOLERANCE_PX + 1, divergence)], 10, 20)).toBeNull();
  });

  it("gibt null für eine leere Primitive-Liste zurück", () => {
    expect(matchDivergence([], 10, 20)).toBeNull();
  });
});

function primitiveAt(distance) {
  return { distanceTo: () => distance };
}
// Echte OrderBlockPrimitive-Instanz für den instanceof-Guard (tradeConfirmationLinkPrimitives ist
// GEMISCHT, siehe findNearbyPinCandidates-Kommentar) — .distanceTo überschrieben statt über
// attached()/update() ein echtes lightweight-charts-Setup zu brauchen (frisch konstruiert liefert
// die echte Methode ohnehin nur Infinity, siehe orderBlocks.js: ZonePaneView-Konstruktor).
function obPrimitiveAt(distance, zone) {
  const p = new OrderBlockPrimitive(zone, {}, []);
  p.distanceTo = () => distance;
  return p;
}
function emptyPrimitives(overrides = {}) {
  return {
    tradePrimitives: [],
    orderBlockPrimitives: [],
    liquidityPrimitives: [],
    tradeSetupLinkPrimitives: [],
    tradeConfirmationLinkPrimitives: [],
    divergencePrimitives: [],
    ...overrides,
  };
}

// Kandidatensuche im Radius statt Exakt-Hittest (Chat 2026-08-01, zweite Runde — Bug-Report Philip:
// "tu mir schwer die Box zu treffen"). Deckt alle acht Kandidaten-Arten + Dedupe + Radius-Filter ab.
describe("findNearbyPinCandidates", () => {
  const opts = { symbol: "GBPUSD", currentBar: "5m" };

  it("findet eine trade_position innerhalb des Radius", () => {
    const trade = { id: 42 };
    const primitives = emptyPrimitives({ tradePrimitives: [{ ...primitiveAt(10), trade }] });
    const result = findNearbyPinCandidates(0, 0, primitives, opts);
    expect(result).toEqual([{ kind: "trade_position", trade, distance: 10 }]);
  });

  it("ignoriert Kandidaten außerhalb von PIN_SEARCH_RADIUS", () => {
    const primitives = emptyPrimitives({ tradePrimitives: [{ ...primitiveAt(PIN_SEARCH_RADIUS + 1), trade: { id: 1 } }] });
    expect(findNearbyPinCandidates(0, 0, primitives, opts)).toEqual([]);
  });

  it("unterscheidet ob_zone (1H/4H) von m5_ob (M5) anhand zone.timeframe", () => {
    const primitives = emptyPrimitives({
      orderBlockPrimitives: [
        { ...primitiveAt(5), zone: { timeframe: "1H", dir: 1, startTime: 100, top: 1.2, bottom: 1.1 } },
        { ...primitiveAt(5), zone: { timeframe: "5M", dir: -1, startTime: 200, top: 1.3, bottom: 1.2 } },
      ],
    });
    const result = findNearbyPinCandidates(0, 0, primitives, opts);
    expect(result.map((c) => c.kind).sort()).toEqual(["m5_ob", "ob_zone"]);
  });

  // Bug-Report Philip 2026-08-26: "wenn ich rechtsklick mache, zum anpinnen, dann sind nur die M5
  // Level verfügbar" — die Unterscheidung richtet sich seit 2026-08-23 nach dem timeframe-Feld des
  // Levels SELBST (1H/4H-Level sind seit derselben Änderung unabhängig vom Chart-Timeframe
  // sichtbar), nicht mehr nach currentBar.
  it("liquidity_level (1H/4H) richtet sich nach dem eigenen timeframe-Feld des Levels, nicht nach currentBar", () => {
    const level1h = { dir: 1, pivotTime: 100, price: 1.2, timeframe: "1H" };
    const level4h = { dir: 1, pivotTime: 100, price: 1.2, timeframe: "4H" };
    const levelM5 = { dir: 1, pivotTime: 100, price: 1.2, timeframe: "5m" };
    const primitivesFor = (level) => emptyPrimitives({ liquidityPrimitives: [{ ...primitiveAt(5), level }] });
    // Auf dem M5-Chart (currentBar="5m") mitgezeichnete 1H/4H-Level bleiben "liquidity_level".
    expect(findNearbyPinCandidates(0, 0, primitivesFor(level1h), { symbol: "GBPUSD", currentBar: "5m" })[0]).toMatchObject({
      kind: "liquidity_level",
      level: { timeframe: "1H" },
    });
    expect(findNearbyPinCandidates(0, 0, primitivesFor(level4h), { symbol: "GBPUSD", currentBar: "5m" })[0]).toMatchObject({
      kind: "liquidity_level",
      level: { timeframe: "4H" },
    });
    expect(findNearbyPinCandidates(0, 0, primitivesFor(levelM5), { symbol: "GBPUSD", currentBar: "5m" })[0]).toMatchObject({
      kind: "m5_liquidity_level",
      level: { timeframe: "5m" },
    });
  });

  it("fällt ohne eigenes timeframe-Feld auf currentBar zurück", () => {
    const level = { dir: 1, pivotTime: 100, price: 1.2 };
    const primitives = emptyPrimitives({ liquidityPrimitives: [{ ...primitiveAt(5), level }] });
    expect(findNearbyPinCandidates(0, 0, primitives, { symbol: "GBPUSD", currentBar: "5m" })[0].kind).toBe("m5_liquidity_level");
  });

  // Bug-Report Philip 2026-08-26, zweite Runde: ein auf dem 1h-Chart live erkannter, aber NICHT in
  // die kuratierte HTF-Auswahl (selectRelevantHtfLevels) aufgenommener Pivot behält sein
  // timeframe-Feld auf currentBar ("1h", kleingeschrieben) statt der DB-Form "1H" — der Vergleich
  // muss deshalb case-insensitiv sein UND das Ergebnis auf die kanonische Großschreibung
  // normalisieren (sonst löst sich der spätere resolveLiquidityLevelId-Call gegen die DB nicht auf).
  it("normalisiert ein kleingeschriebenes timeframe-Feld ('1h'/'4h') auf 'liquidity_level' mit Großschreibung", () => {
    const level1hLower = { dir: -1, pivotTime: 100, price: 1.36213, timeframe: "1h" };
    const level4hLower = { dir: -1, pivotTime: 100, price: 1.36213, timeframe: "4h" };
    const primitivesFor = (level) => emptyPrimitives({ liquidityPrimitives: [{ ...primitiveAt(5), level }] });
    expect(findNearbyPinCandidates(0, 0, primitivesFor(level1hLower), { symbol: "GBPUSD", currentBar: "5m" })[0]).toMatchObject({
      kind: "liquidity_level",
      level: { timeframe: "1H" },
    });
    expect(findNearbyPinCandidates(0, 0, primitivesFor(level4hLower), { symbol: "GBPUSD", currentBar: "5m" })[0]).toMatchObject({
      kind: "liquidity_level",
      level: { timeframe: "4H" },
    });
  });

  it("findet trade_setup und trade_confirmation (nur OrderBlockPrimitive-Instanzen, nicht Linien)", () => {
    const primitives = emptyPrimitives({
      tradeSetupLinkPrimitives: [{ ...primitiveAt(5), zone: { tradeSetupId: 7, direction: "long", instrument: "GBPUSD" } }],
      tradeConfirmationLinkPrimitives: [
        obPrimitiveAt(5, { confirmationId: 9, instrument: "GBPUSD" }),
        { ...primitiveAt(1), notAnOrderBlock: true }, // z.B. eine LiquidityLinePrimitive (kind='pivot'/'fib') -- muss ignoriert werden
      ],
    });
    const result = findNearbyPinCandidates(0, 0, primitives, opts);
    expect(result).toEqual([
      { kind: "trade_setup", tradeSetupId: 7, direction: "long", instrument: "GBPUSD", distance: 5 },
      { kind: "trade_confirmation", confirmationId: 9, instrument: "GBPUSD", distance: 5 },
    ]);
  });

  it("findet rsi_divergence", () => {
    const divergence = { type: "bullish", fromTime: 1, toTime: 2 };
    const primitives = emptyPrimitives({ divergencePrimitives: [{ ...primitiveAt(5), divergence }] });
    expect(findNearbyPinCandidates(0, 0, primitives, opts)).toEqual([{ kind: "rsi_divergence", divergence, instrument: "GBPUSD", distance: 5 }]);
  });

  it("dedupliziert per Natural Key, behält den nächstgelegenen Kandidaten", () => {
    const primitives = emptyPrimitives({
      tradeSetupLinkPrimitives: [
        { ...primitiveAt(20), zone: { tradeSetupId: 7, direction: "long", instrument: "GBPUSD" } },
        { ...primitiveAt(5), zone: { tradeSetupId: 7, direction: "long", instrument: "GBPUSD" } },
      ],
    });
    const result = findNearbyPinCandidates(0, 0, primitives, opts);
    expect(result).toHaveLength(1);
    expect(result[0].distance).toBe(5);
  });

  it("kappt die Ergebnisliste auf maxCandidates", () => {
    const primitives = emptyPrimitives({
      tradePrimitives: Array.from({ length: 10 }, (_, i) => ({ ...primitiveAt(i), trade: { id: i } })),
    });
    expect(findNearbyPinCandidates(0, 0, primitives, opts, 100, 3)).toHaveLength(3);
  });
});

describe("hasNearbyPinCandidate", () => {
  it("true, wenn irgendein Primitive im Radius liegt", () => {
    const primitives = emptyPrimitives({ liquidityPrimitives: [primitiveAt(5)] });
    expect(hasNearbyPinCandidate(0, 0, primitives)).toBe(true);
  });

  it("false, wenn nichts im Radius liegt", () => {
    expect(hasNearbyPinCandidate(0, 0, emptyPrimitives())).toBe(false);
  });

  it("respektiert den instanceof-Guard bei tradeConfirmationLinkPrimitives wie findNearbyPinCandidates", () => {
    const primitives = emptyPrimitives({ tradeConfirmationLinkPrimitives: [{ ...primitiveAt(5), notAnOrderBlock: true }] });
    expect(hasNearbyPinCandidate(0, 0, primitives)).toBe(false);
    const withRealOb = emptyPrimitives({ tradeConfirmationLinkPrimitives: [obPrimitiveAt(5, {})] });
    expect(hasNearbyPinCandidate(0, 0, withRealOb)).toBe(true);
  });
});
