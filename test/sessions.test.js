// Feature-Wunsch Philip 2026-07-22: "Sessions-Indikator, mehrere Sessions, von-bis Zeitangabe
// halbstunde genau, Hintergrundfarbe + Label, hinzufügen/editieren/löschen". sessionOccurrences ist
// die testbare Kernlogik dahinter — berechnet, an welchen Tagen/Zeitpunkten eine täglich
// wiederkehrende Session innerhalb eines gegebenen Kerzenfensters tatsächlich auftaucht.
import { describe, expect, it } from "vitest";
import { sessionOccurrences, highLowInWindow } from "../src/sessions.js";

const DAY = 24 * 3600;

describe("sessionOccurrences", () => {
  it("findet ein einzelnes Vorkommen innerhalb eines Ein-Tages-Fensters (UTC, kein Offset)", () => {
    const dayStart = Date.UTC(2026, 6, 6, 0, 0, 0) / 1000; // Montag 06.07.2026 00:00 UTC
    const result = sessionOccurrences(9 * 60, 17 * 60, dayStart, dayStart + DAY, 0);
    expect(result).toEqual([{ startSec: dayStart + 9 * 3600, endSec: dayStart + 17 * 3600 }]);
  });

  it("findet ein Vorkommen pro Tag über mehrere Tage hinweg", () => {
    const dayStart = Date.UTC(2026, 6, 6, 0, 0, 0) / 1000;
    const result = sessionOccurrences(9 * 60, 17 * 60, dayStart, dayStart + 3 * DAY, 0);
    expect(result).toHaveLength(3);
    expect(result[0].startSec).toBe(dayStart + 9 * 3600);
    expect(result[1].startSec).toBe(dayStart + DAY + 9 * 3600);
    expect(result[2].startSec).toBe(dayStart + 2 * DAY + 9 * 3600);
  });

  it("behandelt eine über Mitternacht laufende Session korrekt (toMinutes <= fromMinutes)", () => {
    const dayStart = Date.UTC(2026, 6, 6, 0, 0, 0) / 1000;
    // 22:00 bis 06:00 (nächster Tag) — Sydney-artige Session. Ein Ein-Tages-Fenster überlappt dabei
    // ZWEI Vorkommen: das Ende der Session vom VORTAG (die bis 06:00 in dieses Fenster hineinreicht)
    // und den Anfang der Session von HEUTE (die erst 22:00 beginnt, aber noch bis Fenster-Ende läuft).
    const result = sessionOccurrences(22 * 60, 6 * 60, dayStart, dayStart + DAY, 0);
    expect(result).toContainEqual({ startSec: dayStart - 2 * 3600, endSec: dayStart + 6 * 3600 }); // Vortag, endet 06:00 heute
    expect(result).toContainEqual({ startSec: dayStart + 22 * 3600, endSec: dayStart + DAY + 6 * 3600 }); // heute, endet 06:00 morgen
  });

  it("verschiebt Vorkommen um den angegebenen Zeitzonen-Offset (lokale statt UTC-Tagesgrenze)", () => {
    // tzOffsetMinutes=+120 (z.B. CEST): 09:00 lokal = 07:00 UTC.
    const dayStart = Date.UTC(2026, 6, 6, 0, 0, 0) / 1000; // 06.07. 00:00 UTC
    const result = sessionOccurrences(9 * 60, 17 * 60, dayStart, dayStart + DAY, 120);
    // Lokaler Tag beginnt bei UTC 06.07. 00:00 - 2h = 05.07. 22:00 UTC -> Session-Start (lokal 09:00)
    // liegt bei UTC 05.07. 22:00 + 9h = 07:00 UTC — VOR dem angefragten Fenster, wird also nicht
    // zurückgegeben; das nächste (lokale) Vorkommen am 06.07. liegt bei UTC 06.07. 07:00.
    expect(result).toContainEqual({ startSec: Date.UTC(2026, 6, 6, 7, 0, 0) / 1000, endSec: Date.UTC(2026, 6, 6, 15, 0, 0) / 1000 });
  });

  it("lässt ein Vorkommen weg, das komplett außerhalb des Fensters liegt", () => {
    const dayStart = Date.UTC(2026, 6, 6, 0, 0, 0) / 1000;
    // Fenster deckt nur 00:00-06:00 ab, Session ist 09:00-17:00 -> kein Treffer an diesem Tag.
    const result = sessionOccurrences(9 * 60, 17 * 60, dayStart, dayStart + 6 * 3600, 0);
    expect(result).toEqual([]);
  });

  it("gibt ein leeres Array für ein leeres oder rückwärts laufendes Fenster zurück", () => {
    expect(sessionOccurrences(9 * 60, 17 * 60, 1000, 1000, 0)).toEqual([]);
    expect(sessionOccurrences(9 * 60, 17 * 60, 2000, 1000, 0)).toEqual([]);
    expect(sessionOccurrences(9 * 60, 17 * 60, null, 1000, 0)).toEqual([]);
  });
});

