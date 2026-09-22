// Der Fall, den dieser Guard fangen soll: ein LLM trägt Philips Berliner Uhrzeit als nackten
// ISO-String ein, die Spalte interpretiert ihn als UTC, der Trade steht 2h daneben.
import { describe, expect, it } from "vitest";
import {
  berlinOffsetSuffix,
  hasExplicitOffset,
  missingOffsetError,
} from "../supabase/functions/trading-monitor-mcp/isoOffsetGuard.ts";

const SOMMER_MS = Date.UTC(2026, 8, 22, 12, 0, 0); // 22.09.2026, CEST
const WINTER_MS = Date.UTC(2026, 0, 15, 12, 0, 0); // 15.01.2026, CET

describe("hasExplicitOffset", () => {
  it("akzeptiert Zeitstempel mit Zeitzone", () => {
    for (const value of [
      "2026-09-22T14:30:00Z",
      "2026-09-22T14:30:00+02:00",
      "2026-09-22T14:30:00+0200",
      "2026-09-22T14:30:00-05:00",
      "2026-09-22T14:30:00.123Z",
      "2026-09-22T14:30+02:00",
    ]) {
      expect(hasExplicitOffset(value), value).toBe(true);
    }
  });

  it("lehnt mehrdeutige Zeitstempel ab", () => {
    for (const value of [
      "2026-09-22T14:30:00", // der eigentliche Bug
      "2026-09-22 14:30:00",
      "2026-09-22", // ohne Uhrzeit genauso mehrdeutig wie ohne Offset
      "14:30",
      "",
    ]) {
      expect(hasExplicitOffset(value), value).toBe(false);
    }
  });
});

describe("berlinOffsetSuffix", () => {
  it("unterscheidet CEST und CET, statt einen festen Offset anzunehmen", () => {
    expect(berlinOffsetSuffix(SOMMER_MS)).toBe("+02:00");
    expect(berlinOffsetSuffix(WINTER_MS)).toBe("+01:00");
  });
});

describe("missingOffsetError", () => {
  it("nennt den Wert und den aktuell gültigen Berlin-Offset", () => {
    const msg = missingOffsetError("2026-09-22T14:30:00", SOMMER_MS);
    expect(msg).toContain("2026-09-22T14:30:00");
    expect(msg).toContain("+02:00");
    expect(msg).not.toContain("+01:00");
  });
});
