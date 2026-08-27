import { describe, expect, it } from "vitest";
import {
  firstCandleTouch,
  firstCandleTouchRange,
  currentPriceEstimate,
  filterHistorical,
  filterDbObZones,
  collectObsZones,
  liveObZonesForTimeframe,
  liveObZoneState,
  obBoxTouchState,
  mergePinnedZones,
  PIP_RELEVANCE_THRESHOLD,
} from "../src/priceChartObZones.js";

function candle(time, low, high) {
  return { time, low, high, open: (low + high) / 2, close: (low + high) / 2 };
}

// Bug-Report Philip 2026-07-31 (Debug-Log bewies es: zone.startTime === zone.endTime): ">=" ließ
// die eigene Entstehungs-Kerze des Targets als "Touch" durchgehen — ">" schließt sie aus, sucht
// nur nach einem SPÄTEREN echten Re-Touch.
describe("firstCandleTouch", () => {
  const candles = [candle(100, 1.0, 1.1), candle(200, 1.05, 1.15), candle(300, 0.9, 1.0)];

  it("ignoriert die Entstehungs-Kerze selbst, auch wenn sie den Preis träfe", () => {
    expect(firstCandleTouch(candles, 100, 1.05)).toBe(200);
  });

  it("findet die erste SPÄTERE Kerze, die den Preis berührt", () => {
    expect(firstCandleTouch(candles, 100, 0.95)).toBe(300);
  });

  it("gibt null zurück, wenn keine spätere Kerze den Preis berührt", () => {
    expect(firstCandleTouch(candles, 100, 5.0)).toBeNull();
  });
});

// Bug-Report Philip 2026-08-07: derselbe Selbstheilungs-Mechanismus wie firstCandleTouch, aber für
// eine Preis-SPANNE (rangeLow/rangeHigh) statt eines einzelnen Preises.
describe("firstCandleTouchRange", () => {
  const candles = [candle(100, 1.0, 1.1), candle(200, 1.2, 1.3), candle(300, 0.8, 0.9)];

  it("findet die erste spätere Kerze, deren Range die gesuchte Spanne überschneidet", () => {
    expect(firstCandleTouchRange(candles, 100, 1.15, 1.25)).toBe(200);
  });

  it("gibt null zurück, wenn keine spätere Kerze überschneidet", () => {
    expect(firstCandleTouchRange(candles, 100, 5.0, 5.1)).toBeNull();
  });
});

describe("currentPriceEstimate", () => {
  it("gibt den Schlusskurs der letzten Kerze zurück", () => {
    expect(currentPriceEstimate([candle(100, 1.0, 1.1), { time: 200, close: 1.25 }])).toBe(1.25);
  });

  it("gibt null zurück, wenn keine Kerzen geladen sind", () => {
    expect(currentPriceEstimate([])).toBeNull();
  });
});

// "Historische OBs"-Toggle (Dashboard-Toolbar) — invalidierte Zonen bleiben davon unabhängig
// IMMER ausgeblendet (eigene, ältere Filterung, hier nicht Teil von filterHistorical selbst).
describe("filterHistorical", () => {
  const zones = [
    { id: 1, touched: false },
    { id: 2, touched: true },
  ];

  it("zeigt nur unberührte Zonen, wenn showHistoricalObs aus ist", () => {
    expect(filterHistorical(zones, false)).toEqual([{ id: 1, touched: false }]);
  });

  it("zeigt alle Zonen, wenn showHistoricalObs an ist", () => {
    expect(filterHistorical(zones, true)).toEqual(zones);
  });
});

// Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren", Punkt 7 (Instrument-/Replay-
// Filter) + Punkt 9 (200-Pip-Distanz-Eingrenzung um den aktuellen Preis, Philip bestätigt 2026-08-22).
describe("filterDbObZones", () => {
  const dbObZones = [
    { instrument: "GBPUSD", timeframe: "1H", startTime: 100, top: 1.2, bottom: 1.1 },
    { instrument: "GBPUSD", timeframe: "1H", startTime: 200, top: 1.2 + 300 * PIP_RELEVANCE_THRESHOLD, bottom: 1.1 + 300 * PIP_RELEVANCE_THRESHOLD }, // weit weg vom Preis
    { instrument: "GBPUSD", timeframe: "4H", startTime: 100, top: 1.2, bottom: 1.1 }, // falscher Timeframe
    { instrument: "EURUSD", timeframe: "1H", startTime: 100, top: 1.2, bottom: 1.1 }, // falsches Instrument
    { instrument: "GBPUSD", timeframe: "1H", startTime: 500, top: 1.2, bottom: 1.1 }, // erst nach replayUntil entstanden
  ];

  it("filtert nach Instrument und Timeframe", () => {
    const result = filterDbObZones(dbObZones, "GBPUSD", null, "4H", 1.15);
    expect(result).toEqual([dbObZones[2]]);
  });

  it("blendet Zonen aus, die preislich zu weit entfernt sind (Punkt 9)", () => {
    const result = filterDbObZones(dbObZones, "GBPUSD", null, "1H", 1.15);
    expect(result).toEqual([dbObZones[0], dbObZones[4]]);
  });

  it("ohne bekannten Preis (price=null) läuft keine Pip-Distanz-Filterung", () => {
    const result = filterDbObZones(dbObZones, "GBPUSD", null, "1H", null);
    expect(result).toEqual([dbObZones[0], dbObZones[1], dbObZones[4]]);
  });

  it("im Replay blendet Zonen aus, die erst NACH replayUntil entstanden sind", () => {
    const result = filterDbObZones(dbObZones, "GBPUSD", 300, "1H", null);
    expect(result).toEqual([dbObZones[0], dbObZones[1]]);
  });
});

describe("collectObsZones", () => {
  const dbObZones = [
    { instrument: "GBPUSD", timeframe: "1H", startTime: 100, top: 1.2, bottom: 1.1, invalidated: false },
    { instrument: "GBPUSD", timeframe: "1H", startTime: 50, top: 1.2, bottom: 1.1, invalidated: true },
    { instrument: "GBPUSD", timeframe: "4H", startTime: 100, top: 1.2, bottom: 1.1, invalidated: false },
  ];
  const baseCtx = { dbObZones, symbol: "GBPUSD", replayUntil: null, price: null };

  it("liefert nichts, wenn alle drei Timeframe-Toggles aus sind", () => {
    expect(collectObsZones({ showObs4h: false, showObs1h: false, showObsM5: false, m5Candles: [], ...baseCtx })).toEqual([]);
  });

  it("blendet invalidierte Zonen unabhängig vom Toggle immer aus", () => {
    const result = collectObsZones({ showObs4h: false, showObs1h: true, showObsM5: false, m5Candles: [], ...baseCtx });
    expect(result).toEqual([dbObZones[0]]);
  });

  it("kombiniert mehrere aktivierte Timeframes", () => {
    const result = collectObsZones({ showObs4h: true, showObs1h: true, showObsM5: false, m5Candles: [], ...baseCtx });
    expect(result).toEqual([dbObZones[2], dbObZones[0]]);
  });
});

