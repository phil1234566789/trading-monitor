// Bug-Report Philip 2026-07-20 (Debug-Metadaten-Copy, GBPUSD 1h): das ermittelte protected-low war
// längst unterschritten (getouched + weitere, tiefere Pivots danach) — trotzdem blieb der Chart bei
// "uptrend" mit einem stehengebliebenen protected-low. Beim Nachvollziehen (siehe
// test/tdd_mit_claude/ranges/gbp_h1_uptrend_protected_low_gebrochen.ts) stellte sich raus: DAS war
// noch nicht mal der eigentliche Bug — die Pullback-AUSWAHL selbst bei der Trendbestätigung war
// schon falsch. tryConfirmUptrend wählte den zeitlich jüngsten Pullback mit type==='low', OHNE zu
// prüfen, ob der zum Bestätigungszeitpunkt selbst schon (durch einen SPÄTER passierenden, aber
// GLOBAL schon bekannten Touch) getoucht war, und OHNE bereits zu 'LQ-sweep' reklassifizierte
// Pullbacks überhaupt in Betracht zu ziehen (obwohl deren Touch zeitlich erst NACH der Bestätigung
// liegen kann, siehe isUntouchedAsOf in marketStructureAnalysis.ts).
import { describe, expect, it } from "vitest";
import { initMarketStructureState, applyMarketStructurePivot, applyInnerMarketStructurePivot } from "../src/marketStructureAnalysis";

