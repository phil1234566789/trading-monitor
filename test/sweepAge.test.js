// Sweep-Alter: wie lange das gesweepte Level bestand, bevor es fiel. Geht in den Telegram-Alarm
// (poi-watcher) und in trade_setups.sweep_age_hours.
//
// Hieß bis zum 20.09.2026 tradeSetupOutcome.test.js und prüfte zusätzlich die Winrate-Backtest-
// Logik (Entry/SL/TP + Forward-Walk). Die ist mit get_trade_setup_winrate weggefallen — ihre
// Erfolgsdefinition (2,5 RR, Stopp bei 6 Pips gedeckelt) war nicht Philips eigene und lieferte
// deshalb eine Zahl, mit der niemand etwas anfangen konnte. Was die Nachfolge antritt, steht in
// analysis/dr-reichweite/.
import { describe, expect, it } from "vitest";
import { classifyAge, computeSweepAgeHours } from "../supabase/functions/_shared/ageTier.ts";

describe("computeSweepAgeHours", () => {
  it("berechnet die Stunden zwischen Level-Entstehung (ls_pivot_time) und Sweep (ls_touched_time)", () => {
    const lsPivotTimeSec = 1000;
    const lsTouchedTimeSec = lsPivotTimeSec + 6 * 3600;
    expect(computeSweepAgeHours(lsTouchedTimeSec, lsPivotTimeSec)).toBe(6);
  });

  // Regression zum Pin-Fall vom 2026-09-10 (GBPUSD-1H-High 1.35652): 8d 17h Wandzeit, aber nur
  // 6d 17h Handelszeit — genau dieses Wochenende entschied damals zwischen Major und Medium.
  it("rechnet das Wochenende raus", () => {
    const pivot = Date.parse("2026-08-31T14:00:00Z") / 1000;
    const touched = Date.parse("2026-09-09T07:00:00Z") / 1000;
    expect((touched - pivot) / 3600).toBe(209);
    expect(computeSweepAgeHours(touched, pivot)).toBe(161);
    expect(classifyAge(computeSweepAgeHours(touched, pivot) * 3600)).toBe("major");
  });
});