describe("liveObZonesForTimeframe / liveObZoneState", () => {
  const ctx = {
    m5Candles: [],
    dbObZones: [{ instrument: "GBPUSD", timeframe: "1H", startTime: 100, top: 1.2, bottom: 1.1, invalidated: false, touched: true, endTime: 400 }],
    symbol: "GBPUSD",
    replayUntil: null,
    price: null,
  };

  it("liveObZonesForTimeframe('5M') geht am DB-Read vorbei (Live-Erkennung, hier leere M5-Kerzen)", () => {
    expect(liveObZonesForTimeframe("5M", ctx)).toEqual([]);
  });

  it("liveObZonesForTimeframe für 1H/4H liest aus dbObZones", () => {
    expect(liveObZonesForTimeframe("1H", ctx)).toEqual(ctx.dbObZones);
  });

  it("liveObZoneState findet die Zone per top/bottom-Match und gibt touched/endTime zurück", () => {
    const item = { timeframe: "1H", rangeLow: 1.1, rangeHigh: 1.2 };
    expect(liveObZoneState(item, ctx)).toEqual({ touched: true, endTime: 400 });
  });

  it("liveObZoneState gibt null zurück ohne timeframe/rangeLow/rangeHigh", () => {
    expect(liveObZoneState({ timeframe: null, rangeLow: 1.1, rangeHigh: 1.2 }, ctx)).toBeNull();
    expect(liveObZoneState({ timeframe: "1H", rangeLow: null, rangeHigh: 1.2 }, ctx)).toBeNull();
  });

  it("liveObZoneState gibt null zurück, wenn keine passende Zone gefunden wird", () => {
    expect(liveObZoneState({ timeframe: "1H", rangeLow: 5, rangeHigh: 6 }, ctx)).toBeNull();
  });
});

// Bug-Report Philip 2026-08-25: bündelt touched+endTime in EINER Prioritätskette (bekanntes
// touchedTime -> live erkannte Zone -> Selbstheilung in geladenen Kerzen -> noch aktiv bis jetzt).
describe("obBoxTouchState", () => {
  const candles = [candle(100, 1.0, 1.1), candle(200, 1.15, 1.25), candle(300, 0.9, 1.0)];
  const emptyCtx = { m5Candles: [], dbObZones: [], symbol: "GBPUSD", replayUntil: null, price: null };

  it("bekanntes touchedTime hat immer Vorrang", () => {
    const item = { touchedTime: 250, sourceTime: 100, rangeLow: 5, rangeHigh: 6 };
    expect(obBoxTouchState(item, candles, emptyCtx)).toEqual({ touched: true, endTime: 250 });
  });

  it("fällt ohne touchedTime auf die live erkannte Zone zurück", () => {
    const dbObZones = [{ instrument: "GBPUSD", timeframe: "1H", startTime: 100, top: 6, bottom: 5, touched: true, endTime: 260, invalidated: false }];
    const item = { touchedTime: null, sourceTime: 100, rangeLow: 5, rangeHigh: 6, timeframe: "1H" };
    const ctx = { ...emptyCtx, dbObZones };
    expect(obBoxTouchState(item, candles, ctx)).toEqual({ touched: true, endTime: 260 });
  });

  it("heilt sich selbst über die geladenen Kerzen, wenn weder touchedTime noch Live-Zone greifen", () => {
    const item = { touchedTime: null, sourceTime: 100, rangeLow: 1.15, rangeHigh: 1.25, timeframe: null };
    expect(obBoxTouchState(item, candles, emptyCtx)).toEqual({ touched: true, endTime: 200 });
  });

  // Bug-Report Philip 2026-08-27 (DR#48, GBP): eine per Klick angelegte ob_zones-Zeile, die
  // poi-watcher nie live aktualisiert hat, blieb in der DB für immer touched=false — bisher wurde
  // das blind übernommen, obwohl die geladenen Kerzen längst einen echten Touch zeigen.
  it("vertraut einem NEGATIVEN Live-Fund nicht blind, sondern heilt zusätzlich über die Kerzen", () => {
    const dbObZones = [{ instrument: "GBPUSD", timeframe: "1H", startTime: 100, top: 1.25, bottom: 1.15, touched: false, endTime: null, invalidated: false }];
    const item = { touchedTime: null, sourceTime: 100, rangeLow: 1.15, rangeHigh: 1.25, timeframe: "1H" };
    const ctx = { ...emptyCtx, dbObZones };
    expect(obBoxTouchState(item, candles, ctx)).toEqual({ touched: true, endTime: 200 });
  });

  // Nachbesserung 2026-08-27: "live bevorzugen" reichte nicht, wenn live (andere Kerzenquelle,
  // siehe Kommentar an obBoxTouchState) selbst mit touched=true einen zu SPÄTEN endTime liefert —
  // das FRÜHERE der beiden Ergebnisse gewinnt jetzt, statt live blind zu vertrauen.
  it("nimmt bei zwei positiven Funden das FRÜHERE Ende (Kerzenquellen können divergieren)", () => {
    const dbObZones = [{ instrument: "GBPUSD", timeframe: "1H", startTime: 100, top: 1.25, bottom: 1.15, touched: true, endTime: 900, invalidated: false }];
    const item = { touchedTime: null, sourceTime: 100, rangeLow: 1.15, rangeHigh: 1.25, timeframe: "1H" };
    const ctx = { ...emptyCtx, dbObZones };
    // Self-Heal findet den Touch schon bei 200 (siehe candles oben), live behauptet fälschlich 900.
    expect(obBoxTouchState(item, candles, ctx)).toEqual({ touched: true, endTime: 200 });
  });

  it("übernimmt einen negativen Live-Fund trotzdem, wenn auch die Selbstheilung nichts findet", () => {
    const dbObZones = [{ instrument: "GBPUSD", timeframe: "1H", startTime: 100, top: 60, bottom: 50, touched: false, endTime: null, invalidated: false }];
    const item = { touchedTime: null, sourceTime: 100, rangeLow: 50, rangeHigh: 60, timeframe: "1H" };
    const ctx = { ...emptyCtx, dbObZones };
    expect(obBoxTouchState(item, candles, ctx)).toEqual({ touched: false, endTime: null });
  });

  it("bleibt unberührt bis zur letzten geladenen Kerze, wenn nichts greift", () => {
    const item = { touchedTime: null, sourceTime: 100, rangeLow: 50, rangeHigh: 60, timeframe: null };
    expect(obBoxTouchState(item, candles, emptyCtx)).toEqual({ touched: false, endTime: 300 });
  });
});

