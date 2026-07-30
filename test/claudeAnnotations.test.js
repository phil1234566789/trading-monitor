// Feature-Erweiterung 2026-07-30: Claude-Notizen-Import unterstützt jetzt optionale Farben pro
// Annotation sowie mehrere Zeichnungs-Gruppen in einem Paste ({"drawings":[{title,annotations}]}).
// parseAnnotations gibt seit dieser Erweiterung immer eine Liste von Gruppen zurück (auch fürs
// alte, flache Format — dann genau eine Gruppe mit title: null).
import { describe, expect, it } from "vitest";
import { parseAnnotations, resolveLabelPlacements } from "../src/claudeAnnotations.js";

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
