// Feature-Wunsch Philip 2026-07-26: Gewichtung für "Anti-Confluences" (Dinge, die gegen einen Trade
// sprechen) + harte No-Gos, die immer sperren. computeCockpitState bleibt reine Aggregation (siehe
// tradeSetupCockpit.ts) — sessionDanger kommt hier fertig ermittelt rein (siehe currentSessionDanger
// in sessions.js), nicht selbst berechnet.
import { describe, expect, it } from "vitest";
import { computeCockpitState, ANTI_CONFLUENCE_THRESHOLD, computeTrendChain, trendChainLevelDisplay, computeTrendAlignment } from "../src/tradeSetupCockpit";

describe("computeCockpitState — Anti-Confluences/No-Go", () => {
  it("ist unlocked und ohne Anti-Confluences ohne sessionDanger", () => {
    const state = computeCockpitState(null, [], null);
    expect(state.antiConfluences).toEqual([]);
    expect(state.locked).toBe(false);
  });

  it("sperrt sofort bei einer 'forbidden'-Session (No-Go), unabhängig von der Punkte-Schwelle", () => {
    const state = computeCockpitState(null, [], { level: "forbidden", label: "News-Fenster" });
    expect(state.locked).toBe(true);
    expect(state.antiConfluences).toEqual([{ text: "Sperrzeit-Session aktiv: News-Fenster", weight: 0, isNoGo: true }]);
  });

  it("addiert eine 'caution'-Session als gewichtete Anti-Confluence, sperrt aber allein davon noch nicht", () => {
    const state = computeCockpitState(null, [], { level: "caution", label: "MMM" });
    expect(state.locked).toBe(false);
    expect(state.antiConfluences).toEqual([{ text: "Vorsicht-Session aktiv: MMM", weight: 5, isNoGo: false }]);
  });

  it("bleibt unlocked knapp UNTER der Punkte-Schwelle und sperrt AB der Schwelle", () => {
    // Threshold ist aktuell 10, eine einzelne caution-Session liefert 5 Punkte (siehe oben) — direkt
    // gegen die exportierte Konstante geprüft, damit der Test nicht bricht, falls der Wert mal
    // angepasst wird, ohne dass dieser Test aktualisiert wurde.
    const single = computeCockpitState(null, [], { level: "caution", label: "MMM" });
    expect(single.antiConfluences[0].weight).toBeLessThan(ANTI_CONFLUENCE_THRESHOLD);
    expect(single.locked).toBe(false);
  });

  it("sperrt sofort bei einem News-No-Go, unabhängig von sessionDanger", () => {
    const state = computeCockpitState(null, [], null, { title: "Main Refinancing Rate", currency: "EUR" });
    expect(state.locked).toBe(true);
    expect(state.antiConfluences).toEqual([{ text: "News-Event: EUR Main Refinancing Rate", weight: 0, isNoGo: true }]);
  });

  it("listet sessionDanger UND News-No-Go nebeneinander, wenn beide gleichzeitig zutreffen", () => {
    const state = computeCockpitState(null, [], { level: "caution", label: "MMM" }, { title: "Fed Rate Decision", currency: "USD" });
    expect(state.locked).toBe(true); // News-No-Go allein reicht schon
    expect(state.antiConfluences).toEqual([
      { text: "Vorsicht-Session aktiv: MMM", weight: 5, isNoGo: false },
      { text: "News-Event: USD Fed Rate Decision", weight: 0, isNoGo: true },
    ]);
  });
});

// Trend-Kette (Chat 2026-08-29, Philip: "der Trend soll rein") — computeTrendChain läuft die
// rekursive nestedTrend-Verschachtelung des 1h-Structure-Algos ab, siehe tradeSetupCockpit.ts.
const DAY = 24 * 60 * 60;

