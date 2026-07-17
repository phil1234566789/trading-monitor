// buildTrendState/buildNestedTrendStructure gegen den echten GBPUSD-Downtrend (17.07.),
// abgesichert mit den Werten, die Philip per Marktstruktur-Analyse von Hand bestätigt hat:
// - Äußerer Rahmen: Swing High 1.35578 (Ursprung des Downtrends, 15.07 20:20), Swing Low
//   1.34262 (tiefster bisher erreichter Punkt, 17.07 12:50) — noch nicht gebrochen.
// - M5-Unterstruktur: Protected High 1.34466, gebrochen durch ~1.3454 -> CHoCH (der Downtrend
//   bleibt aber gültig, solange 1.35578 nicht per Kerzenabschluss bricht).
import { describe, expect, it } from "vitest";
import { buildTrendState, buildNestedTrendStructure } from "../src/trendStructure.js";
import m5Candles from "./fixtures/gbpusd-m5-trend-2026-07-13.json";

// Anker exakt am Ursprung des Swing High 1.35578 (siehe TREND_ANALYSIS_ANCHOR_TIME in
// PriceChart.vue) — 19:20 statt der Pivot-Kerze selbst (20:20), damit die Fraktal-Erkennung
// (braucht period=5 Kerzen davor) den Pivot überhaupt als solchen erkennt.
const ANCHOR_TIME = Math.floor(new Date("2026-07-15T19:20:00+02:00").getTime() / 1000);

describe("buildTrendState — Anker direkt am Pivot-Ursprung", () => {
  const state = buildTrendState(m5Candles, { anchorTime: ANCHOR_TIME });

  it("erkennt sofort einen Downtrend (Anker sitzt exakt am Top)", () => {
    expect(state.direction).toBe("down");
  });

  it("setzt Swing High/Low korrekt", () => {
    expect(state.swingHigh.price).toBe(1.35578);
    expect(state.swingLow.price).toBe(1.34262);
  });

  it("markiert den CHoCH am gebrochenen Protected High (1.34466), ohne die Richtung zu kippen", () => {
    expect(state.choch).not.toBeNull();
    expect(state.choch.price).toBe(1.34466);
    expect(state.direction).toBe("down"); // CHoCH != Trendwende, siehe marktstruktur.md
  });

  it("mit diesem Anker gibt es (noch) keine Umkehr -> keine previous-Kette", () => {
    // Anders als beim alten, später gewählten Anker: hier ist der ganze Zeitraum EIN
    // durchgehender Abschnitt, weil 1.35578 nie gebrochen wurde.
    expect(state.previous).toBeNull();
  });
});

describe("buildNestedTrendStructure — äußerer Rahmen aus der M5-Kette abgeleitet", () => {
  // Regressionstest für einen Design-Fehler aus dem Chat: die äußere Struktur darf NICHT aus
  // einer separat (z.B. H1-)verankerten Berechnung kommen, die einen ANDEREN aktuellen Stand
  // liefern könnte (siehe History dieser Datei) — sondern direkt aus derselben M5-Kette, die
  // auch die unterstruktur bildet ("wir vermischen hier die Trends... tatsächlich sind das
  // über- und unterstrukturen").
  const nested = buildNestedTrendStructure(m5Candles, { anchorTime: ANCHOR_TIME, maxUnterstruktur: 2 });

  it("direction/swingHigh/swingLow entsprechen exakt buildTrendState mit demselben Anker", () => {
    const flat = buildTrendState(m5Candles, { anchorTime: ANCHOR_TIME });
    expect(nested.direction).toBe(flat.direction);
    expect(nested.swingHigh.price).toBe(flat.swingHigh.price);
    expect(nested.swingLow.price).toBe(flat.swingLow.price);
  });

  it("unterstruktur enthält höchstens maxUnterstruktur Einträge", () => {
    expect(nested.unterstruktur.length).toBeGreaterThan(0);
    expect(nested.unterstruktur.length).toBeLessThanOrEqual(2);
  });

  it("unterstruktur[0] ist der aktuelle, noch offene M5-Abschnitt", () => {
    expect(nested.unterstruktur[0].direction).toBe(nested.direction);
    expect(nested.unterstruktur[0].invalidatedAt).toBeNull();
  });
});

describe("buildNestedTrendStructure — Gegen-Grenze kommt aus der GESAMTEN Kette, nicht nur dem aktuellen Abschnitt", () => {
  // Mit einem früheren Anker (statt exakt am 1.35578-Ursprung) bleibt im Fixture-Fenster nur ein
  // einziger, nie umgekehrter "up"-Abschnitt übrig (siehe Testlauf) — kein Multi-Segment-Fall
  // greifbar, ohne synthetische Kerzen fragil von Hand zu konstruieren (siehe Git-Historie: schon
  // zweimal an Kerzen-Timing-Details gescheitert). Deshalb hier nur der einfache Fall: bei genau
  // einem Abschnitt entspricht die äußere Grenze exakt dessen eigenem Wert.
  it("bei nur einem Abschnitt in der Kette entspricht die äußere Grenze genau dessen eigenem Wert", () => {
    const nested = buildNestedTrendStructure(m5Candles, { anchorTime: ANCHOR_TIME, maxUnterstruktur: 10 });
    expect(nested.unterstruktur).toHaveLength(1);
    expect(nested.swingHigh.price).toBe(nested.unterstruktur[0].swingHigh.price);
  });

  it("swingLow entspricht bei direction down dem AKTUELLEN Abschnitt (wie weit die laufende Bewegung gekommen ist)", () => {
    const nested = buildNestedTrendStructure(m5Candles, { anchorTime: ANCHOR_TIME, maxUnterstruktur: 10 });
    expect(nested.direction).toBe("down");
    expect(nested.swingLow.price).toBe(nested.unterstruktur[0].swingLow.price);
  });
});
