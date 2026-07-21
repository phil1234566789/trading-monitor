// Bug-Report Philip 2026-07-21 ("Kerzen hören ab 22:00 auf", Replay bei 23:00; "+1 Kerze"
// funktioniert nicht mehr): cTrader behandelt den exakten toTimestamp-Moment IMMER als "die noch
// offene aktuelle Kerze" (siehe supabase/functions/_shared/ctrader/client.ts: fetchOneTrendbar) —
// auch rückwirkend im Replay. Ohne Ausgleich fehlt deshalb strukturell IMMER genau die Kerze, deren
// Open-Zeit exakt replayUntil entspricht, obwohl clipReplay() (PriceChart.vue) sie korrekt anzeigen
// würde (Filter ist `<=`).
import { describe, expect, it } from "vitest";
import { replayFetchToMs, nextCandleAfter, businessSecondsBetween, formatAge } from "../src/chartTimeUtils.js";

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
