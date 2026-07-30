// Feature-Erweiterung 2026-07-30: Claude-Notizen-Import unterstützt jetzt optionale Farben pro
// Annotation sowie mehrere Zeichnungs-Gruppen in einem Paste ({"drawings":[{title,annotations}]}).
// parseAnnotations gibt seit dieser Erweiterung immer eine Liste von Gruppen zurück (auch fürs
// alte, flache Format — dann genau eine Gruppe mit title: null).
import { describe, expect, it } from "vitest";
import { parseAnnotations } from "../src/claudeAnnotations.js";

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
