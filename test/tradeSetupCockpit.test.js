// Feature-Wunsch Philip 2026-07-26: Gewichtung für "Anti-Confluences" (Dinge, die gegen einen Trade
// sprechen) + harte No-Gos, die immer sperren. computeCockpitState bleibt reine Aggregation (siehe
// tradeSetupCockpit.ts) — sessionDanger kommt hier fertig ermittelt rein (siehe currentSessionDanger
// in sessions.js), nicht selbst berechnet.
import { describe, expect, it } from "vitest";
import { computeCockpitState, ANTI_CONFLUENCE_THRESHOLD } from "../src/tradeSetupCockpit";

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