// Task "Pin-Kontext: gepinnte Objekte direkt rendern" — ein Pin bekommt ein Chart-Objekt
// unabhängig von showObsX-Toggles/dem live neu erkannten Ergebnis.
describe("mergePinnedZones", () => {
  const candles = [candle(100, 1.0, 1.1), candle(200, 1.15, 1.25), candle(300, 0.9, 1.0)];

  it("gibt zones unverändert zurück, wenn keine Pins vorliegen", () => {
    const zones = [{ timeframe: "1H", dir: 1, startTime: 100 }];
    expect(mergePinnedZones(zones, [], candles)).toBe(zones);
  });

  it("dedupliziert per Natural Key — bereits gezeichnete Zone wird nicht doppelt hinzugefügt", () => {
    const zones = [{ timeframe: "1H", dir: 1, startTime: 100 }];
    const pinned = [{ timeframe: "1H", dir: 1, startTime: 100, touched: false }];
    expect(mergePinnedZones(zones, pinned, candles)).toHaveLength(1);
  });

  it("übernimmt einen bereits bekannten touched-Status unverändert", () => {
    const pinned = [{ timeframe: "1H", dir: 1, startTime: 100, touched: true, endTime: 250, top: 6, bottom: 5 }];
    const result = mergePinnedZones([], pinned, candles);
    expect(result).toEqual([{ timeframe: "1H", dir: 1, startTime: 100, touched: true, endTime: 250, top: 6, bottom: 5 }]);
  });

  it("heilt touched===null selbst anhand der geladenen Kerzen (M5-Snapshot ohne Live-Status)", () => {
    const pinned = [{ timeframe: "5M", dir: 1, startTime: 100, touched: null, top: 1.25, bottom: 1.15 }];
    const result = mergePinnedZones([], pinned, candles);
    expect(result[0]).toMatchObject({ touched: true, endTime: 200 });
  });
});
