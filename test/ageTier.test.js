// Die Alters-Einstufung existiert bewusst zweimal (Browser-Bundle vs. Deno-Edge-Runtime, siehe
// CLAUDE.md) — bis 2026-09-10 waren die beiden Kopien aber inhaltlich verschieden (Frontend 1d/7d
// auf Handelszeit, Backend 24h/120h auf Wandzeit), sodass dasselbe Level im Chart "Medium" und im
// Winrate-Filter "Major" hieß. Dieser Test hält beide Kopien deckungsgleich.
import { describe, expect, it } from "vitest";
import { classifyAge, MINOR_MAX_SECONDS, MAJOR_MIN_SECONDS } from "../src/ageTier.ts";
import {
  classifyAge as classifyAgeBackend,
  businessSecondsBetween as businessSecondsBackend,
  MINOR_MAX_SECONDS as MINOR_MAX_BACKEND,
  MAJOR_MIN_SECONDS as MAJOR_MIN_BACKEND,
} from "../supabase/functions/_shared/ageTier.ts";
import { businessSecondsBetween } from "../src/chartTimeUtils.js";

const DAY = 24 * 3600;

describe("classifyAge", () => {
  it("< 1 Handelstag -> minor", () => {
    expect(classifyAge(0)).toBe("minor");
    expect(classifyAge(DAY - 1)).toBe("minor");
  });

  it("1 bis unter 5 Handelstage -> medium", () => {
    expect(classifyAge(DAY)).toBe("medium");
    expect(classifyAge(5 * DAY - 1)).toBe("medium");
  });

  it("ab 5 Handelstagen -> major (eine volle Kalenderwoche, Wochenende rausgerechnet)", () => {
    expect(classifyAge(5 * DAY)).toBe("major");
    expect(classifyAge(26 * DAY)).toBe("major");
  });
});

describe("Frontend- und Backend-Kopie stimmen überein", () => {
  it("gleiche Schwellwerte", () => {
    expect([MINOR_MAX_SECONDS, MAJOR_MIN_SECONDS]).toEqual([MINOR_MAX_BACKEND, MAJOR_MIN_BACKEND]);
  });

  it("gleiche Einstufung und gleiche Handelszeit-Rechnung über einen Monat hinweg", () => {
    const pivot = Date.parse("2026-08-31T14:00:00Z") / 1000;
    for (let h = 0; h <= 24 * 30; h += 7) {
      const end = pivot + h * 3600;
      const seconds = businessSecondsBetween(pivot, end);
      expect(businessSecondsBackend(pivot, end)).toBe(seconds);
      expect(classifyAgeBackend(seconds)).toBe(classifyAge(seconds));
    }
  });
});
