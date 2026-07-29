// Feature-Wunsch Philip 2026-07-26: "vertikale gestrichelte Linie bissl beschriften ... Wochentag
// (abgekürzt), Uhrzeit" — formatEventLabel ist die testbare Kernlogik dahinter (reine Funktion,
// Rendering/Rotation selbst ist wie bei sessions.js nicht separat getestet, siehe dort).
import { describe, expect, it } from "vitest";
import { formatEventLabel, isSameBerlinDay } from "../src/newsMarkers.js";

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

// Feature-Wunsch Philip 2026-07-30: zukünftige News-Linien sollen schon "pro aktuellen Tag (oder
// Replay-Tag)" sichtbar sein, bevor die Kerzen so weit gekommen sind — isSameBerlinDay ist die
// Scope-Entscheidung dahinter (PriceChart.vue: refreshNewsMarkersInternal).
describe("isSameBerlinDay", () => {
  it("true für zwei Zeitpunkte am selben Kalendertag (Europe/Berlin)", () => {
    const morning = Date.UTC(2026, 6, 23, 6, 0, 0) / 1000; // 08:00 CEST
    const evening = Date.UTC(2026, 6, 23, 19, 0, 0) / 1000; // 21:00 CEST
    expect(isSameBerlinDay(morning, evening)).toBe(true);
  });

  it("false über eine Kalendertag-Grenze hinweg, auch wenn der UTC-Tag noch derselbe ist", () => {
    // 23:30 CEST (23.07.) und 00:30 CEST (24.07.) liegen nur 1h auseinander, aber an
    // verschiedenen Berlin-Kalendertagen.
    const lateNight = Date.UTC(2026, 6, 23, 21, 30, 0) / 1000; // 23:30 CEST 23.07.
    const justAfterMidnight = Date.UTC(2026, 6, 23, 22, 30, 0) / 1000; // 00:30 CEST 24.07.
    expect(isSameBerlinDay(lateNight, justAfterMidnight)).toBe(false);
  });

  it("rechnet DST-aware um (Winterzeit-Beispiel)", () => {
    // 00:30 CET und 23:30 CET desselben Kalendertags (12.01.2026, Winterzeit UTC+1).
    const justAfterMidnight = Date.UTC(2026, 0, 11, 23, 30, 0) / 1000; // 00:30 CET 12.01.
    const lateNight = Date.UTC(2026, 0, 12, 22, 30, 0) / 1000; // 23:30 CET 12.01.
    expect(isSameBerlinDay(justAfterMidnight, lateNight)).toBe(true);
  });
});
