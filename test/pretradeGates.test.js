// Handelszeit-Grenzfälle (08:00/18:00-Kante, Wochenende) + News-Timing-Fälle für check_pretrade_gates
// (Schritt 1+2, siehe docs/state-machine.md). Zeitpunkte bewusst per Date.UTC konstruiert (2026-08-31
// ist ein Montag, CEST/UTC+2 aktiv) statt über Intl im Test selbst hergeleitet, damit die Erwartung
// unabhängig vom geprüften Code feststeht.
import { describe, expect, it } from "vitest";
import { evaluateTradingHoursGate, evaluateNewsGate, NEWS_IMMINENT_MINUTES, NEWS_SOON_MINUTES, NEWS_POST_EVENT_PAUSE_MINUTES } from "../supabase/functions/trading-monitor-mcp/pretradeGates.ts";

const TRADING_WINDOWS = { weekday: [[480, 1080]], saturday: [], sunday: [] }; // 08:00-18:00

function utc(h, m = 0, day = 31) {
  return Date.UTC(2026, 7, day, h, m, 0) / 1000; // August 2026, CEST = UTC+2
}

describe("evaluateTradingHoursGate", () => {
  it("08:00 Berlin (Montag) liegt innerhalb der Handelszeit", () => {
    expect(evaluateTradingHoursGate(utc(6, 0), TRADING_WINDOWS).exclude).toBe(false);
  });

  it("07:59 Berlin (Montag) liegt noch außerhalb", () => {
    expect(evaluateTradingHoursGate(utc(5, 59), TRADING_WINDOWS).exclude).toBe(true);
  });

  it("18:00 Berlin (Montag) liegt außerhalb (to exklusiv)", () => {
    expect(evaluateTradingHoursGate(utc(16, 0), TRADING_WINDOWS).exclude).toBe(true);
  });

  it("17:59 Berlin (Montag) liegt noch innerhalb", () => {
    expect(evaluateTradingHoursGate(utc(15, 59), TRADING_WINDOWS).exclude).toBe(false);
  });

  it("Samstag (29.08.2026) ist immer ausgeschlossen (leeres saturday-Fenster)", () => {
    expect(evaluateTradingHoursGate(utc(10, 0, 29), TRADING_WINDOWS).exclude).toBe(true);
  });
});

describe("evaluateNewsGate", () => {
  const nowSec = utc(9, 0);

  it("keine Daten für den Tag hinterlegt -> hasData=false, exclude=false", () => {
    const result = evaluateNewsGate(nowSec, [], false);
    expect(result.hasData).toBe(false);
    expect(result.exclude).toBe(false);
    expect(result.textBlocks[0]).toMatch(/keine News hinterlegt/);
  });

  it("News in 10 Minuten (< NEWS_IMMINENT_MINUTES) -> exclude=true", () => {
    const events = [{ eventTimeSec: nowSec + 10 * 60, currency: "GBP", title: "Test-News" }];
    const result = evaluateNewsGate(nowSec, events, true);
    expect(result.exclude).toBe(true);
    expect(result.events[0].category).toBe("exclude_imminent");
  });

  it("News in 60 Minuten (zwischen IMMINENT und SOON) -> exclude=false, category 'soon'", () => {
    const events = [{ eventTimeSec: nowSec + 60 * 60, currency: "GBP", title: "Test-News" }];
    const result = evaluateNewsGate(nowSec, events, true);
    expect(result.exclude).toBe(false);
    expect(result.events[0].category).toBe("soon");
  });

  it("News vor 10 Minuten (< NEWS_POST_EVENT_PAUSE_MINUTES) -> exclude=true (feste Pause)", () => {
    const events = [{ eventTimeSec: nowSec - 10 * 60, currency: "GBP", title: "Test-News" }];
    const result = evaluateNewsGate(nowSec, events, true);
    expect(result.exclude).toBe(true);
    expect(result.events[0].category).toBe("exclude_post_event_pause");
  });

  it("News weit entfernt, nicht USD/NY -> keine Konsequenz", () => {
    const events = [{ eventTimeSec: nowSec + 200 * 60, currency: "GBP", title: "Test-News" }];
    const result = evaluateNewsGate(nowSec, events, true);
    expect(result.exclude).toBe(false);
    expect(result.events[0].category).toBe("no_consequence");
  });

  it("USD-News innerhalb NY-Session-Fenster, weit entfernt -> ny_time_ahead", () => {
    // NY-Session 14:00-22:00 Berlin (marktsessions.md) — News um 15:00 Berlin = 13:00 UTC.
    const events = [{ eventTimeSec: Date.UTC(2026, 7, 31, 13, 0, 0) / 1000, currency: "USD", title: "Test-News" }];
    const result = evaluateNewsGate(nowSec, events, true);
    expect(result.events[0].category).toBe("ny_time_ahead");
    expect(result.exclude).toBe(false);
  });
});
