// Feature-Wunsch Philip 2026-07-22: "Sessions-Indikator, mehrere Sessions, von-bis Zeitangabe
// halbstunde genau, Hintergrundfarbe + Label, hinzufügen/editieren/löschen". sessionOccurrences ist
// die testbare Kernlogik dahinter — berechnet, an welchen Tagen/Zeitpunkten eine täglich
// wiederkehrende Session innerhalb eines gegebenen Kerzenfensters tatsächlich auftaucht.
import { describe, expect, it } from "vitest";
import { sessionOccurrences, highLowInWindow, currentSessionDanger, isForbiddenAt } from "../src/sessions.js";

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

// Bug-Report Philip 2026-07-26: "am WE werden mir Session-Indikatoren angezeigt, die spielen aber
// überhaupt keine Rolle" — days schränkt ein, an welchen (lokalen) Wochentagen eine Session
// überhaupt startet (0=So..6=Sa, wie Date#getDay()), z.B. Mo-Fr für normale Forex-Sessions.
describe("sessionOccurrences mit days (Wochentag-Filter)", () => {
  it("lässt Vorkommen an nicht erlaubten Wochentagen weg (Mo-Fr, kein Sa/So)", () => {
    // 04.07.2026 ist ein Samstag, 06./07.07. Mo/Di.
    const saturdayStart = Date.UTC(2026, 6, 4, 0, 0, 0) / 1000;
    const result = sessionOccurrences(9 * 60, 17 * 60, saturdayStart, saturdayStart + 4 * DAY, 0, [1, 2, 3, 4, 5]);
    expect(result).toHaveLength(2); // nur Mo 06.07./Di 07.07., nicht Sa 04.07./So 05.07.
    expect(result[0].startSec).toBe(Date.UTC(2026, 6, 6, 9, 0, 0) / 1000);
    expect(result[1].startSec).toBe(Date.UTC(2026, 6, 7, 9, 0, 0) / 1000);
  });

  it("null/undefined bedeutet weiterhin 'jeden Tag' (Altverhalten für Sessions ohne days)", () => {
    const dayStart = Date.UTC(2026, 6, 6, 0, 0, 0) / 1000;
    const withoutDays = sessionOccurrences(9 * 60, 17 * 60, dayStart, dayStart + 3 * DAY, 0);
    const withNullDays = sessionOccurrences(9 * 60, 17 * 60, dayStart, dayStart + 3 * DAY, 0, null);
    expect(withNullDays).toEqual(withoutDays);
    expect(withNullDays).toHaveLength(3);
  });

  it("berechnet eine Mehrtages-Session (Weekend Gap Fr 23:00 - So 23:00) über to_minutes > 1440", () => {
    // 03.07.2026 ist ein Freitag.
    const fridayStart = Date.UTC(2026, 6, 3, 0, 0, 0) / 1000;
    const result = sessionOccurrences(23 * 60, 23 * 60 + 48 * 60, fridayStart, fridayStart + 4 * DAY, 0, [5]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      startSec: Date.UTC(2026, 6, 3, 23, 0, 0) / 1000, // Fr 23:00
      endSec: Date.UTC(2026, 6, 5, 23, 0, 0) / 1000, // So 23:00 (48h später)
    });
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

// Feature-Wunsch Philip 2026-07-26: sessions.danger ("normal"/"caution"/"forbidden") war bisher rein
// visuell (siehe DANGER_LEVELS) — currentSessionDanger ist die erste Stelle, die es tatsächlich für
// eine Entscheidung (TSC-No-Go/Anti-Confluence) konsumiert, siehe computeCockpitState in
// tradeSetupCockpit.ts.
describe("currentSessionDanger", () => {
  const dayStart = Date.UTC(2026, 6, 6, 0, 0, 0) / 1000; // Montag 06.07.2026 00:00 UTC
  const noon = dayStart + 12 * 3600;

  it("gibt null zurück, wenn keine Session gerade aktiv ist", () => {
    const config = [{ fromMinutes: 9 * 60, toMinutes: 17 * 60, danger: "forbidden", label: "Sperrzeit" }];
    expect(currentSessionDanger(config, dayStart + 20 * 3600, 0)).toBeNull(); // 20:00, Session ist 09-17 Uhr
  });

  it("gibt null zurück für eine aktive Session mit danger='normal'", () => {
    const config = [{ fromMinutes: 9 * 60, toMinutes: 17 * 60, danger: "normal", label: "Normal" }];
    expect(currentSessionDanger(config, noon, 0)).toBeNull();
  });

  it("findet eine aktive 'forbidden'-Session", () => {
    const config = [{ fromMinutes: 9 * 60, toMinutes: 17 * 60, danger: "forbidden", label: "Sperrzeit" }];
    expect(currentSessionDanger(config, noon, 0)).toEqual({ level: "forbidden", label: "Sperrzeit" });
  });

  it("findet eine aktive 'caution'-Session", () => {
    const config = [{ fromMinutes: 9 * 60, toMinutes: 17 * 60, danger: "caution", label: "MMM" }];
    expect(currentSessionDanger(config, noon, 0)).toEqual({ level: "caution", label: "MMM" });
  });

  it("nimmt bei mehreren gleichzeitig aktiven Sessions die schwerwiegendere ('forbidden' schlägt 'caution')", () => {
    const config = [
      { fromMinutes: 8 * 60, toMinutes: 18 * 60, danger: "caution", label: "Weite Caution-Session" },
      { fromMinutes: 11 * 60, toMinutes: 13 * 60, danger: "forbidden", label: "Enge Sperrzeit" },
    ];
    expect(currentSessionDanger(config, noon, 0)).toEqual({ level: "forbidden", label: "Enge Sperrzeit" });
  });

  it("ignoriert Sessions eines anderen Instruments nicht selbst — Aufrufer muss vorher filtern", () => {
    // currentSessionDanger bekommt bereits gefilterte Configs (siehe PriceChart.vue,
    // `sessions.filter((s) => s.instrument === props.symbol)`) — hier nur der Beleg, dass eine
    // leere Liste (z.B. nach dem Filtern) korrekt null liefert, kein Crash.
    expect(currentSessionDanger([], noon, 0)).toBeNull();
  });
});

// Bug-Report/Feature-Wunsch Philip 2026-07-29: "meine Regel, wann ich niemals einen Trade setze"
// (Asia/Spread Hour) soll Trade-Setups direkt rausfiltern, nicht nur als TSC-No-Go warnen — siehe
// isForbiddenAt/computeTradeSetups in PriceChart.vue. EURUSD_SESSIONS ist Philips tatsächliche
// Live-Konfiguration (aus der `sessions`-Tabelle gelesen, Stand 2026-07-29), nicht erfunden.
describe("isForbiddenAt", () => {
  const monday = Date.UTC(2026, 6, 6, 0, 0, 0) / 1000; // Montag 06.07.2026 00:00 UTC
  const saturday = monday + 5 * 86400; // Samstag derselben Woche

  const EURUSD_SESSIONS = [
    { label: "Spread Hour", fromMinutes: 1380, toMinutes: 0, danger: "forbidden", days: [1, 2, 3, 4, 5] },
    { label: "Asia", fromMinutes: 0, toMinutes: 420, danger: "forbidden", days: [1, 2, 3, 4, 5] },
    { label: "MMM", fromMinutes: 630, toMinutes: 780, danger: "caution", days: [1, 2, 3, 4, 5] },
    { label: "NY", fromMinutes: 840, toMinutes: 1320, danger: "normal", days: [1, 2, 3, 4, 5] },
  ];

  it("Asia (00:00-07:00) ist forbidden", () => {
    expect(isForbiddenAt(EURUSD_SESSIONS, monday + 3 * 3600, 0)).toBe(true);
  });

  it("Spread Hour (23:00-24:00) ist forbidden", () => {
    expect(isForbiddenAt(EURUSD_SESSIONS, monday + 23.5 * 3600, 0)).toBe(true);
  });

  it("MMM ist 'caution', nicht 'forbidden' — zählt hier nicht als Sperrzeit", () => {
    expect(isForbiddenAt(EURUSD_SESSIONS, monday + 11 * 3600, 0)).toBe(false);
  });

  it("NY (danger='normal') ist nicht forbidden", () => {
    expect(isForbiddenAt(EURUSD_SESSIONS, monday + 15 * 3600, 0)).toBe(false);
  });

  it("Asia gilt nur Mo-Fr (days) — samstags nicht forbidden", () => {
    expect(isForbiddenAt(EURUSD_SESSIONS, saturday + 3 * 3600, 0)).toBe(false);
  });
});
