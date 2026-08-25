// Bug-Report Philip 2026-07-21 ("Kerzen hören ab 22:00 auf", Replay bei 23:00; "+1 Kerze"
// funktioniert nicht mehr): cTrader behandelt den exakten toTimestamp-Moment IMMER als "die noch
// offene aktuelle Kerze" (siehe supabase/functions/_shared/ctrader/client.ts: fetchOneTrendbar) —
// auch rückwirkend im Replay. Ohne Ausgleich fehlt deshalb strukturell IMMER genau die Kerze, deren
// Open-Zeit exakt replayUntil entspricht, obwohl clipReplay() (PriceChart.vue) sie korrekt anzeigen
// würde (Filter ist `<=`).
import { describe, expect, it } from "vitest";
import {
  replayFetchToMs,
  nextCandleAfter,
  businessSecondsBetween,
  formatAge,
  snapToBarTime,
  mergeRecent,
  isTimeCovered,
  tradesVisibleForCandles,
  computeNextReplayTime,
} from "../src/chartTimeUtils.js";

// Bug-Report Philip 2026-07-22: "session indikator wird mir für 02.07. 23:00 - 03.07. 07:00 nicht
// angezeigt, bei dem tag davor und danach schon" — die Session war zeitlich vollständig innerhalb
// des geladenen Kerzenfensters, verschwand aber trotzdem. Ursache: SessionBandPaneView (sessions.js)
// rief timeToCoordinate() mit den ROHEN Session-Grenzen auf; lag eine davon außerhalb des zum
// Render-Zeitpunkt geladenen Bereichs (z.B. während des Replay-Scrubbens), lieferte
// timeToCoordinate() null zurück und die GESAMTE Box (auch ihr sichtbarer Teil) wurde verworfen.
// orderBlocks.js/liquidity.js hatten dasselbe Problem längst über snapToBarTime gelöst — Tests dafür
// gab es aber noch keine.
describe("snapToBarTime", () => {
  const candles = [{ time: 100 }, { time: 200 }, { time: 300 }, { time: 400 }];

  it("gibt die exakte Kerzenzeit zurück, wenn targetTime auf eine Kerze trifft", () => {
    expect(snapToBarTime(candles, 200)).toBe(200);
  });

  it("klemmt auf die erste Kerze, wenn targetTime davor liegt", () => {
    expect(snapToBarTime(candles, 0)).toBe(100);
  });

  it("klemmt auf die letzte Kerze, wenn targetTime danach liegt", () => {
    expect(snapToBarTime(candles, 9999)).toBe(400);
  });

  it("rundet auf die nächste Kerze VOR targetTime ab (keine Interpolation)", () => {
    expect(snapToBarTime(candles, 250)).toBe(200);
    expect(snapToBarTime(candles, 399)).toBe(300);
  });

  it("gibt null für ein leeres oder fehlendes Kerzenarray zurück", () => {
    expect(snapToBarTime([], 200)).toBeNull();
    expect(snapToBarTime(null, 200)).toBeNull();
  });
});

describe("replayFetchToMs", () => {
  it("returns undefined (= 'jetzt') when not in replay mode", () => {
    expect(replayFetchToMs(null, "1h")).toBeUndefined();
    expect(replayFetchToMs(undefined, "1h")).toBeUndefined();
  });

  it("adds exactly one Bar-Länge in ms, damit die Kerze AN replayUntil selbst mitgeliefert wird", () => {
    const replayUntilSec = 1783112400; // 03.07.2026 23:00 (Berlin) aus dem Bug-Report
    expect(replayFetchToMs(replayUntilSec, "1h")).toBe(replayUntilSec * 1000 + 3600_000);
    expect(replayFetchToMs(replayUntilSec, "5m")).toBe(replayUntilSec * 1000 + 5 * 60_000);
    expect(replayFetchToMs(replayUntilSec, "15m")).toBe(replayUntilSec * 1000 + 15 * 60_000);
  });

  it("ohne bar kein Offset — nur der reine replayUntil-Zeitpunkt", () => {
    const replayUntilSec = 1783112400;
    expect(replayFetchToMs(replayUntilSec)).toBe(replayUntilSec * 1000);
    expect(replayFetchToMs(replayUntilSec, null)).toBe(replayUntilSec * 1000);
  });
});