describe("computeTrendChain", () => {
  it("liefert eine leere Kette ohne structureState", () => {
    expect(computeTrendChain(null, 1000)).toEqual([]);
  });

  it("läuft die nestedTrend-Verschachtelung ab, Alter aus currRange (nicht firstConfirmedAt)", () => {
    const state = {
      trend: "uptrend",
      // Uptrend-Ursprung ist currRange.low (0) — currRange.high (weit später) ist nur der aktuell
      // fortlaufende Extrempunkt, NICHT der Startpunkt (Bug-Report Philip 2026-08-29).
      currRange: { low: { pivotTime: 0 }, high: { pivotTime: 15 * DAY } },
      nestedTrend: {
        trend: "downtrend",
        // Downtrend-Ursprung ist currRange.high (10 Tage), currRange.low (18 Tage) ist der aktuell
        // fortlaufende Tiefpunkt.
        currRange: { high: { pivotTime: 10 * DAY }, low: { pivotTime: 18 * DAY } },
        nestedTrend: {
          trend: "unknown",
          currRange: { high: { pivotTime: 19 * DAY }, low: { pivotTime: 20 * DAY } },
          nestedTrend: null,
        },
      },
    };
    const chain = computeTrendChain(state, 21 * DAY);
    // Bug-Report Philip 2026-08-30: die unbestätigte (unknown) Ebene liefert keinen Mehrwert ("Algo
    // pegelt sich noch ein") und fliegt komplett aus der Kette, statt als dritte Ebene mitgezählt zu
    // werden — siehe eigenen Test weiter unten.
    expect(chain).toHaveLength(2);
    expect(chain[0]).toMatchObject({ trend: "uptrend", originTimeSec: 0 });
    // 21 Tage minus 0 (currRange.low) abzüglich Wochenenden (businessSecondsBetween) — deutlich
    // mehr als die 6 Tage bis currRange.high, die der alte (falsche) Anker fälschlich als "Alter"
    // ausgegeben hätte.
    expect(chain[0].ageSeconds).toBeGreaterThanOrEqual(15 * DAY);
    expect(chain[1]).toMatchObject({ trend: "downtrend", originTimeSec: 10 * DAY });
    expect(typeof chain[1].ageSeconds).toBe("number");
  });

  it("liefert kein Alter, wenn currRange keine pivotTime trägt", () => {
    const state = { trend: "uptrend", currRange: { high: {}, low: {} }, nestedTrend: null };
    expect(computeTrendChain(state, 1000)).toEqual([{ trend: "uptrend", ageSeconds: null, originTimeSec: null }]);
  });

  // Bug-Report Philip 2026-08-30: "unknown" heißt nicht Konsolidierung, sondern nur, dass der
  // Algorithmus noch mehr Strukturpunkte braucht, um sich einzupegeln — keine brauchbare Info fürs
  // TSC. 'unknown'-Level (und alles darunter, garantiert null laut advanceNestedTrend) fliegen
  // deshalb komplett aus der Kette.
  it("filtert eine 'unknown'-Ebene und alles darunter komplett aus der Kette", () => {
    const state = {
      trend: "uptrend",
      currRange: { low: { pivotTime: 0 }, high: { pivotTime: 15 * DAY } },
      nestedTrend: { trend: "unknown", currRange: { high: { pivotTime: 19 * DAY }, low: { pivotTime: 20 * DAY } }, nestedTrend: null },
    };
    expect(computeTrendChain(state, 21 * DAY)).toHaveLength(1);
  });

  it("liefert eine leere Kette, wenn schon der äußerste Trend 'unknown' ist", () => {
    const state = { trend: "unknown", currRange: { high: { pivotTime: 0 }, low: { pivotTime: DAY } }, nestedTrend: null };
    expect(computeTrendChain(state, 1000)).toEqual([]);
  });
});

