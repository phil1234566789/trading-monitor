// Fixture: echter GBPUSD-M5-Verlauf (siehe scripts/fetch-trend-fixture.mjs) — enthält bewusst
// zwei Phasen: einen Uptrend bis 15.07.2026 20:20, danach einen Downtrend bis jetzt. Der
// eigentliche Trend-Indikator (Pivot-Punkte + EMA) existiert noch nicht — dieses Test-File ist
// der Platzhalter, gegen den wir die Indikator-Ergebnisse absichern werden, sobald die Regeln
// spezifiziert sind: er soll den Übergang uptrend -> downtrend erkennen (und nicht vorher schon
// downtrend bzw. nachher noch uptrend melden). Bis dahin nur ein Smoke-Test auf die Fixture selbst.
import { describe, expect, it } from "vitest";
import candles from "./fixtures/gbpusd-m5-trend-2026-07-13.json";

// Downtrend-Start laut Philip.
const DOWNTREND_START = Math.floor(new Date("2026-07-15T20:20:00+02:00").getTime() / 1000);

describe("GBPUSD M5 Fixture: Uptrend (ab 2026-07-13 22:00) -> Downtrend (ab 2026-07-15 20:20)", () => {
  it("ist lückenlos nach Zeit aufsteigend sortiert (oldest first)", () => {
    for (let i = 1; i < candles.length; i++) {
      expect(candles[i].time).toBeGreaterThan(candles[i - 1].time);
    }
  });

  it("hat die erwartete Kerzenform {time,open,high,low,close}", () => {
    for (const c of candles) {
      expect(c).toMatchObject({
        time: expect.any(Number),
        open: expect.any(Number),
        high: expect.any(Number),
        low: expect.any(Number),
        close: expect.any(Number),
      });
    }
  });

  it("enthält Kerzen vor und nach dem Downtrend-Start", () => {
    expect(candles[0].time).toBeLessThan(DOWNTREND_START);
    expect(candles[candles.length - 1].time).toBeGreaterThan(DOWNTREND_START);
  });

  it.todo("erkennt vor dem Downtrend-Start noch keinen downtrend");
  it.todo("erkennt ab dem Downtrend-Start einen downtrend");
  it.todo("erkennt vor dem Downtrend-Start einen uptrend");
  it.todo("erkennt ab dem Downtrend-Start keinen uptrend mehr");
  it.todo("meldet eine plausible Trendstärke für den Downtrend-Abschnitt");
});