// Bug-Report Philip 2026-07-21 ("+1 Kerze bleibt am Freitag 22:00 hängen — das ist Wochenende, da
// gibt's kein Forex!"): "+1 Kerze" rückte bisher stur um eine Barlänge weiter, unabhängig davon, ob
// dort überhaupt eine Kerze existiert — bei einer Markt-Schließlücke (Wochenende/Feiertag) musste
// man sich stundenweise durchklicken. nextCandleAfter springt stattdessen direkt zur nächsten
// TATSÄCHLICH vorhandenen Kerze.
function candle(time) {
  return { time, open: 1, high: 1, low: 1, close: 1 };
}

describe("nextCandleAfter", () => {
  it("findet die unmittelbar nächste Kerze im Normalfall (keine Lücke)", () => {
    const candles = [candle(1000), candle(1300), candle(1600)];
    expect(nextCandleAfter(candles, 1000)).toBe(1300);
  });

  it("überspringt eine Markt-Schließlücke (z.B. Wochenende) in einem Schritt", () => {
    const fridayClose = 1_000_000;
    const mondayOpen = fridayClose + 60 * 3600; // ~60h Wochenende dazwischen, keine Kerzen
    const candles = [candle(fridayClose - 3600), candle(fridayClose), candle(mondayOpen), candle(mondayOpen + 3600)];
    expect(nextCandleAfter(candles, fridayClose)).toBe(mondayOpen);
  });

  it("gibt null zurück, wenn keine Kerze nach afterSec geladen ist (z.B. Lücke reicht über das geladene Fenster hinaus)", () => {
    const candles = [candle(1000), candle(1300)];
    expect(nextCandleAfter(candles, 1300)).toBeNull();
    expect(nextCandleAfter([], 1000)).toBeNull();
  });
});

// Bug-Report/Feature-Wunsch Philip 2026-07-22: "im TSC und wenn debug angetoggelt ist, bei den
// relevanten LQ-Leveln das Alter anzeigen, z.B. '1h LQ-Sweep (1d 3h alt)' — Wochenende nicht
// mitzählen". businessSecondsBetween ist die Grundlage dafür, formatAge die Darstellung.
describe("businessSecondsBetween", () => {
  it("zählt eine reine Werktags-Spanne (kein Wochenende dazwischen) exakt wie die Wanduhr", () => {
    const mon0900 = Date.UTC(2026, 6, 6, 9, 0, 0) / 1000; // Montag 06.07.2026 09:00 UTC
    const mon2000 = Date.UTC(2026, 6, 6, 20, 0, 0) / 1000; // selber Montag 20:00 UTC
    expect(businessSecondsBetween(mon0900, mon2000)).toBe(11 * 3600);
  });

  it("lässt ein volles Wochenende (Samstag+Sonntag) komplett raus", () => {
    const fri2200 = Date.UTC(2026, 6, 3, 22, 0, 0) / 1000; // Freitag 03.07.2026 22:00 UTC
    const mon0900 = Date.UTC(2026, 6, 6, 9, 0, 0) / 1000; // Montag 06.07.2026 09:00 UTC (59h Wanduhr dazwischen)
    // 2h Freitag-Rest (22:00-24:00) + 9h Montag-Anfang (00:00-09:00) = 11h — Sa+So (48h) zählen nicht mit.
    expect(businessSecondsBetween(fri2200, mon0900)).toBe(11 * 3600);
  });

  it("gibt 0 zurück für eine leere oder rückwärts laufende Spanne", () => {
    expect(businessSecondsBetween(1000, 1000)).toBe(0);
    expect(businessSecondsBetween(2000, 1000)).toBe(0);
    expect(businessSecondsBetween(null, 1000)).toBe(0);
    expect(businessSecondsBetween(1000, null)).toBe(0);
  });
});