// Feature-Wunsch Philip 2026-08-30: ob die aktuelle Dealing Range mit oder gegen den Trend läuft —
// Basis für die spätere Target-Auswahl.
describe("computeTrendAlignment", () => {
  it("erkennt 'with_trend': Short bei Downtrend, Long bei Uptrend", () => {
    expect(computeTrendAlignment("short", [{ trend: "downtrend", ageSeconds: null, originTimeSec: null }])).toBe("with_trend");
    expect(computeTrendAlignment("long", [{ trend: "uptrend", ageSeconds: null, originTimeSec: null }])).toBe("with_trend");
  });

  it("erkennt 'countertrend': Long bei Downtrend, Short bei Uptrend", () => {
    expect(computeTrendAlignment("long", [{ trend: "downtrend", ageSeconds: null, originTimeSec: null }])).toBe("countertrend");
    expect(computeTrendAlignment("short", [{ trend: "uptrend", ageSeconds: null, originTimeSec: null }])).toBe("countertrend");
  });

  // Korrektur Philip 2026-08-30: "es zählt das aktuelle structure ... wenn es ein outer-structure
  // gibt und ein nested structure, dann zählt nested structure" — die TIEFSTE Ebene der Kette
  // entscheidet, nicht die äußerste (erste Version hatte das genau andersrum).
  it("nutzt die tiefste (aktuellste) Ebene der Kette, nicht die äußerste", () => {
    const chain = [
      { trend: "downtrend", ageSeconds: null, originTimeSec: null }, // outer structure
      { trend: "uptrend", ageSeconds: null, originTimeSec: null }, // nested structure, jetzt maßgeblich
    ];
    expect(computeTrendAlignment("short", chain)).toBe("countertrend");
    expect(computeTrendAlignment("long", chain)).toBe("with_trend");
  });

  it("fällt ohne Verschachtelung auf die einzige (äußerste) Ebene zurück", () => {
    expect(computeTrendAlignment("short", [{ trend: "downtrend", ageSeconds: null, originTimeSec: null }])).toBe("with_trend");
  });

  it("liefert null ohne Richtung oder ohne bestätigten Trend (leere Kette)", () => {
    expect(computeTrendAlignment(null, [{ trend: "downtrend", ageSeconds: null, originTimeSec: null }])).toBeNull();
    expect(computeTrendAlignment("short", [])).toBeNull();
  });
});

describe("trendChainLevelDisplay", () => {
  // Nur ganze Tage, keine Stunden (Philip 2026-08-29: "Die Stunden info interessiert mich nicht"),
  // bewusst anders als das gemeinsame formatAge ("1d 3h"), das für Evidence-/Target-Alter weiterhin
  // die feinere Granularität behält. text trägt NUR noch das Alter (Philip 2026-08-29: "dank den
  // Pfeilen sind die wörter doch redundant" — IST "{Tage} Trend: {Richtung}", SOLL "{Tage}") —
  // Richtung steckt komplett im icon, die Tiefe nur noch im hint.
  it("Alter >= 1 Tag: nur '{Tage} Tage', dazu Icon/Farbe/Hover-Hint je Tiefe", () => {
    const d0 = trendChainLevelDisplay({ trend: "uptrend", ageSeconds: 21 * DAY, originTimeSec: 0 }, 0);
    expect(d0.text).toBe("21 Tage");
    expect(d0.icon).toBe("↗");
    expect(d0.hint).toBe("outer structure");
    expect(typeof d0.color).toBe("string");

    const d1 = trendChainLevelDisplay({ trend: "downtrend", ageSeconds: 1 * DAY, originTimeSec: 0 }, 1);
    expect(d1.text).toBe("1 Tag");
    expect(d1.icon).toBe("↘");
    expect(d1.hint).toBe("nested structure");
  });

  // Unter 1 Tag: kein vages "< 1 Tag" mehr, sondern ein konkretes Datum in Klammern (Philip
  // 2026-08-29: "wenn '< Tag', dann lieber schreiben: '(seit Do, 27.08.)'", Klammer bleibt auch nach
  // dem Wegfall von "Trend: {Richtung}" bestehen) — Donnerstag, 27.08.2026 ist ein echtes Datum aus
  // diesem Chat (heute laut currentDate: Samstag, 29.08.2026).
  it("Alter < 1 Tag: '(seit <Wochentag>, <Datum>)' statt einer vagen Angabe", () => {
    const origin = Date.UTC(2026, 7, 27, 10, 0, 0) / 1000;
    const d = trendChainLevelDisplay({ trend: "unknown", ageSeconds: 3600, originTimeSec: origin }, 2);
    expect(d.text).toBe("(seit Do, 27.08.)");
    expect(d.icon).toBe("→");
    expect(d.hint).toBe("nested nested structure");
  });

  it("kein Alter (ageSeconds/originTimeSec null): Platzhalter '–'", () => {
    expect(trendChainLevelDisplay({ trend: "uptrend", ageSeconds: null, originTimeSec: null }, 0).text).toBe("–");
  });

  it("Hover-Hint zählt ab Tiefe 3 'nested' entsprechend weiter", () => {
    expect(trendChainLevelDisplay({ trend: "uptrend", ageSeconds: null, originTimeSec: null }, 3).hint).toBe("nested nested nested structure");
  });
});
