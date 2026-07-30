// Feature-Erweiterung 2026-07-30: Claude-Notizen-Import unterstützt jetzt optionale Farben pro
// Annotation sowie mehrere Zeichnungs-Gruppen in einem Paste ({"drawings":[{title,annotations}]}).
// parseAnnotations gibt seit dieser Erweiterung immer eine Liste von Gruppen zurück (auch fürs
// alte, flache Format — dann genau eine Gruppe mit title: null).
import { describe, expect, it } from "vitest";
import { parseAnnotations, resolveLabelPlacements, annotationAnchorPoint } from "../src/claudeAnnotations.js";
import { berlinDayRangeUtcMs } from "../src/backtestExport.js";

// Minimal-Fake von chart/series, nur die zwei Methoden, die annotationAnchorPoint braucht — Preis
// wird 1:1 (*100) auf einen Koordinatenwert abgebildet, Zeit per Identität durchgereicht (die
// eigentliche Zeit->Kerze-Auflösung passiert vorher in resolveTime/snapToBarTime, nicht hier).
function fakeChart() {
  return { timeScale: () => ({ timeToCoordinate: (t) => (t == null ? null : t) }) };
}
function fakeSeries() {
  return { priceToCoordinate: (p) => (p == null ? null : p * 100) };
}
// Reales Datum statt selbst geraten CEST/CET-Offsets, siehe backtestExport.js's berlinDayRangeUtcMs
// — 2026-07-24 liegt fernab jeder DST-Umstellung.
const DATE = "2026-07-24";
const { startUtcMs } = berlinDayRangeUtcMs(DATE);
const startSec = startUtcMs / 1000;
const CANDLES = [{ time: startSec + 8 * 3600 }, { time: startSec + 9 * 3600 }, { time: startSec + 10 * 3600 }];

describe("parseAnnotations", () => {
  it("parst das alte flache Array-Format als eine Gruppe mit title: null", () => {
    const json = JSON.stringify([{ type: "hline", price: 1.3325, text: "Pivot" }]);
    expect(parseAnnotations(json)).toEqual([{ title: null, annotations: [{ type: "hline", price: 1.3325, text: "Pivot" }] }]);
  });

  it("parst das alte { annotations: [...] }-Format als eine Gruppe mit title: null", () => {
    const json = JSON.stringify({ annotations: [{ type: "marker", time: "09:15", price: 1.1, text: "Entry" }] });
    expect(parseAnnotations(json)).toEqual([
      { title: null, annotations: [{ type: "marker", time: "09:15", price: 1.1, text: "Entry" }] },
    ]);
  });

  it("parst { drawings: [...] } als mehrere benannte Gruppen", () => {
    const json = JSON.stringify({
      drawings: [
        { title: "Schritt 1 — Bias", annotations: [{ type: "hline", price: 1.1, text: "A" }] },
        { title: "Schritt 5 — Ausführung", annotations: [{ type: "hline", price: 1.2, text: "B" }] },
      ],
    });
    const result = parseAnnotations(json);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("Schritt 1 — Bias");
    expect(result[1].title).toBe("Schritt 5 — Ausführung");
  });

  it("akzeptiert ein gültiges Hex-color-Feld", () => {
    const json = JSON.stringify([{ type: "hline", price: 1.1, text: "A", color: "#e74c3c" }]);
    expect(parseAnnotations(json)[0].annotations[0].color).toBe("#e74c3c");
  });

  // Feature 2026-07-30 "Zeiger-Linien": Claude entscheidet PRO Annotation über pointer:true, ob sie
  // als schwebender Callout über der TSC-Karte statt inline im Chart erscheint (siehe PriceChart.vue).
  it("akzeptiert ein gültiges pointer-Feld", () => {
    const json = JSON.stringify([{ type: "marker", time: "09:00", price: 1.1, text: "A", pointer: true }]);
    expect(parseAnnotations(json)[0].annotations[0].pointer).toBe(true);
  });

  it("wirft bei ungültigem pointer-Wert (kein Boolean)", () => {
    const json = JSON.stringify([{ type: "marker", time: "09:00", price: 1.1, text: "A", pointer: "yes" }]);
    expect(() => parseAnnotations(json)).toThrow(/pointer/);
  });

  it("fehlt pointer, bleibt die Annotation unverändert (kein pointer-Feld gesetzt)", () => {
    const json = JSON.stringify([{ type: "marker", time: "09:00", price: 1.1, text: "A" }]);
    expect(parseAnnotations(json)[0].annotations[0].pointer).toBeUndefined();
  });

  it("wirft bei ungültigem color-Wert (keine Hex-Farbe)", () => {
    const json = JSON.stringify([{ type: "hline", price: 1.1, text: "A", color: "red" }]);
    expect(() => parseAnnotations(json)).toThrow(/color/);
  });

  it("fehlt color, bleibt die Annotation unverändert (kein color-Feld gesetzt)", () => {
    const json = JSON.stringify([{ type: "hline", price: 1.1, text: "A" }]);
    expect(parseAnnotations(json)[0].annotations[0].color).toBeUndefined();
  });

  it("wirft bei unbekanntem type auch innerhalb einer drawings-Gruppe", () => {
    const json = JSON.stringify({ drawings: [{ title: "X", annotations: [{ type: "circle", price: 1.1 }] }] });
    expect(() => parseAnnotations(json)).toThrow(/unbekannter type/);
  });

  it("wirft, wenn eine drawings-Gruppe kein annotations-Array hat", () => {
    const json = JSON.stringify({ drawings: [{ title: "X" }] });
    expect(() => parseAnnotations(json)).toThrow(/annotations/);
  });

  it("wirft bei ungültigem JSON", () => {
    expect(() => parseAnnotations("{not json")).toThrow(/JSON/);
  });

  it("wirft, wenn weder Array noch annotations noch drawings vorhanden ist", () => {
    expect(() => parseAnnotations(JSON.stringify({ foo: "bar" }))).toThrow();
  });
});

