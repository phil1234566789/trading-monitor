// Bug-Report Philip 2026-07-21 ("Kerzen hören ab 22:00 auf", Replay bei 23:00; "+1 Kerze"
// funktioniert nicht mehr): cTrader behandelt den exakten toTimestamp-Moment IMMER als "die noch
// offene aktuelle Kerze" (siehe supabase/functions/_shared/ctrader/client.ts: fetchOneTrendbar) —
// auch rückwirkend im Replay. Ohne Ausgleich fehlt deshalb strukturell IMMER genau die Kerze, deren
// Open-Zeit exakt replayUntil entspricht, obwohl clipReplay() (PriceChart.vue) sie korrekt anzeigen
// würde (Filter ist `<=`).
import { describe, expect, it } from "vitest";
import { replayFetchToMs, nextCandleAfter } from "../src/chartTimeUtils.js";

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

  it("ohne bar (z.B. OKX/BTC) kein Offset — nur der reine replayUntil-Zeitpunkt", () => {
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
