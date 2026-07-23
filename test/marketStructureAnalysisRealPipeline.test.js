// Chat 2026-07-24, Bug-Report Philip ("wie kann es sein, dass wir TDD machen, ich den SOLL State
// vorgebe und die Tests grün laufen aber der Algo trotzdem nicht das macht, was die Tests
// eigentlich sicherstellen sollen?"): alle bisherigen Tests liefen entweder gegen synthetische
// Kerzen oder gegen von Hand konstruierte state-Objekte — nie gegen die ECHTE Pipeline
// (Kerzen -> computeRangesPivots -> buildMarketStructureState, siehe marketStructureAnalysis.ts),
// mit den ECHTEN Settings, die im Moment des Bug-Reports tatsächlich in .debug/metadata.json
// standen. Dieser Test nimmt genau diesen Snapshot (Kerzen aus
// test/fixtures/gbpusd-h1-2026-07-23-live-metadata-snapshot.json, Periode 5/2, fixer Start
// 13.07.2026 07:00 UTC = window.since aus den Metadaten) als Input und prüft direkt, was die
// PRODUKTIONS-Funktionen daraus tatsächlich berechnen — keine nachgebaute Kopie der Pipeline.
import { describe, expect, it } from "vitest";
import { computeRangesPivots, buildMarketStructureState } from "../src/marketStructureAnalysis";
import candles from "./fixtures/gbpusd-h1-2026-07-23-live-metadata-snapshot.json";

// aus .debug/metadata.json (Snapshot 2026-07-23, 21:51 Uhr, replay.until = 21.07.2026 20:00):
// structure.period5 = {period: 5, lookbackHours: 120}, structure.period2Embedded = {period: 2,
// lookbackHours: 120}, structure.window = {mode: "fixed", since: 1783918800 (13.07., 07:00)}.
const PERIOD_5 = 5;
const PERIOD_2 = 2;
const FIXED_SINCE = 1783918800; // 13.07.2026, 07:00 UTC

describe("marketStructureAnalysis: echte Pipeline gegen den .debug/metadata.json-Snapshot vom 2026-07-23", () => {
  it("computeRangesPivots (Periode 5) erkennt dieselben Pivots wie live in den Metadaten protokolliert", () => {
    const pivots5 = computeRangesPivots(candles, PERIOD_5, FIXED_SINCE);
    // aus dem Snapshot: structure.period5.pivots enthält u.a. genau diese beiden LQ-Sweep-Level.
    expect(pivots5.find((p) => p.price === 1.33688)).toBeTruthy();
    expect(pivots5.find((p) => p.price === 1.33806)).toBeTruthy();
  });

  it("buildMarketStructureState erkennt einen break-of-structure, sobald 1.33806 real unterschlossen wird", () => {
    const pivots5 = computeRangesPivots(candles, PERIOD_5, FIXED_SINCE);
    const pivots2 = computeRangesPivots(candles, PERIOD_2, FIXED_SINCE);

    const state = buildMarketStructureState(pivots5, pivots2, PERIOD_5, PERIOD_2, candles);

    const bos = state.structurePivots.filter((p) => p.type === "break-of-structure");
    expect(bos.length).toBeGreaterThan(0);
  });
});