// Bug-Report Philip 2026-07-30: zwei Annotationen auf demselben Preis-Level (z.B. eine "line" und
// ein "marker" am selben Sweep-Punkt) zeichneten ihre Labels exakt übereinander. resolveLabelPlacements
// ist die reine Geometrie-Funktion dahinter (siehe claudeAnnotations.js) — kein Canvas nötig zum Testen.
describe("resolveLabelPlacements", () => {
  it("lässt nicht überlappende Labels unverändert", () => {
    const labels = [
      { x1: 0, x2: 50, y: 100 },
      { x1: 200, x2: 250, y: 100 }, // gleiche y, aber x-Bereiche überschneiden sich nicht
    ];
    expect(resolveLabelPlacements(labels, 15)).toEqual([100, 100]);
  });

  it("schiebt ein zweites Label mit überlappendem x-Bereich vertikal weg (erstes bleibt an Ort und Stelle)", () => {
    const labels = [
      { x1: 0, x2: 50, y: 100 },
      { x1: 10, x2: 60, y: 100 }, // x überschneidet sich mit dem ersten, exakt gleiche y
    ];
    const result = resolveLabelPlacements(labels, 15);
    expect(result[0]).toBe(100);
    expect(result[1]).not.toBe(100);
    expect(Math.abs(result[1] - 100)).toBeGreaterThanOrEqual(15);
  });

  it("stapelt mehr als zwei kollidierende Labels ohne dass sich je zwei überlappen", () => {
    const labels = [
      { x1: 0, x2: 50, y: 100 },
      { x1: 0, x2: 50, y: 100 },
      { x1: 0, x2: 50, y: 100 },
      { x1: 0, x2: 50, y: 100 },
    ];
    const result = resolveLabelPlacements(labels, 15);
    // Jedes Paar muss mindestens lineHeight (15) auseinander liegen, da x-Bereiche identisch sind.
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        expect(Math.abs(result[i] - result[j])).toBeGreaterThanOrEqual(15);
      }
    }
  });

  it("lässt Labels an unterschiedlichen Preis-Levels (großer y-Abstand) unverändert, auch bei gleichem x-Bereich", () => {
    const labels = [
      { x1: 0, x2: 50, y: 100 },
      { x1: 0, x2: 50, y: 500 },
    ];
    expect(resolveLabelPlacements(labels, 15)).toEqual([100, 500]);
  });
});

// Feature 2026-07-30 "Zeiger-Linien" (TSC-Callouts, PriceChart.vue): annotationAnchorPoint liefert
// den Chart-Punkt, auf den die Verbindungslinie vom außerhalb des Canvas liegenden Label zeigt.
describe("annotationAnchorPoint", () => {
  it("liefert den Punkt selbst für marker/label", () => {
    const ann = { type: "marker", time: "09:00", price: 1.5 };
    expect(annotationAnchorPoint(fakeChart(), fakeSeries(), CANDLES, DATE, ann)).toEqual({
      x: CANDLES[1].time,
      y: 150,
    });
  });

  it("liefert den Mittelpunkt für line (Zeit UND Preis gemittelt)", () => {
    const ann = { type: "line", from: { time: "08:00", price: 1.0 }, to: { time: "10:00", price: 2.0 } };
    expect(annotationAnchorPoint(fakeChart(), fakeSeries(), CANDLES, DATE, ann)).toEqual({
      x: (CANDLES[0].time + CANDLES[2].time) / 2,
      y: 150, // (100 + 200) / 2
    });
  });

  it("gibt null zurück, wenn keine Kerzen geladen sind (resolveTime kann nicht auflösen)", () => {
    const ann = { type: "marker", time: "09:00", price: 1.5 };
    expect(annotationAnchorPoint(fakeChart(), fakeSeries(), [], DATE, ann)).toBeNull();
  });

  it("gibt null zurück, wenn der Preis gerade außerhalb der sichtbaren Preisachse liegt", () => {
    const outOfRangeSeries = { priceToCoordinate: () => null };
    const ann = { type: "marker", time: "09:00", price: 1.5 };
    expect(annotationAnchorPoint(fakeChart(), outOfRangeSeries, CANDLES, DATE, ann)).toBeNull();
  });

  it("gibt null zurück, wenn bei einer line nur ein Endpunkt außerhalb der Preisachse liegt", () => {
    const partialSeries = { priceToCoordinate: (p) => (p === 2.0 ? null : p * 100) };
    const ann = { type: "line", from: { time: "08:00", price: 1.0 }, to: { time: "10:00", price: 2.0 } };
    expect(annotationAnchorPoint(fakeChart(), partialSeries, CANDLES, DATE, ann)).toBeNull();
  });
});
