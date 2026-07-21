// Bug-Report Philip 2026-07-21 ("Kerzen hören ab 22:00 auf", Replay bei 23:00; "+1 Kerze"
// funktioniert nicht mehr): cTrader behandelt den exakten toTimestamp-Moment IMMER als "die noch
// offene aktuelle Kerze" (siehe supabase/functions/_shared/ctrader/client.ts: fetchOneTrendbar) —
// auch rückwirkend im Replay. Ohne Ausgleich fehlt deshalb strukturell IMMER genau die Kerze, deren
// Open-Zeit exakt replayUntil entspricht, obwohl clipReplay() (PriceChart.vue) sie korrekt anzeigen
// würde (Filter ist `<=`).
import { describe, expect, it } from "vitest";
import { replayFetchToMs } from "../src/chartTimeUtils.js";

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
