// Feature-Wunsch Philip 2026-07-26: "vertikale gestrichelte Linie bissl beschriften ... Wochentag
// (abgekürzt), Uhrzeit" — formatEventLabel ist die testbare Kernlogik dahinter (reine Funktion,
// Rendering/Rotation selbst ist wie bei sessions.js nicht separat getestet, siehe dort).
import { describe, expect, it } from "vitest";
import { formatEventLabel } from "../src/newsMarkers.js";

describe("formatEventLabel", () => {
  it("formatiert Wochentag (abgekürzt, ohne Punkt) + Uhrzeit in Europe/Berlin", () => {
    // Do 23.07.2026 12:15 UTC = 14:15 CEST (Sommerzeit, UTC+2) — siehe Seed-Migration.
    const eventTime = Date.UTC(2026, 6, 23, 12, 15, 0) / 1000;
    expect(formatEventLabel(eventTime)).toBe("Do 14:15");
  });

  it("rechnet DST-aware um, nicht mit fixem Offset (Winterzeit-Beispiel)", () => {
    // Mo 12.01.2026 09:00 UTC = 10:00 CET (Winterzeit, UTC+1).
    const eventTime = Date.UTC(2026, 0, 12, 9, 0, 0) / 1000;
    expect(formatEventLabel(eventTime)).toBe("Mo 10:00");
  });
});