// Bug-Report Philip 2026-07-22: "prüf ob die sessions auch mit der Zeitumstellung einwandfrei
// funktionieren, wohne ja in Deutschland" — vorher wurde EIN fester "jetzt"-Offset auf den
// GESAMTEN Kerzenbereich angewendet (der per Lazy-Load Monate zurückreichen kann), was Sessions auf
// der anderen Seite einer echten Sommer-/Winterzeit-Umstellung um eine Stunde verschoben hätte.
// tzOffsetMinutes als Funktion (utcSec) => Offset simuliert hier die deutsche DST-Umstellung
// (29.03.2026, CET +60min -> CEST +120min), ohne von der echten Systemzeitzone der Testmaschine
// abzuhängen.
describe("sessionOccurrences mit Zeitumstellung (variabler Offset pro Tag)", () => {
  it("wendet den zum jeweiligen TAG gültigen Offset an, nicht einen einzigen für den ganzen Bereich", () => {
    const transitionUtc = Date.UTC(2026, 2, 29, 1, 0, 0) / 1000; // 29.03.2026, ~Umstellungszeitpunkt
    const offsetFn = (utcSec) => (utcSec < transitionUtc ? 60 : 120); // CET (+1h) -> CEST (+2h)

    const dayBeforeStart = Date.UTC(2026, 2, 28, 0, 0, 0) / 1000; // 28.03., noch CET
    const dayAfterStart = Date.UTC(2026, 2, 30, 0, 0, 0) / 1000; // 30.03., schon CEST
    const result = sessionOccurrences(9 * 60, 17 * 60, dayBeforeStart, dayAfterStart + DAY, offsetFn);

    // 28.03. (CET, UTC+1): lokal 09:00-17:00 = 08:00-16:00 UTC
    expect(result).toContainEqual({ startSec: Date.UTC(2026, 2, 28, 8, 0, 0) / 1000, endSec: Date.UTC(2026, 2, 28, 16, 0, 0) / 1000 });
    // 30.03. (CEST, UTC+2): lokal 09:00-17:00 = 07:00-15:00 UTC — eine Stunde FRÜHER in UTC als am
    // 28.03., genau der Unterschied, den ein fixer Offset für den ganzen Bereich verpasst hätte.
    expect(result).toContainEqual({ startSec: Date.UTC(2026, 2, 30, 7, 0, 0) / 1000, endSec: Date.UTC(2026, 2, 30, 15, 0, 0) / 1000 });
  });

  it("verhält sich bei konstantem Offset (Funktion, die immer denselben Wert liefert) identisch zur Zahl-Variante", () => {
    const dayStart = Date.UTC(2026, 6, 6, 0, 0, 0) / 1000;
    const asNumber = sessionOccurrences(9 * 60, 17 * 60, dayStart, dayStart + 3 * DAY, 120);
    const asFunction = sessionOccurrences(9 * 60, 17 * 60, dayStart, dayStart + 3 * DAY, () => 120);
    expect(asFunction).toEqual(asNumber);
  });
});

// Feature-Wunsch Philip 2026-07-22: "die session box soll dann nur bis zum high und low gezeichnet
// werden ... nicht über die gesamte vertikale fläche" — highLowInWindow liefert die dafür nötigen
// Grenzwerte aus den Kerzen, die tatsächlich im Session-Zeitfenster liegen.
describe("highLowInWindow", () => {
  const candles = [
    { time: 0, high: 100, low: 90 },
    { time: 100, high: 110, low: 95 }, // höchstes High im Fenster
    { time: 200, high: 105, low: 85 }, // tiefstes Low im Fenster
    { time: 300, high: 999, low: 999 }, // außerhalb (endSec exklusiv)
  ];

  it("findet High/Low nur unter den Kerzen im Fenster [startSec, endSec)", () => {
    expect(highLowInWindow(candles, 100, 300)).toEqual({ high: 110, low: 85 });
  });

  it("schließt die Kerze bei endSec selbst aus (Fenster ist [start, end))", () => {
    expect(highLowInWindow(candles, 0, 100)).toEqual({ high: 100, low: 90 });
  });

  it("gibt null zurück, wenn keine Kerze im Fenster liegt", () => {
    expect(highLowInWindow(candles, 1000, 2000)).toBeNull();
    expect(highLowInWindow([], 0, 100)).toBeNull();
  });
});
