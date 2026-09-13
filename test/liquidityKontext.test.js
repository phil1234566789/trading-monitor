// formatKontext baut das `kontext`-Label, das Lana an jedem Liquidity-Level in get_data_export
// liest ("NY-High Major (6d 18h)"). Es war bis 2026-09-13 ungetestet und trug eine dritte,
// abweichende Kopie der Alters-Einstufung mit 7-Tage-Major-Schwelle statt 5 — dadurch hieß jedes
// Level zwischen 5 und 7 Handelstagen "Medium" statt "Major". Da "Major" das Handelsverbot aus
// liquidität.md auslöst und "Medium" nicht, verschob das eine harte Regel zu einer weichen.
import { describe, expect, it } from "vitest";
import { formatKontext } from "../supabase/functions/trading-monitor-mcp/kontextLabel.ts";

const DAY = 24 * 3600;

describe("formatKontext — Alters-Einstufung", () => {
  // Der Regressionsfall: GBPUSD 4H-NY-High 1.35652, Pivot Mo 31.08.2026 13:00 UTC, Analysezeitpunkt
  // Mi 09.09.2026 07:10 UTC. 8d 18h Wandzeit, abzüglich eines Wochenendes 6d 18h Handelszeit — ein
  // Major Inducement, das vor dem Fix als "Medium" gemeldet wurde.
  it("6d 18h Handelszeit -> Major (GBPUSD 09.09.2026, Level 1.35652)", () => {
    expect(formatKontext("NY-High", 1788181200, null, 1788937800)).toBe("NY-High Major (6d 18h)");
  });

  it("exakt 5 Handelstage -> schon Major (Grenze ist [min,max), wie _shared/ageTier.ts)", () => {
    // Mo 00:00 UTC + 5 Handelstage = Sa 00:00; Referenz deshalb Mo darauf, damit Sa/So rausfallen.
    const pivot = Date.UTC(2026, 8, 7, 0, 0, 0) / 1000; // Mo 07.09.2026
    const reference = Date.UTC(2026, 8, 14, 0, 0, 0) / 1000; // Mo 14.09.2026 -> 5 Handelstage
    expect(formatKontext(null, pivot, null, reference)).toBe("Major (5d)");
  });

  it("knapp unter 5 Handelstagen -> Medium", () => {
    const pivot = Date.UTC(2026, 8, 7, 1, 0, 0) / 1000; // Mo 07.09.2026 01:00
    const reference = Date.UTC(2026, 8, 14, 0, 0, 0) / 1000; // 4d 23h Handelszeit
    expect(formatKontext(null, pivot, null, reference)).toBe("Medium (4d 23h)");
  });

  it("< 1 Handelstag -> minor, also ohne Tier-Präfix", () => {
    const reference = Date.UTC(2026, 8, 9, 12, 0, 0) / 1000;
    expect(formatKontext("Asia-High", reference - 3 * 3600, null, reference)).toBe("Asia-High (3h)");
  });

  // touchedTime hat Vorrang vor nowSec (Bug-Report Philip 2026-08-26, vierte Runde): ein vor Tagen
  // gesweeptes Level soll nicht scheinbar weiter altern, nur weil seither Zeit vergeht.
  it("touchedTime schlägt nowSec für Alter UND Einstufung", () => {
    const pivot = Date.UTC(2026, 8, 8, 12, 0, 0) / 1000; // Di 08.09.2026 12:00
    const touched = Date.UTC(2026, 8, 9, 12, 0, 0) / 1000; // Mi 09.09.2026 12:00 -> 1d
    const now = Date.UTC(2026, 8, 25, 12, 0, 0) / 1000; // zwei Wochen später
    expect(formatKontext(null, pivot, touched, now)).toBe("Medium (1d)");
  });
});