describe("marketStructureAnalysis: zeitbewusste Pullback-Auswahl für protected-low (tryConfirmUptrend)", () => {
  it("ein Pullback, der schon VOR dem Bestätigungsmoment getoucht wurde, scheidet aus — der jüngste der verbleibenden UNGETOUCHTEN gewinnt", () => {
    const originLow = { type: "low", price: 1.0, pivotAt: "lo", pivotTime: 0, touched: false };
    const originHigh = { type: "high", price: 1.1, pivotAt: "hi", pivotTime: 10, touched: false };
    // schon getoucht, BEVOR der Bestätigungspivot (t=40) überhaupt gelesen wird -> darf nicht gewinnen
    const touchedEarly = { type: "low", price: 1.05, pivotAt: "A", pivotTime: 15, touched: { price: 1.05, touchedAt: "x", touchedTime: 18 } };
    // älterer, aber komplett ungetouchter Pullback -> qualifiziert, ist aber NICHT der jüngste
    const untouchedOlder = { type: "low", price: 1.03, pivotAt: "C", pivotTime: 20, touched: false };
    // jüngerer Pullback, dessen Touch erst NACH dem Bestätigungsmoment (t=40) passiert -> zum
    // Bestätigungszeitpunkt selbst noch ungetoucht, UND der jüngste der qualifizierenden -> gewinnt
    const untouchedAtConfirmation = { type: "low", price: 1.02, pivotAt: "B", pivotTime: 30, touched: { price: 1.02, touchedAt: "y", touchedTime: 999 } };
    const breakingPivot = { type: "high", price: 1.2, pivotAt: "break", pivotTime: 40, touched: false };

    let state = initMarketStructureState(originLow, originHigh);
    for (const p of [touchedEarly, untouchedOlder, untouchedAtConfirmation, breakingPivot]) {
      state = applyMarketStructurePivot(state, p);
    }

    expect(state.trend).toBe("uptrend");
    const protectedLow = state.structurePivots.find((p) => p.type === "protected-low");
    expect(protectedLow?.pivotAt).toBe("B");
    // beide anderen bleiben unverändert 'low', keiner davon wird protected-low
    expect(state.structurePivots.filter((p) => p.type === "low")).toHaveLength(2);
  });

  it("ein bereits zu 'LQ-sweep' reklassifizierter Pullback kann trotzdem protected-low werden, wenn er zum Bestätigungsmoment noch ungetoucht ist", () => {
    // sweepCandidate kommt als ÜBERGEORDNETER (Periode-5-)Pivot rein (landet direkt in
    // structurePivots, siehe applyMarketStructurePivot) — genau wie pivot9/1.33286 im echten
    // Bug-Report: ein outer-Pivot, der SPÄTER von markLqSweeps (ausgelöst durch einen NACHFOLGENDEN
    // eingebetteten Pivot) zu 'LQ-sweep' reklassifiziert wird.
    const originLow = { type: "low", price: 1.0, pivotAt: "lo", pivotTime: 0, touched: false };
    const originHigh = { type: "high", price: 1.1, pivotAt: "hi", pivotTime: 10, touched: false };
    // touchedTime (999) liegt NACH dem Bestätigungsmoment (breakingPivot, t=40) — zum
    // Bestätigungszeitpunkt selbst ist sweepCandidate also noch ungetoucht.
    const sweepCandidate = { type: "low", price: 1.03, pivotAt: "sweep", pivotTime: 20, touched: { price: 1.03, touchedAt: "x", touchedTime: 999 } };
    // eingebetteter Pivot bei t=25, innerhalb der Range -> triggert markLqSweeps für sweepCandidate,
    // ohne selbst etwas an currRange zu ändern. Selbst schon getoucht (touchedTime 26 < break-
    // Moment 40) -> darf NICHT als konkurrierender Pullback-Kandidat gewinnen, sonst testet dieser
    // Fall nur die Zeit-Regel aus Test 1 nochmal statt der Typ-Erweiterung hier.
    const nudge = { type: "low", price: 1.04, pivotAt: "nudge", pivotTime: 25, touched: { price: 1.04, touchedAt: "z", touchedTime: 26 } };
    // übergeordneter Bruch von range.high (outer -> kein closesAboveOldHigh-Check nötig, siehe
    // applyMarketStructurePivot) -> Bestätigung.
    const breakingPivot = { type: "high", price: 1.2, pivotAt: "break", pivotTime: 40, touched: false };
    const candles = [{ time: 21, open: 1.06, high: 1.08, low: 1.02, close: 1.06 }]; // Docht unter 1.03, Close drüber -> kein echter Bruch von sweepCandidate

    let state = initMarketStructureState(originLow, originHigh);
    state = applyMarketStructurePivot(state, sweepCandidate);
    state = applyInnerMarketStructurePivot(state, nudge, { candles });
    expect(state.structurePivots.find((p) => p.pivotAt === "sweep")?.type).toBe("LQ-sweep"); // Zwischenstand, siehe markLqSweeps-Test

    state = applyMarketStructurePivot(state, breakingPivot);

    expect(state.trend).toBe("uptrend");
    const protectedLow = state.structurePivots.find((p) => p.pivotAt === "sweep");
    expect(protectedLow?.type).toBe("protected-low");
  });

  // Regressionstest: die bestehende rangeState7-Regel (test/marketStructureAnalysis.test.js) — ALLE
  // Kandidaten ungetoucht -> der zeitlich JÜNGSTE gewinnt, NICHT der tiefste — darf durch diese
  // Änderung nicht kippen. tryConfirmUptrend sortiert weiterhin nach pivotTime, nicht nach price.
  it("bei mehreren komplett ungetouchten Kandidaten gewinnt weiterhin der jüngste, nicht der tiefste", () => {
    const originLow = { type: "low", price: 1.0, pivotAt: "lo", pivotTime: 0, touched: false };
    const originHigh = { type: "high", price: 1.1, pivotAt: "hi", pivotTime: 10, touched: false };
    const deeperButOlder = { type: "low", price: 1.01, pivotAt: "deep-old", pivotTime: 20, touched: false };
    const shallowerButNewer = { type: "low", price: 1.05, pivotAt: "shallow-new", pivotTime: 30, touched: false };
    const breakingPivot = { type: "high", price: 1.2, pivotAt: "break", pivotTime: 40, touched: false };

    let state = initMarketStructureState(originLow, originHigh);
    for (const p of [deeperButOlder, shallowerButNewer, breakingPivot]) {
      state = applyMarketStructurePivot(state, p);
    }

    const protectedLow = state.structurePivots.find((p) => p.type === "protected-low");
    expect(protectedLow?.pivotAt).toBe("shallow-new");
  });

  // Bug-Report Philip 2026-07-20 (zweite Runde): "1.33286 muss zum [Bestätigungsmoment] protected-
  // low sein, UND zum [späteren Replay-Zeitpunkt] ein 1h LQ-Sweep" — markLqSweeps hatte
  // 'protected-low' explizit von der Neubewertung ausgeschlossen ("anderes Konzept"). War falsch:
  // ein protected-low, das seither getoucht wurde, aber nie eine Kerze drunter geschlossen hat, ist
  // strukturell derselbe bestätigte Liquidity-Grab wie ein normales 'low' -> muss genauso zu
  // 'LQ-sweep' werden können.
  it("ein protected-low wird zu 'LQ-sweep', sobald es touched ist, aber nie eine Kerze drunter schließt", () => {
    const originLow = { type: "low", price: 1.0, pivotAt: "lo", pivotTime: 0, touched: false };
    const originHigh = { type: "high", price: 1.1, pivotAt: "hi", pivotTime: 10, touched: false };
    // touched von Anfang an gesetzt (globaler Fakt, wie bei echten Daten), touchedTime (999) liegt
    // aber NACH dem Bestätigungsmoment (t=40) -> qualifiziert trotzdem noch als protected-low.
    const pullback = { type: "low", price: 1.03, pivotAt: "pb", pivotTime: 20, touched: { price: 1.03, touchedAt: "t", touchedTime: 999 } };
    const breakingPivot = { type: "high", price: 1.2, pivotAt: "break", pivotTime: 40, touched: false };

    let state = initMarketStructureState(originLow, originHigh);
    state = applyMarketStructurePivot(state, pullback);
    state = applyMarketStructurePivot(state, breakingPivot);
    expect(state.structurePivots.find((p) => p.pivotAt === "pb")?.type).toBe("protected-low");

    // Später: ein eingebetteter Pivot bestätigt, dass 'pb' zwar getoucht wurde (Docht drunter), aber
    // NIE eine Kerze drunter geschlossen hat -> Liquidity-Grab, kein echter Bruch.
    const laterInner = { type: "high", price: 1.15, pivotAt: "later", pivotTime: 60, touched: false };
    const candles = [{ time: 21, open: 1.06, high: 1.08, low: 1.02, close: 1.06 }]; // Docht unter 1.03, Close drüber
    state = applyInnerMarketStructurePivot(state, laterInner, { candles });

    const pb = state.structurePivots.find((p) => p.pivotAt === "pb");
    expect(pb?.type).toBe("LQ-sweep");
  });
});
