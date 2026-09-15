// @vitest-environment node
import { describe, it, expect } from "vitest";
import { withBerlinTimes } from "../supabase/functions/trading-monitor-mcp/jsonResponse.ts";

// Echte Paarung aus dem GBPUSD-Backtest 09.09.2026: liquidityLevels1h-Level 1.35616 trägt
// touchedTime 1788933600, structure1h meldet für dasselbe Ereignis touchedAt "2026-09-09 08:00".
// Als Anker bewusst ein server-erzeugter Wert, nicht ein selbst ausgerechneter.
const ANCHOR_SEC = 1788933600;
const ANCHOR_BERLIN = "2026-09-09 08:00";

describe("withBerlinTimes — Zwilling je rohem Unix-Sekunden-Feld", () => {
  it("benennt die Zwillinge nach der bestehenden Konvention", () => {
    const out = withBerlinTimes({
      pivotTime: ANCHOR_SEC,
      touchedTime: ANCHOR_SEC,
      startTime: ANCHOR_SEC,
      endTime: ANCHOR_SEC,
      sourceTimeSec: ANCHOR_SEC,
      lastAnalysisTimeSec: ANCHOR_SEC,
      nextReplayUntilSec: ANCHOR_SEC,
      sec: ANCHOR_SEC,
    });
    expect(out.pivotAt).toBe(ANCHOR_BERLIN);
    expect(out.touchedAt).toBe(ANCHOR_BERLIN);
    expect(out.startAt).toBe(ANCHOR_BERLIN);
    expect(out.endAt).toBe(ANCHOR_BERLIN);
    expect(out.sourceAt).toBe(ANCHOR_BERLIN);
    expect(out.lastAnalysisAt).toBe(ANCHOR_BERLIN);
    expect(out.nextReplayUntilAt).toBe(ANCHOR_BERLIN);
    expect(out.at).toBe(ANCHOR_BERLIN);
  });

  it("lässt die rohen Sekunden stehen (Zwilling kommt zusätzlich, nicht statt)", () => {
    const out = withBerlinTimes({ pivotTime: ANCHOR_SEC });
    expect(out.pivotTime).toBe(ANCHOR_SEC);
  });

  it("rechnet Sommer- und Winterzeit unterschiedlich um (der eigentliche Fehlerfall)", () => {
    // Referenz-UTC über toISOString (unabhängig von Zeitzonendaten) — geprüft wird der Abstand:
    // Januar = CET (+1), Juli = CEST (+2).
    const winterSec = Date.UTC(2026, 0, 15, 12, 0, 0) / 1000;
    const summerSec = Date.UTC(2026, 6, 15, 12, 0, 0) / 1000;
    const { at: winterAt } = withBerlinTimes({ sec: winterSec });
    const { at: summerAt } = withBerlinTimes({ sec: summerSec });
    expect(winterAt).toBe("2026-01-15 13:00");
    expect(summerAt).toBe("2026-07-15 14:00");
  });

  it("lässt Kerzen-time bewusst ohne Zwilling (mehrere hundert Einträge, nie benannt)", () => {
    const out = withBerlinTimes({ candles: [{ time: ANCHOR_SEC, close: 1.35588 }] });
    expect(out.candles[0]).toEqual({ time: ANCHOR_SEC, close: 1.35588 });
  });

  it("vergibt keinen Zwilling für Dauer-Werte in derselben Sekunden-Einheit", () => {
    const out = withBerlinTimes({ businessSeconds: 480000, ageSec: 3600 });
    expect(out).toEqual({ businessSeconds: 480000, ageSec: 3600 });
  });

  it("überschreibt ein bereits vorhandenes Feld nicht", () => {
    const out = withBerlinTimes({ sec: ANCHOR_SEC, at: "selbst gesetzt" });
    expect(out.at).toBe("selbst gesetzt");
  });

  it("läuft durch verschachtelte Objekte und Arrays", () => {
    const out = withBerlinTimes({
      evidence: { tradeSetups: [{ obStartTime: ANCHOR_SEC }] },
      levels: [{ pivotTime: ANCHOR_SEC, touchedTime: null }],
    });
    expect(out.evidence.tradeSetups[0].obStartAt).toBe(ANCHOR_BERLIN);
    expect(out.levels[0].pivotAt).toBe(ANCHOR_BERLIN);
    expect(out.levels[0].touchedAt).toBeUndefined();
  });
});