describe("formatAge", () => {
  it('"1d 3h" — Philips Beispiel aus dem Chat, inkl. Wochenende zwischen Start und Ende', () => {
    const fri1200 = Date.UTC(2026, 6, 3, 12, 0, 0) / 1000; // Freitag 03.07.2026 12:00 UTC
    const mon1500 = Date.UTC(2026, 6, 6, 15, 0, 0) / 1000; // Montag 06.07.2026 15:00 UTC
    expect(formatAge(businessSecondsBetween(fri1200, mon1500))).toBe("1d 3h");
  });

  it("lässt die Minuten weg, sobald schon volle Stunden oder Tage angezeigt werden", () => {
    expect(formatAge(11 * 3600)).toBe("11h");
    expect(formatAge(24 * 3600)).toBe("1d");
    expect(formatAge(11 * 3600 + 15 * 60)).toBe("11h 15m");
  });

  it("zeigt reine Minuten unter einer Stunde", () => {
    expect(formatAge(15 * 60)).toBe("15m");
  });

  it("gibt null für negative/fehlende Werte zurück", () => {
    expect(formatAge(-1)).toBeNull();
    expect(formatAge(null)).toBeNull();
  });
});

// Ursprünglich lokale Funktionen in PriceChart.vue, per Refactoring-Task "Sehr große Dateien
// refactoren" (2026-08-25, Phase 1) hierher verschoben — reine Funktionen ohne chart/candleSeries-
// Abhängigkeit, bisher ohne eigene Tests.
describe("mergeRecent", () => {
  it("übernimmt freshRecent unverändert, wenn existing leer ist", () => {
    const fresh = [{ time: 100 }, { time: 200 }];
    expect(mergeRecent([], fresh)).toBe(fresh);
  });

  it("gibt freshRecent (auch leer) zurück, wenn freshRecent leer ist — existing bleibt unangetastet", () => {
    const existing = [{ time: 100 }];
    expect(mergeRecent(existing, [])).toEqual([]);
  });

  it("behält den älteren Teil von existing und hängt freshRecent dahinter", () => {
    const existing = [{ time: 100 }, { time: 200 }, { time: 300 }];
    const fresh = [{ time: 300, close: 1.5 }, { time: 400 }];
    expect(mergeRecent(existing, fresh)).toEqual([{ time: 100 }, { time: 200 }, { time: 300, close: 1.5 }, { time: 400 }]);
  });

  it("ersetzt eine überlappende Kerze durch die frische Version statt sie zu duplizieren", () => {
    const existing = [{ time: 100, close: 1.0 }, { time: 200, close: 1.1 }];
    const fresh = [{ time: 200, close: 1.2 }];
    expect(mergeRecent(existing, fresh)).toEqual([{ time: 100, close: 1.0 }, { time: 200, close: 1.2 }]);
  });
});

// Bug-Report Philip 2026-07-30, dritte Runde (siehe jumpToTimeRange in PriceChart.vue): ein
// gezielter Sprung kann bewusst eine Lücke mitten in allCandles hinterlassen — ein späterer Sprung
// auf einen Zeitpunkt GENAU in dieser Lücke soll trotzdem als "nicht geladen" erkannt werden.
describe("isTimeCovered", () => {
  const barSeconds = 300; // 5m
  const candles = [{ time: 1000 }, { time: 1300 }, { time: 1600 }, { time: 4000 }, { time: 4300 }]; // Lücke 1600 -> 4000

  it("false für ein leeres Kerzenarray", () => {
    expect(isTimeCovered([], 1000, barSeconds)).toBe(false);
  });

  it("false, wenn time vor der ersten oder nach der letzten Kerze liegt", () => {
    expect(isTimeCovered(candles, 500, barSeconds)).toBe(false);
    expect(isTimeCovered(candles, 5000, barSeconds)).toBe(false);
  });

  it("true, wenn time exakt auf eine geladene Kerze trifft", () => {
    expect(isTimeCovered(candles, 1300, barSeconds)).toBe(true);
  });

  it("true innerhalb einer normalen Kerzenbreite nach der letzten Kerze davor", () => {
    expect(isTimeCovered(candles, 1450, barSeconds)).toBe(true); // 150s nach 1300, < 1.5*300
  });

  it("false mitten in einer Lücke, die größer als 1.5 Kerzenbreiten ist", () => {
    expect(isTimeCovered(candles, 2500, barSeconds)).toBe(false); // 900s nach 1600, > 1.5*300
  });
});

// Bug-Report Philip 2026-07-31 (siehe refreshTradeMarkersInternal & Co. in PriceChart.vue): ein
// Trade "existiert" erst im Chart, sobald seine Einstiegszeit auf oder vor der letzten aktuell
// geladenen Kerze liegt — sonst stapeln sich noch nicht passierte Trades am rechten Rand.
describe("tradesVisibleForCandles", () => {
  const candles = [{ time: 1000 }, { time: 1300 }, { time: 1600 }];

  it("gibt ein leeres Array zurück, wenn keine Kerzen geladen sind", () => {
    expect(tradesVisibleForCandles([{ entryTime: 1000 }], [])).toEqual([]);
  });

  it("filtert Trades mit entryTime nach der letzten geladenen Kerze raus", () => {
    const trades = [{ id: 1, entryTime: 900 }, { id: 2, entryTime: 1600 }, { id: 3, entryTime: 9999 }];
    expect(tradesVisibleForCandles(trades, candles)).toEqual([{ id: 1, entryTime: 900 }, { id: 2, entryTime: 1600 }]);
  });
});

function candleAt(time) {
  return { time, open: 1, high: 1, low: 1, close: 1 };
}

// Für den "+1 Kerze"-Button (PriceChart.vue: defineExpose().nextReplayTime). Bug-Report Philip
// 2026-07-19 ("Button tat einfach nichts") + 2026-07-21 ("Das ist der Freitag! Am WE gibts kein
// Forex!!") + 2026-07-29 ("+1 Kerze sprang unvermittelt auf den echten aktuellen Zeitpunkt").
describe("computeNextReplayTime", () => {
  const barSeconds = 300; // 5m
  const maxGap = 7 * 24 * 3600;

  it("liefert die älteste geladene Kerze, wenn after=null ist (Live -> erster Replay-Schritt)", async () => {
    const candles = [candleAt(1000), candleAt(1300)];
    await expect(computeNextReplayTime(candles, null, barSeconds, async () => [], maxGap)).resolves.toBe(1000);
  });

  it("liefert null, wenn after=null ist und keine Kerzen geladen sind", async () => {
    await expect(computeNextReplayTime([], null, barSeconds, async () => [], maxGap)).resolves.toBeNull();
  });

  it("nutzt die bereits geladene nächste Kerze, ohne nachzufragen", async () => {
    const candles = [candleAt(1000), candleAt(1300), candleAt(1600)];
    let fetchCalled = false;
    const result = await computeNextReplayTime(candles, 1000, barSeconds, async () => {
      fetchCalled = true;
      return [];
    }, maxGap);
    expect(result).toBe(1300);
    expect(fetchCalled).toBe(false);
  });

  it("fragt gezielt nach (Wochenend-Lücke) und übernimmt den ersten plausiblen Fund", async () => {
    const candles = [candleAt(1000)]; // keine spätere Kerze bereits geladen
    const fridayClose = 1000;
    const mondayOpen = fridayClose + 60 * 3600; // ~60h Wochenende
    const probe = [candleAt(mondayOpen), candleAt(mondayOpen + barSeconds)];
    const result = await computeNextReplayTime(candles, fridayClose, barSeconds, async (after) => {
      expect(after).toBe(fridayClose);
      return probe;
    }, maxGap);
    expect(result).toBe(mondayOpen);
  });

  it("verwirft einen Fund, der weiter als maxPlausibleGapSec entfernt liegt (Bug-Report 2026-07-29)", async () => {
    const after = 1000;
    const tooFar = after + maxGap + barSeconds;
    const result = await computeNextReplayTime([candleAt(1000)], after, barSeconds, async () => [candleAt(tooFar)], maxGap);
    expect(result).toBeNull();
  });

  it("fällt auf +1 Kerzenlänge zurück, wenn der Fetch gar keinen Kandidaten liefert", async () => {
    const after = 1000;
    const result = await computeNextReplayTime([candleAt(1000)], after, barSeconds, async () => [], maxGap);
    expect(result).toBe(after + barSeconds);
  });

  it("fällt auf +1 Kerzenlänge zurück, wenn der Fetch selbst fehlschlägt", async () => {
    const after = 1000;
    const result = await computeNextReplayTime([candleAt(1000)], after, barSeconds, async () => {
      throw new Error("network down");
    }, maxGap);
    expect(result).toBe(after + barSeconds);
  });
});
