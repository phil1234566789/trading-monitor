import { LiquidityLinePrimitive, detectLiquidityLevels, bullBearLabelSide, formatLsLabel } from "./liquidity.js";
import { cssColor } from "./chartColors.js";
import { lineWidth } from "./chartLineWidths.js";
import { PIP_SIZE } from "./pipConfig.js";
import type { Pivot, PivotHigh, PivotLow, MarketStructureState } from "./range.type";

// "up": bestätigt einen Uptrend (bestehendes Verhalten, Default -> ändert nichts an bisherigen
// Aufrufern/Tests). "down": exakt gespiegelt, für den Nested-Gegentrend-Tracker (CHoCH-Erkennung,
// siehe advanceNestedTrend) — high/low, protected-low/protected-high und uptrend/downtrend
// vertauscht, sonst identische Regeln (Chat 2026-07-25: "durch parameter den Code re-usen").
type TrendDirection = "up" | "down";

// Neuer "1h-Range"-Trendalgorithmus (siehe test/tdd_mit_claude.ts, rangeState1..7) — löst den
// alten, verworfenen BOS/CHoCH-Ansatz (trendZigzag.ts) für die eigentliche Trendbestimmung ab:
// auf M5-Periode-10-Pivots gab es zu viele CHoCHs/BOS für einen stabilen Trend (siehe Chat
// 2026-07-18). Dieser Algorithmus arbeitet auf H1-Periode-5-Pivots und bestätigt einen Trend erst,
// wenn eine echte Pullback-Struktur (structurePivots) vorliegt, nicht schon bei jeder neuen
// Extremkerze. Datei/Typ hießen bis Chat 2026-07-20 rangeAnalysis.ts/RangeState — umbenannt, weil
// "Range" hier mit dem GLEICHZEITIG existierenden, aber komplett anderen "Ranges"-Feature (H1-
// Fraktal-Pivot-Erkennung, Periode 5/2, siehe PriceChart.vue: rangesPeriod/showRanges/...)
// verwechselt wurde — dieser Algorithmus ist die eigentliche MARKTSTRUKTUR-Analyse, "Ranges"
// liefert ihm nur die rohen Input-Pivots.

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

// Erwartet die ersten beiden gelesenen Pivots (ein 'high' und ein 'low', in Lese-Reihenfolge für
// appliedPivots). currRange.high/low behalten hier bewusst ihren rohen Fraktal-Typ ('high'/'low'),
// werden anders als beim alten Zigzag-Ansatz NICHT reklassifiziert (siehe range.type.ts:
// PivotHigh/PivotLow).
export function initMarketStructureState(a: Pivot, b: Pivot): MarketStructureState {
  const high = a.type === "high" ? a : b;
  const low = a.type === "low" ? a : b;
  return {
    trend: "unknown",
    currRange: {
      high: { ...high, type: "high" },
      low: { ...low, type: "low" },
    },
    structurePivots: [],
    innerStructurePivots: [],
    appliedPivots: [a, b],
    nestedTrend: null,
    closedRanges: [],
    firstConfirmedAt: null,
  };
}

// pivotTime (Unix-Sekunden) ist die verlässliche Zeitachse für die Reihenfolge-Prüfung unten —
// bewusst NICHT die Position in appliedPivots (ein Array-Index ist fragil, siehe Chat). pivotTime
// ist im Pivot-Typ optional (range.type.ts), applyMarketStructurePivot braucht es aber zwingend ->
// klarer Fehler statt still falsch zu sortieren, falls doch mal ein Pivot ohne pivotTime hereinkommt.
function pivotTimeOf(pivot: Pivot): number {
  if (pivot.pivotTime == null) {
    throw new Error(`applyMarketStructurePivot: Pivot ohne pivotTime (pivotAt="${pivot.pivotAt}") — pivotTime ist für die Reihenfolge-Prüfung zwingend.`);
  }
  return pivot.pivotTime;
}

// War `pivot` zum Zeitpunkt `momentTime` (i.d.R. die pivotTime des GERADE bestätigenden Bruch-
// Pivots) schon getoucht? Bug-Report Philip 2026-07-20 ("zum Zeitpunkt 06.07. 21:00 ist [1.33286]
// das letzte ungetouchte pullback"): `touched` selbst ist ein GLOBALER Fakt (irgendwann bis zum
// Ende des geladenen Fensters berührt, siehe buildLevel in liquidity.js) — für die Pullback-Auswahl
// bei der Trendbestätigung zählt aber nur, ob der Touch VOR oder NACH dem Bestätigungsmoment liegt.
// Ohne touchedTime (ältere/synthetische Testdaten ohne den optionalen Zeitstempel, siehe
// range.type.ts) konservativ als "schon getoucht" behandeln, statt fälschlich zu qualifizieren.
function isUntouchedAsOf(pivot: Pivot, momentTime: number): boolean {
  if (!pivot.touched) return true;
  return typeof pivot.touched.touchedTime === "number" && pivot.touched.touchedTime > momentTime;
}

// Bug-Report Philip 2026-07-24 ("wieso steht immer noch kein BOS, obwohl [Kerze X] längst drunter
// geschlossen hat"): markLqSweeps' toTime war bislang IMMER die pivotTime des GERADE ankommenden
// Pivots selbst — dabei liegen `candles` (siehe applyMarketStructurePivot/applyInnerMarketStructurePivot)
// oft schon WEIT über diesen Zeitpunkt hinaus vor (die komplette geladene Historie bis "jetzt"/
// replayUntil). Ohne einen NEUEN Pivot, der die Auswertung anstößt, blieb ein längst geschehener
// echter Kerzenschluss unter einem Level so u.U. für Stunden unentdeckt, selbst wenn die Kerzendaten
// dafür längst vorlagen — reine Chart-Auffrischung (ohne neuen Pivot) holte das nie nach, weil jeder
// volle Recompute (siehe PriceChart.vue: computeMarketStructureState) den letzten angewendeten Pivot
// als toTime-Obergrenze wiederholt. Die letzte geladene Kerze ist die verlässlichere Grenze für "was
// wissen wir bereits" als die pivotTime des zufällig zuletzt gelesenen Pivots.
function latestKnownTime(candles: Candle[], pivot: Pivot): number {
  const lastCandleTime = candles.length > 0 ? candles[candles.length - 1].time : -Infinity;
  return Math.max(pivotTimeOf(pivot), lastCandleTime);
}

// Prüft, ob ein High-Bruch (übergeordnet ODER eingebettet, siehe applyMarketStructurePivot/
// applyInnerMarketStructurePivot) den Uptrend bestätigt — gemeinsame Logik für beide, seit Chat
// 2026-07-19 ("die Regeln müssten gleich sein, nur dass der kleinere Pivot mit einbezogen wird",
// gbp_h1_uptrend_LQ_sweep_long_setup.ts rangeState1_4). Ein bestätigter Uptrend braucht 4 Punkte
// in strikter zeitlicher Reihenfolge (pivotTime): das aktuelle currRange.low, ein currRange.high,
// das ZEITLICH NACH diesem Low liegt ("eligible" — sonst zählt es nicht als echter Ursprung eines
// Aufwärts-Legs), mindestens 1 Pullback-Low NACH diesem eligible currRange.high — aus
// structurePivots ODER innerStructurePivots zusammen, "der kleinere Pivot" darf also auch
// qualifizieren — und schließlich der Bruch dieses currRange.high durch breakingPivot.
//
// Pullback-Kandidaten (Bug-Report Philip 2026-07-20, gbp_h1_uptrend_protected_low_gebrochen.ts):
// - type 'low' ODER 'LQ-sweep' (nicht nur 'low') — markLqSweeps läuft in
//   applyInnerMarketStructurePivot VOR dieser Prüfung und kann einen eigentlich noch qualifizierenden
//   Pullback längst zu 'LQ-sweep' reklassifiziert haben (der GLOBALE touched-Fakt gilt schon, auch
//   wenn der eigentliche Touch zeitlich erst NACH dem gerade bestätigenden Pivot liegt).
// - MUSS zum Bestätigungsmoment noch ungetoucht sein (isUntouchedAsOf) — ein bereits (vor der
//   Bestätigung) getouchter Pullback "schützt" nichts mehr, der Preis war ja schon wieder da.
// Unter den verbleibenden Kandidaten gewinnt weiterhin der ZEITLICH JÜNGSTE (nicht der tiefste —
// das würde die bestehende rangeState7-Regel brechen, siehe test/marketStructureAnalysis.test.js:
// dort sind alle drei Kandidaten ungetoucht, und das explizit gewünschte Ergebnis ist das jüngste
// HL, nicht das tiefste). Gibt null zurück, wenn (noch) nicht bestätigt.
// Läuft bei JEDEM HH-Bruch, nicht nur beim allerersten (Chat 2026-07-23: "die structurePivots
// sollten den jetzt bullischen Trend BESTÄTIGEN" — vorher blockierte `trend !== "unknown"` jede
// weitere Auswertung, sobald der Uptrend einmal stand, und das protected-low blieb für immer auf
// dem allerersten Gewinner eingefroren, selbst wenn seither viele neuere, ebenfalls ungetouchte
// Pullbacks aufgetaucht waren). protected-low ist damit kein einmaliges Ereignis mehr, sondern
// rückt bei jedem weiteren HH-Bruch auf den jeweils jüngsten ungetouchten Pullback seit dem
// GERADE gebrochenen High weiter — der bisherige protected-low fällt dabei zurück auf 'low' (siehe
// reclassify unten), außer es taucht gar kein neuerer Kandidat auf (dann bleibt der alte stehen,
// nur currRange.high rückt trotzdem vor).
//
// direction (Chat 2026-07-25, CHoCH-Erkennung): "down" spiegelt die komplette Regel für den
// Nested-Gegentrend-Tracker (siehe advanceNestedTrend) — high/low, protected-low/protected-high und
// uptrend/downtrend vertauscht, sonst identische Logik. Default "up" reproduziert exakt das alte
// Verhalten (kein bestehender Aufrufer übergibt direction).
function tryConfirmTrend(state: MarketStructureState, breakingPivot: Pivot, direction: TrendDirection = "up"): MarketStructureState | null {
  const { currRange, structurePivots, innerStructurePivots, trend } = state;

  if (direction === "up") {
    // Die Eligibility-Prüfung (Origin-High muss NACH Origin-Low liegen) betrifft nur die
    // ALLERERSTE Bestätigung — einmal bestätigt, ist currRange.high per Konstruktion immer schon
    // ein gültiger, späterer Bruch, die Prüfung wäre hier bedeutungslos (und potenziell falsch).
    const highTime = pivotTimeOf(currRange.high);
    if (trend === "unknown" && highTime <= pivotTimeOf(currRange.low)) return null; // nicht eligible

    const advancedRange = { ...currRange, high: { ...breakingPivot, type: "high" as const } };
    const confirmationMoment = pivotTimeOf(breakingPivot);
    // NUR structurePivots (Periode-5) durchsucht — Chat 2026-07-26 ("P5 definiert Struktur, P2
    // erkennt nur SCHNELLER, wenn diese bereits definierte Struktur bricht"): der qualifizierende
    // Pullback (protected-low/-high, "Strukturpunkt 2") ist Teil der STRUKTUR-Definition, nicht des
    // schnelleren Bruch-Triggers (das bleibt weiterhin `breakingPivot` selbst, der sehr wohl ein
    // Periode-2-Pivot sein darf — siehe applyInnerMarketStructurePivotCore). Vorher konnte auch ein
    // NIE durch Periode-5 bestätigter reiner Periode-2-Pullback protected-low/-high werden (Bug-
    // Report Philip: "periode2Pivots sind doch viel zu schwach, wie kann es sein, dass wir daraus
    // protected-pivots machen?", belegt durch marketStructureAnalysisProtectedLow.test.js: ein rein
    // eingebetteter Pullback wurde protected-low, ganz ohne Periode-5-Pendant). innerStructurePivots
    // bleibt trotzdem Teil von `reclassify` unten (ein dort noch stehender, ÄLTERER protected-*-
    // Eintrag muss weiterhin zurückgestuft werden können, wenn ein neuerer Periode-5-Kandidat
    // gewinnt), nur die SUCHE nach neuen Kandidaten ist jetzt auf structurePivots beschränkt.
    const qualifyingPullbacks = structurePivots.filter(
      (p) => (p.type === "low" || p.type === "LQ-sweep") && pivotTimeOf(p) > highTime && isUntouchedAsOf(p, confirmationMoment),
    );
    if (qualifyingPullbacks.length === 0) {
      // Schon bestätigt, aber kein neuerer Kandidat seit dem letzten High -> nichts zum
      // Weiterrücken, trotzdem ganz normal den Bruch übernehmen (dieselbe Rolle wie der alte
      // "sonst nur High ersetzen"-Fallback in applyMarketStructurePivot/applyInnerMarketStructurePivot).
      return trend === "unknown" ? null : { ...state, currRange: advancedRange };
    }

    // jüngster qualifizierender Pullback nach pivotTime, nicht nach Array-Position bestimmt
    const protectedLow = qualifyingPullbacks.reduce((latest, p) => (pivotTimeOf(p) > pivotTimeOf(latest) ? p : latest));
    const reclassify = (p: Pivot): Pivot => {
      if (p === protectedLow) return { ...p, type: "protected-low" };
      if (p.type === "protected-low") return { ...p, type: "low" }; // vom neuen Kandidaten abgelöst
      return p;
    };

    return {
      ...state,
      trend: "uptrend",
      currRange: advancedRange,
      structurePivots: structurePivots.map(reclassify),
      innerStructurePivots: innerStructurePivots.map(reclassify),
      // Nur beim ALLERERSTEN Bestätigungsmoment setzen (state.trend war noch 'unknown') — bleibt
      // danach für immer eingefroren, auch wenn currRange bei weiteren Bestätigungen weiterwandert.
      firstConfirmedAt: state.firstConfirmedAt ?? breakingPivot,
    };
  }

  // Gespiegelt: brechende Seite ist hier 'low', die "geschützte" Pullback-Seite 'high'.
  const lowTime = pivotTimeOf(currRange.low);
  if (trend === "unknown" && lowTime <= pivotTimeOf(currRange.high)) return null; // nicht eligible

  const advancedRange = { ...currRange, low: { ...breakingPivot, type: "low" as const } };
  const confirmationMoment = pivotTimeOf(breakingPivot);
  // Gespiegelt: nur structurePivots (Periode-5) — siehe Kommentar im "up"-Zweig oben für die volle
  // Begründung.
  const qualifyingPullbacks = structurePivots.filter(
    (p) => (p.type === "high" || p.type === "LQ-sweep") && pivotTimeOf(p) > lowTime && isUntouchedAsOf(p, confirmationMoment),
  );
  if (qualifyingPullbacks.length === 0) {
    return trend === "unknown" ? null : { ...state, currRange: advancedRange };
  }

  const protectedHigh = qualifyingPullbacks.reduce((latest, p) => (pivotTimeOf(p) > pivotTimeOf(latest) ? p : latest));
  const reclassify = (p: Pivot): Pivot => {
    if (p === protectedHigh) return { ...p, type: "protected-high" };
    if (p.type === "protected-high") return { ...p, type: "high" }; // vom neuen Kandidaten abgelöst
    return p;
  };

  return {
    ...state,
    trend: "downtrend",
    currRange: advancedRange,
    structurePivots: structurePivots.map(reclassify),
    innerStructurePivots: innerStructurePivots.map(reclassify),
    firstConfirmedAt: state.firstConfirmedAt ?? breakingPivot,
  };
}

// Liest einen weiteren Pivot ein und wendet genau die Regeln an, die sich aus rangeState1..7
// ablesen lassen (siehe Chat 2026-07-18, Korrektur):
// 1. Pivot bricht die Range in seiner eigenen Richtung (neues Low unter currRange.low, neues High
//    über currRange.high) -> diese Grenze wird ersetzt.
// 2. Bestätigung siehe tryConfirmUptrend oben. Beispiel rangeState4 vs. rangeState7: pivot2 ist
//    NICHT eligible (liegt vor dem aktuellen range-low pivot3) -> pivot5s Bruch von pivot2
//    bestätigt NICHT, obwohl pivot4 zeitlich danach liegt. pivot5 IST eligible (liegt nach pivot3)
//    -> pivot8s Bruch von pivot5 bestätigt, weil pivot6 und pivot7 danach liegen (pivot4 zählt
//    hier nicht mehr mit, weil es VOR pivot5 liegt).
// 3. Pivot liegt innerhalb der aktuellen Range -> Pullback, landet in structurePivots (siehe
//    rangeState3/5/6) — unabhängig davon, ob er später als "qualifizierend" zählt.
// Seit Chat 2026-07-26 implementiert (vorher hier bewusst offen gelassen): die spiegelbildliche
// Downtrend-Bestätigung (neues Low bricht currRange.low mit genug nachträglichen Pullback-Highs in
// der Struktur) — siehe direction="down"-Zweig unten UND den zusätzlichen tryConfirmTrend(...,
// "down")-Versuch im direction="up"-LOW-Zweig (Bug-Report Philip: "kein 1h downtrend erkannt",
// siehe marketStructureAnalysisDowntrend.test.js).
// Jeder hier gelesene ÜBERGEORDNETE (z.B. Periode-5-)Pivot räumt innerStructurePivots leer —
// die eingebettete Struktur bezieht sich immer nur auf "seit dem letzten übergeordneten Pivot"
// (siehe Chat 2026-07-19, gbp_h1_uptrend_LQ_sweep_long_setup.ts: rangeState1_2 -> rangeState2,
// "wenn neuer übergeordneter pivot, dann innerStructurePivots CLEAREN"). Gilt für alle drei Fälle
// unten (Low-Bruch/High-Bruch/Struktur-Pullback), nicht nur für den Trend-Bestätigungsfall.
//
// candles (Chat 2026-07-24, Bug-Report Philip: "allerspätestens mit Bildung des folgenden P5-
// Fraktals sollte ein BOS stehen" — bis hierhin lief markLqSweeps NUR auf der Periode-2-Seite,
// ein reiner Periode-5-Pivot konnte LQ-sweep/break-of-structure also nie auslösen, selbst wenn
// längst ein echter Kerzenschluss vorlag): optional, Default `[]` bedeutet "keine Kerzendaten
// verfügbar" (closesBelowLevel behauptet dann konservativ KEINEN Sweep, siehe dort) — der
// Aufrufer (PriceChart.vue: computeMarketStructureState) MUSS echte Kerzen durchreichen, sonst
// bleibt dieser Pfad wirkungslos wie vorher.
// direction (Chat 2026-07-25, CHoCH-Erkennung): "down" spiegelt die komplette Funktion für den
// Nested-Gegentrend-Tracker (siehe advanceNestedTrend) — 'high' ist dann die erkundende Seite (nur
// ausweiten), 'low' die bestätigende (tryConfirmTrend). Default "up" reproduziert exakt das alte
// Verhalten, kein bestehender Aufrufer übergibt direction.
// Gemeinsame Invalidierungs-/Promotion-Entscheidung, sobald ein ECHTER Kerzenschluss currRange.low
// bricht, während der Uptrend schon bestätigt ist (Philip: "wenn der uptrend gebrochen ist, soll
// der algo von vorne anfangen") — geteilt zwischen Inner- UND (seit Chat 2026-07-25, Punkt 2:
// "Outer-Pivot-Low-Bruch ohne Kerzen-Check ... muss jetzt gemacht werden", Bug-Report Philip:
// "die bestehende Outer-Regel weitet currRange.low immer nur ohne Invalidierungs-/Kerzen-Check
// aus") Outer-Pivot-Pfad. Nur die Invalidierungs-ENTSCHEIDUNG selbst (Promotion vs. voller Reset)
// — appliedPivots-/innerStructurePivots-Wachstum drumherum bleibt beim jeweiligen Aufrufer, weil
// Outer- und Inner-Pivots das strukturell unterschiedlich handhaben (siehe
// applyMarketStructurePivotCore vs. applyInnerMarketStructurePivotCore).
function invalidateUptrend(sweepChecked: MarketStructureState, breakingPivot: Pivot, candles: Candle[]): MarketStructureState {
  const { currRange } = sweepChecked;
  // PROMOTION (Chat 2026-07-25): läuft bereits ein per Nested-Tracker bestätigter Gegentrend (CHoCH,
  // siehe advanceNestedTrend), übernimmt DER als neuer Outer-Trend, statt komplett bei Null neu zu
  // starten — die Vorlaufzeit (structurePivots/protected-high) bleibt damit erhalten. Die alte
  // Uptrend-Range wird für die Darstellung archiviert (closedRanges, ZigZag low->middle->high, siehe
  // Chat 2026-07-25 zweite Runde: "ich hätte gerne die ZickZack Linie ... noch im Chart drin" —
  // middle ist der zuletzt bestätigte protected-low DIESER (jetzt abgeschlossenen) Range, null falls
  // keiner bestätigt war).
  if (sweepChecked.nestedTrend?.trend === "downtrend") {
    const nested = sweepChecked.nestedTrend;
    const archivedMiddle = sweepChecked.structurePivots.find((p) => p.type === "protected-low" || p.type === "protected-high") ?? null;
    const promoted: MarketStructureState = {
      trend: "downtrend",
      currRange: nested.currRange,
      structurePivots: nested.structurePivots,
      innerStructurePivots: [],
      appliedPivots: nested.appliedPivots,
      nestedTrend: null,
      closedRanges: [...sweepChecked.closedRanges, { low: currRange.low, middle: archivedMiddle, high: currRange.high, trend: "uptrend" }],
      firstConfirmedAt: nested.firstConfirmedAt,
    };
    // Der GERADE brechende Pivot selbst (der die Promotion überhaupt erst auslöst, weil er den
    // ALTEN Uptrend-Ursprung bricht) noch einmal gegen die frisch übernommene Range prüfen
    // (Bug-Report Philip 2026-07-25: "haben ein innerpivot 1.33003 unter dem range.low 1.33553 ...
    // neues range.low sollte 1.33003 sein") — vorher wurde dieser Pivot NUR als Auslöser der
    // Promotion verwendet und danach verworfen, obwohl er selbst durchaus auch nested.currRange.low
    // weiter hätte unterbieten können.
    return applyInnerMarketStructurePivotCore(promoted, breakingPivot, { candles, direction: "down" });
  }
  // Kein bestätigter Gegentrend vorhanden -> wie bisher kompletter Reset auf 'unknown', kein
  // direkter Sprung zu 'downtrend', genau wie ein frischer Start auch erstmal 'unknown' ist. Der
  // alte currRange.high wird als neuer Origin-High WEITERVERWENDET statt verworfen — er liegt
  // zeitlich vor dem neuen Origin-Low (dem gerade brechenden Pivot), was genau die gespiegelte
  // Eligibility-Bedingung zum Uptrend ist (dort: High NACH Low = bullisch; hier: High VOR Low =
  // bärisch, siehe Philip: "ergo es geht tendenz nach unten").
  const newOriginHigh: PivotHigh = { ...currRange.high, type: "high" };
  const newOriginLow: PivotLow = { ...breakingPivot, type: "low" };
  return {
    trend: "unknown",
    currRange: { high: newOriginHigh, low: newOriginLow },
    structurePivots: [],
    innerStructurePivots: [],
    appliedPivots: [newOriginHigh, newOriginLow],
    nestedTrend: null,
    closedRanges: sweepChecked.closedRanges,
    firstConfirmedAt: null,
  };
}

// Spiegelbild von invalidateUptrend für einen bestätigten TOP-LEVEL-Downtrend (Chat 2026-07-26,
// Bug-Report Philip: "kein 1h downtrend erkannt" — der Haupttrend konnte bis dahin NUR über
// 'uptrend' laufen, ein Downtrend entstand ausschließlich über den Umweg Nested-CHoCH+Promotion;
// startete das sichtbare Fenster/Fixed-Start-Fenster aber schon mitten in einem Downtrend, ohne
// dass zuvor je ein Uptrend bestätigt wurde, sprang advanceNestedTrend nie an, und der Downtrend
// blieb für immer unsichtbar). Genutzt vom Outer- UND Inner-Pfad (siehe
// applyMarketStructurePivotCore/applyInnerMarketStructurePivotCore, direction="down") UND vom
// Nested-Tracker selbst (advanceNestedTrend/-Inner, direction="down" — der bärische CHoCH-Kandidat
// innerhalb eines Uptrends) — beim Nested-Tracker landet die archivierte Range in
// nested.closedRanges, was nirgends gerendert wird (nur state.closedRanges), also folgenlos bleibt,
// UND `nestedTrend` dort ist immer schon null (ein Nested-Tracker hat selbst keine tiefere
// Verschachtelung), weshalb der PROMOTION-Zweig unten für ihn nie greift.
// PROMOTION (Chat 2026-07-26, gespiegelt zu invalidateUptrend, auf "Bescheid :D" hin gebaut — der
// bullische Gegentrend-Tracker innerhalb eines Downtrends): läuft bereits ein per Nested-Tracker
// bestätigter Gegentrend (`nestedTrend.trend === 'uptrend'`, siehe advanceNestedTrend), übernimmt
// DER als neuer Outer-Trend statt des vollen Resets, exakt spiegelbildlich zu invalidateUptrend.
function invalidateDowntrend(sweepChecked: MarketStructureState, breakingPivot: Pivot, candles: Candle[]): MarketStructureState {
  const { currRange } = sweepChecked;
  if (sweepChecked.nestedTrend?.trend === "uptrend") {
    const nested = sweepChecked.nestedTrend;
    const archivedMiddle = sweepChecked.structurePivots.find((p) => p.type === "protected-low" || p.type === "protected-high") ?? null;
    const promoted: MarketStructureState = {
      trend: "uptrend",
      currRange: nested.currRange,
      structurePivots: nested.structurePivots,
      innerStructurePivots: [],
      appliedPivots: nested.appliedPivots,
      nestedTrend: null,
      closedRanges: [...sweepChecked.closedRanges, { low: currRange.low, middle: archivedMiddle, high: currRange.high, trend: "downtrend" }],
      firstConfirmedAt: nested.firstConfirmedAt,
    };
    // Der GERADE brechende Pivot selbst noch einmal gegen die frisch übernommene Range prüfen
    // (siehe invalidateUptrend für die volle Begründung — derselbe Bug wäre hier spiegelbildlich
    // möglich: der Pivot löst die Promotion aus, könnte aber selbst auch noch
    // nested.currRange.high überbieten).
    return applyInnerMarketStructurePivotCore(promoted, breakingPivot, { candles, direction: "up" });
  }
  // Kein bestätigter Gegentrend vorhanden -> kompletter Reset auf 'unknown'. Origin-Konstruktion:
  // der auslösende Pivot dient (als "low" umetikettiert) als selbstkorrigierender Platzhalter für
  // den neuen Origin-Low statt des alten currRange.low — derselbe Grund wie beim bereits gefixten
  // Nested-Invalidierungs-Bug (Chat 2026-07-25): das alte, chronologisch VOR diesem neuen High
  // liegende Low würde die bärische "High vor Low"-Eligibility einer erneuten Downtrend-Bestätigung
  // sonst dauerhaft sperren. Der Platzhalter (lowTime===highTime, noch nicht eligible für
  // IRGENDEINE Richtung) wird vom nächsten echten Pivot automatisch aufgelöst.
  const archivedMiddle = sweepChecked.structurePivots.find((p) => p.type === "protected-low" || p.type === "protected-high") ?? null;
  const newOriginHigh: PivotHigh = { ...breakingPivot, type: "high" };
  const newOriginLow: PivotLow = { ...breakingPivot, type: "low" };
  return {
    trend: "unknown",
    currRange: { high: newOriginHigh, low: newOriginLow },
    structurePivots: [],
    innerStructurePivots: [],
    appliedPivots: [newOriginHigh, newOriginLow],
    nestedTrend: null,
    closedRanges: [...sweepChecked.closedRanges, { low: currRange.low, middle: archivedMiddle, high: currRange.high, trend: "downtrend" }],
    firstConfirmedAt: null,
  };
}

// Gemeinsame Logik für die BESTÄTIGENDE Seite (HIGH-Bruch für direction="up", LOW-Bruch für
// direction="down") — bis Chat 2026-07-26 in vier fast identischen Stellen dupliziert (Outer/Inner
// × up/down). Bug-Report Philip 2026-07-26 ("bullischer Nested-Uptrend bestätigt trotz Docht-only-
// Bruch von 1.33907 — 1.33937 schließt nie über 1.33907, trotzdem uptrend+CHoCH+protected-low"):
// die beiden INNER-Kopien hatten den Docht-vs-Bruch-Check (closesAboveOldHigh/closesBelowLevel)
// schon seit Chat 2026-07-24, die beiden OUTER-Kopien (der ursprüngliche, älteste Teil des
// Algorithmus) nie — niemand hatte je den Outer-Pfad als Vorlage für den Inner-Fix benutzt oder
// umgekehrt, weil der Check nirgends als wiederverwendbare Funktion existierte, sondern jedes Mal
// neu inline geschrieben wurde. Jetzt EINE Implementierung statt vier, damit diese Bug-Klasse
// (Check an einer von vier Stellen vergessen) strukturell nicht mehr auftreten kann.
//
// Bewusst NUR für die bestätigende Seite (nicht auch die invalidierende/erkundende Seite, siehe
// applyMarketStructurePivotCore/applyInnerMarketStructurePivotCore unten) — dort unterscheidet sich
// die Logik zwischen "up" und "down" tatsächlich (nur die "up"-Varianten versuchen zusätzlich eine
// Downtrend-Bestätigung aus 'unknown' heraus, siehe dort), eine Vereinheitlichung dort würde also
// echte Unterschiede künstlich verstecken statt nur Duplikation entfernen.
// asOfTime (Chat 2026-07-26, Bug-Report Philip: "1.32772 gilt als sweep, obwohl der spätere
// Outer-Pivot 1.32934 längst da ist"): der Docht-vs-Bruch-Check darf nicht bei pivotTimeOf(pivot)
// abschneiden, wenn der reale Kerzenschluss über/unter dem alten Level erst auf einer NACH diesem
// Pivot liegenden Kerze passiert — sehr üblich, weil genau die Kerze, deren DOCHT den Pivot
// überhaupt erst bildet, selbst oft noch NICHT drüber/drunter schließt (der Docht macht den
// Pivot-Preis aus, nicht den Close). Anders als der verworfene `latestKnownTime`-Versuch (schaute
// bis zur letzten IRGENDWANN geladenen Kerze — vollständiges Hindsight quer durch die ganze
// Replay-Historie, siehe Git-Stash) ist asOfTime bewusst auf den tatsächlichen
// Anwendungszeitpunkt DIESES EINEN Pivots begrenzt (`entry.at` aus buildMarketStructureState,
// pivotTime + Bestätigungsverzögerung/periodOuter|periodInner) — genau die Kerzen, die zum Zeitpunkt,
// an dem dieser Pivot überhaupt erst verarbeitet wird, ohnehin schon bekannt sind, nicht mehr und
// nicht weniger. Optional (Default pivotTimeOf(pivot)), damit kein bestehender Testaufruf (keiner
// übergibt asOfTime) sein Verhalten ändert.
function evaluateConfirmingBreak(
  state: MarketStructureState,
  pivot: Pivot,
  direction: TrendDirection,
  candles: Candle[],
  asOfTime: number,
): { kind: "confirmed"; state: MarketStructureState } | { kind: "extend" } | { kind: "sweep" } {
  const { currRange } = state;
  const isRealBreak =
    direction === "up"
      ? closesAboveOldHigh(candles, pivotTimeOf(currRange.high), asOfTime, currRange.high.price)
      : closesBelowLevel(candles, pivotTimeOf(currRange.low), asOfTime, currRange.low.price);
  if (!isRealBreak) return { kind: "sweep" };
  const confirmed = tryConfirmTrend(state, pivot, direction);
  return confirmed ? { kind: "confirmed", state: confirmed } : { kind: "extend" };
}

// Chat 2026-07-26 (Bug-Report Philip, gefunden über die reale GBPUSD-Fixture in
// marketStructureAnalysisRealPipeline.test.js — "P5 definiert Struktur, P2 erkennt nur SCHNELLER"
// blockierte eine echte Bestätigung PERMANENT): die "Punkt 3 muss Outer sein"-Regel (siehe die
// beiden `evaluateConfirmingBreak`-Aufrufer unten) darf NICHT die Selbstkorrektur der
// Origin-Zeitreihenfolge verhindern. tryConfirmTrends Eligibility-Prüfung ("Low vor High" für
// direction='up', gespiegelt für 'down') gilt nur für die ALLERERSTE Bestätigung einer Range —
// solange sie fehlschlägt, ist currRange.high/low noch gar kein "Strukturpunkt 3" im Sinne der
// 4-Punkte-Regel, sondern reine Buchhaltung: der (zufällig falsch geordnete) Ursprung braucht
// noch IRGENDEINEN weiteren Pivot, der die Grenze zeitlich nach vorne schiebt, damit die Reihenfolge
// sich reparieren kann — das darf jeder Pivot tun, auch Periode-2, weil es keine STRUKTUR aufbaut,
// sondern nur einen technischen Vorzustand korrigiert. Erst SOBALD die Reihenfolge schon stimmt
// (eligible), ist eine weitere Ausweitung tatsächlich "Strukturpunkt 3" — und die Beschränkung auf
// Periode-5 greift.
function isOriginEligible(currRange: MarketStructureState["currRange"], direction: TrendDirection): boolean {
  return direction === "up" ? pivotTimeOf(currRange.high) > pivotTimeOf(currRange.low) : pivotTimeOf(currRange.low) > pivotTimeOf(currRange.high);
}

function applyMarketStructurePivotCore(
  state: MarketStructureState,
  pivot: Pivot,
  { candles = [], direction = "up", asOfTime }: { candles?: Candle[]; direction?: TrendDirection; asOfTime?: number },
): MarketStructureState {
  const { currRange, innerStructurePivots, appliedPivots, trend } = state;
  const effectiveAsOfTime = asOfTime ?? pivotTimeOf(pivot);
  const nextAppliedPivots = [...appliedPivots, pivot];
  // Ein per applyInnerMarketStructurePivot zu 'protected-low'/'protected-high' reklassifizierter
  // eingebetteter Pivot würde durch das innerStructurePivots:[] unten sonst sofort wieder
  // verschwinden (Chat 2026-07-23: "protected low verschwindet" — jeder übergeordnete Pivot räumt
  // die eingebettete Struktur weg, unabhängig von seinem eigenen Typ). Erst nach structurePivots
  // migrieren, DANN leeren — auf allen drei Zweigen unten, nicht nur beim Bestätigungsfall, weil
  // auch ein simpler Pullback oder ein Low-Bruch die eingebettete Struktur genauso wegräumt.
  // markLqSweeps läuft danach genau wie auf der Periode-2-Seite (siehe applyInnerMarketStructurePivot),
  // unabhängig davon, was DIESER Pivot selbst bricht — ein LQ-sweep/break-of-structure kann durch
  // jede neue Kerze bestätigt werden.
  const protectedType: "protected-low" | "protected-high" = direction === "up" ? "protected-low" : "protected-high";
  const migratedStructurePivots = [...state.structurePivots, ...innerStructurePivots.filter((p) => p.type === protectedType)];
  const structurePivots = markLqSweeps(
    migratedStructurePivots,
    candles,
    latestKnownTime(candles, pivot),
    direction,
    effectiveAsOfTime - pivotTimeOf(pivot),
  );

  if (direction === "up") {
    // Docht-vs-Bruch + Invalidierung/Promotion (Chat 2026-07-25, Punkt 2 — vorher weitete ein
    // reiner Periode-5-Pivot currRange.low IMMER ohne jeden Kerzen-Check aus, unabhängig davon, ob
    // der Uptrend schon bestätigt war; jetzt exakt dieselbe Regel wie auf der Periode-2-Seite,
    // siehe invalidateUptrend/applyInnerMarketStructurePivotCore).
    if (pivot.type === "low" && pivot.price < currRange.low.price) {
      const isRealBreak = closesBelowLevel(candles, pivotTimeOf(currRange.low), effectiveAsOfTime, currRange.low.price);

      if (isRealBreak) {
        if (trend === "uptrend") {
          return invalidateUptrend({ ...state, structurePivots }, pivot, candles);
        }
        // NEU (Chat 2026-07-26, "eigenständige Downtrend-Erkennung", Bug-Report Philip: "kein 1h
        // downtrend erkannt"): derselbe Bruch kann genauso gut die BESTÄTIGENDE Seite eines
        // brandneuen Downtrends sein (tryConfirmTrend, direction="down"), nicht nur eine
        // unbestätigte Ausweitung — vorher wurde ein Downtrend NIE direkt erkannt, nur über den
        // Umweg "erst Uptrend bestätigen, dann CHoCH, dann Promotion" (advanceNestedTrend läuft
        // nur, solange trend schon 'uptrend' ist). Landet der allererste Origin-Pivot zufällig als
        // "High vor Low" (bärische Reihenfolge — z.B. weil ein Fixed-Start-/Replay-Fenster mitten in
        // einem laufenden Downtrend beginnt), konnte 'uptrend' NIE bestätigen (dessen Eligibility
        // verlangt "Low vor High") und der Downtrend blieb dadurch für immer unsichtbar.
        const confirmedDown = tryConfirmTrend({ ...state, structurePivots }, pivot, "down");
        if (confirmedDown) {
          return { ...confirmedDown, innerStructurePivots: [], appliedPivots: nextAppliedPivots };
        }
        return {
          ...state,
          currRange: { ...currRange, low: { ...pivot, type: "low" } },
          structurePivots,
          innerStructurePivots: [],
          appliedPivots: nextAppliedPivots,
        };
      }
      return {
        ...state,
        currRange: { ...currRange, low: { ...currRange.low, type: "sweeped-low" } },
        structurePivots,
        innerStructurePivots: [],
        appliedPivots: nextAppliedPivots,
      };
    }

    // Docht-vs-Bruch-Check hier seit Chat 2026-07-26 über evaluateConfirmingBreak (Bug-Report
    // Philip: fehlte hier bis dahin komplett — ein reiner Docht über currRange.high bestätigte
    // bisher ohne Weiteres den Uptrend, siehe Funktionskommentar dort für die volle Begründung).
    if (pivot.type === "high" && pivot.price > currRange.high.price) {
      const outcome = evaluateConfirmingBreak({ ...state, structurePivots }, pivot, "up", candles, effectiveAsOfTime);
      if (outcome.kind === "confirmed") {
        return { ...outcome.state, innerStructurePivots: [], appliedPivots: nextAppliedPivots };
      }
      if (outcome.kind === "extend") {
        return {
          ...state,
          currRange: { ...currRange, high: { ...pivot, type: "high" } },
          structurePivots,
          innerStructurePivots: [],
          appliedPivots: nextAppliedPivots,
        };
      }
      return {
        ...state,
        currRange: { ...currRange, high: { ...currRange.high, type: "sweeped-high" } },
        structurePivots,
        innerStructurePivots: [],
        appliedPivots: nextAppliedPivots,
      };
    }
  } else {
    // Gespiegelt: 'high' bricht/invalidiert einen bestätigten Downtrend (bzw. weitet nur aus,
    // solange trend noch 'unknown' ist — reine Erkundung), 'low' bestätigt (evaluateConfirmingBreak,
    // direction="down"). Die Invalidierung (Chat 2026-07-26) fehlte hier bis dahin komplett — ein
    // ECHTER neuer Höchststand hätte einen bestätigten Downtrend sonst nie zurückgesetzt, sondern
    // currRange.high stillschweigend für immer weiter ausgeweitet.
    if (pivot.type === "high" && pivot.price > currRange.high.price) {
      const isRealBreak = closesAboveOldHigh(candles, pivotTimeOf(currRange.high), effectiveAsOfTime, currRange.high.price);
      if (isRealBreak) {
        if (trend === "downtrend") {
          return invalidateDowntrend({ ...state, structurePivots }, pivot, candles);
        }
        return {
          ...state,
          currRange: { ...currRange, high: { ...pivot, type: "high" } },
          structurePivots,
          innerStructurePivots: [],
          appliedPivots: nextAppliedPivots,
        };
      }
      return {
        ...state,
        currRange: { ...currRange, high: { ...currRange.high, type: "sweeped-high" } },
        structurePivots,
        innerStructurePivots: [],
        appliedPivots: nextAppliedPivots,
      };
    }

    if (pivot.type === "low" && pivot.price < currRange.low.price) {
      const outcome = evaluateConfirmingBreak({ ...state, structurePivots }, pivot, "down", candles, effectiveAsOfTime);
      if (outcome.kind === "confirmed") {
        return { ...outcome.state, innerStructurePivots: [], appliedPivots: nextAppliedPivots };
      }
      if (outcome.kind === "extend") {
        return {
          ...state,
          currRange: { ...currRange, low: { ...pivot, type: "low" } },
          structurePivots,
          innerStructurePivots: [],
          appliedPivots: nextAppliedPivots,
        };
      }
      return {
        ...state,
        currRange: { ...currRange, low: { ...currRange.low, type: "sweeped-low" } },
        structurePivots,
        innerStructurePivots: [],
        appliedPivots: nextAppliedPivots,
      };
    }
  }

  return {
    ...state,
    structurePivots: [...structurePivots, pivot],
    innerStructurePivots: [],
    appliedPivots: nextAppliedPivots,
  };
}

// Öffentlicher Einstiegspunkt: wickelt applyMarketStructurePivotCore ein und stößt danach — AUSSER
// wenn `nested: true` übergeben wird — den Gegentrend-Tracker an (advanceNestedTrend, CHoCH-
// Erkennung, Chat 2026-07-25/26). `nested` (NICHT `direction`!) entscheidet das, seit der Nested-
// Tracker seit Chat 2026-07-26 in BEIDE Richtungen laufen kann (ein bärischer CHoCH-Kandidat
// innerhalb eines Uptrends UND, gespiegelt, ein bullischer Kandidat innerhalb eines Downtrends,
// siehe advanceNestedTrend) — `direction` allein könnte das nicht mehr unterscheiden, weil
// direction="down" jetzt sowohl "das ist der (bärische) Nested-Tracker selbst" als auch "das ist
// der TOP-LEVEL-Haupttrend, der gerade ein 'downtrend' ist" bedeuten kann (buildMarketStructureState
// wählt `direction` rein anhand von state.trend, unabhängig von der Verschachtelungsebene). Der
// Nested-Tracker selbst wird intern IMMER mit `nested: true` gefüttert (siehe advanceNestedTrend),
// sonst würde jede Ebene eine eigene Nested-Ebene aufspannen (unendliche Verschachtelung). Dieser
// Wrapper ist bewusst die einzige öffentliche Stelle, damit direkte Testaufrufe (wie überall sonst
// in diesem Modul üblich) genauso automatisch einen Nested-Tracker mitführen wie der eigentliche
// buildMarketStructureState-Fold.
export function applyMarketStructurePivot(
  state: MarketStructureState,
  pivot: Pivot,
  {
    candles = [],
    direction = "up",
    nested = false,
    asOfTime,
  }: { candles?: Candle[]; direction?: TrendDirection; nested?: boolean; asOfTime?: number } = {},
): MarketStructureState {
  const result = applyMarketStructurePivotCore(state, pivot, { candles, direction, asOfTime });
  if (nested) return result;
  return advanceNestedTrend(result, pivot, candles, asOfTime);
}

// Analog zu closesBelowOldLow im alten trendZigzag.ts, nur für die Gegenrichtung: prüft, ob
// zwischen fromTime (Zeit des ALTEN currRange.high) und toTime (Zeit des brechenden Pivots)
// irgendeine Kerze ÜBER dem alten High-Preis geschlossen hat. Nur dann ist der Bruch "echt" (Preis
// bleibt oben) — sonst ist es nur ein Sweep: Preis hat den Docht drüber geschoben, kann aber laut
// Philip "potenziell umdrehen" (siehe Chat 2026-07-19). Ohne Kerzendaten konservativ NICHT abwerten
// — sonst würde ein fehlender Candle-Fetch stillschweigend jeden Bruch zum Sweep degradieren.
function closesAboveOldHigh(candles: Candle[], fromTime: number, toTime: number, oldHighPrice: number): boolean {
  if (candles.length === 0) return true;
  return candles.some((c) => c.time > fromTime && c.time <= toTime && c.close > oldHighPrice);
}

// Spiegelbildlich zu closesAboveOldHigh, für structurePivots statt currRange.high: prüft, ob seit
// levelTime (Zeit des betroffenen Pivots selbst) bis toTime irgendeine Kerze UNTER levelPrice
// geschlossen hat. Ohne Kerzendaten konservativ KEINEN Sweep behaupten (anders als bei
// closesAboveOldHigh — dort ist "echter Bruch" der Default, hier ist "plain low" der Default, siehe
// markLqSweeps).
function closesBelowLevel(candles: Candle[], levelTime: number, toTime: number, levelPrice: number): boolean {
  if (candles.length === 0) return true;
  return candles.some((c) => c.time > levelTime && c.time <= toTime && c.close < levelPrice);
}

// Spiegelbild von closesBelowLevel für die "down"-Richtung des Nested-Trackers (protected-high
// statt protected-low, siehe markLqSweeps) — dieselbe konservative Default-Semantik (ohne
// Kerzendaten KEIN Sweep behaupten), nicht zu verwechseln mit closesAboveOldHigh weiter oben
// (andere Default-Semantik, anderer Anwendungsfall: dort geht es um den echten Bruch von
// currRange.high selbst in applyInnerMarketStructurePivot).
function closesAboveLevel(candles: Candle[], levelTime: number, toTime: number, levelPrice: number): boolean {
  if (candles.length === 0) return true;
  return candles.some((c) => c.time > levelTime && c.time <= toTime && c.close > levelPrice);
}

// Ein LOW-structurePivot, der per Docht schon mal angetestet wurde (touched, aus der Fraktal-
// Erkennung selbst) aber NIE eine Kerze drunter geschlossen hat, ist ein Liquidity-Grab statt
// eines echten Bruchs — wird zu 'LQ-sweep' reklassifiziert (siehe Chat 2026-07-19, gbp_h1_uptrend_
// mit_LQ_sweep_LONG_SETUP.ts: rangeState1_1, "potenzieller 1h bullischer LQ-Sweep & Long Trade").
// Läuft über ALLE bisherigen structurePivots (nicht nur den, den der aktuelle Pivot direkt
// berührt) — ein Sweep kann durch jede neue Kerze nachträglich bestätigt werden, nicht nur exakt
// im Moment des auslösenden Pivots (siehe rangeState1_1: pivot9 wird durch p2Pivot37 bestätigt,
// pivot12 dagegen NICHT — dort hat zwischenzeitlich tatsächlich eine Kerze drunter geschlossen,
// also ein "echter" Touch, kein Sweep).
// BIDIREKTIONAL (Fix 2026-07-19, siehe Chat: "aktuell werden 3 1h LQ-Sweeps erkannt"): `touched`
// ist der volle Fixture-Endstand (steht schon fest, bevor der eigentliche Docht-Moment in der
// Replay-Reihenfolge überhaupt erreicht ist, siehe pivot9), daher kann closesBelowLevel bei einem
// FRÜHEN Zwischenschritt (toTime lange vor dem eigentlichen Close-drunter) fälschlich "noch kein
// Close" liefern. Ohne Rückweg bliebe das für immer als 'LQ-sweep' hängen, auch wenn ein späterer
// Schritt (näher am echten Zeitpunkt) den tatsächlichen Close-drunter längst sehen würde — daher
// hier IMMER neu bewerten (auch bereits als 'LQ-sweep' markierte), in beide Richtungen. Am
// tatsächlichen Ziel-toTime (z.B. p2Pivot37) ist das Ergebnis dadurch unabhängig vom genauen
// Zwischenschritt-Pfad immer korrekt.
// 'protected-low' ZÄHLT SEIT Bug-Report Philip 2026-07-20 MIT (vorher explizit ausgeschlossen —
// war falsch: "1.33286 muss zum [Bestätigungsmoment] protected-low sein, UND zum [späteren
// Replay-Zeitpunkt] ein 1h LQ-Sweep" — ein protected-low, das seither getoucht, aber nie
// drunter geschlossen wurde, ist genau wie jeder andere Pullback ein bestätigter Liquidity-Grab,
// keine Ausnahme).
// Ein ECHTER Close-Bruch degradiert einen gewöhnlichen 'low'/'LQ-sweep' zurück auf 'low' (siehe
// oben) — ein 'protected-low' dagegen wird zu 'break-of-structure' (Chat 2026-07-24: "pivot 1.336
// fällt unter 1.33806 ohne Chance auf LS"), nicht einfach nur 'low': ein PROTECTED-low sollte per
// Definition halten, sein echter Bruch ist strukturell schwerwiegender als ein gewöhnlicher
// Pullback, der bricht — eigenständiges Warnsignal, OHNE trend selbst anzufassen (bleibt
// 'uptrend', KEIN voller Reset wie bei der eigentlichen Trendumkehr, siehe
// applyInnerMarketStructurePivot: Bruch der currRange.low-Grenze selbst). Einmal 'break-of-
// structure' wird NICHT mehr zurückbewertet (fällt aus dem Typ-Filter oben raus, sobald gesetzt)
// — anders als 'LQ-sweep'/'low', die als Pendel zwischen unklaren Zwischenschritten gedacht sind,
// ist ein bestätigter Strukturbruch ein permanenter historischer Fakt.
// Downtrend-BESTÄTIGUNG (ein "protected-high" als Pendant zum protected-low) ist seit Chat
// 2026-07-26 implementiert (siehe marketStructureAnalysis.rules.md) — 'break-of-structure' bleibt
// aber weiterhin nur ein Warnsignal, kein Trendwechsel, in BEIDEN Richtungen.
// Touch-Gate über isUntouchedAsOf statt rohem `!p.touched` (Fix Chat 2026-07-24, gefunden über den
// echten .debug/metadata.json-Snapshot vom 2026-07-23, siehe test/marketStructureAnalysisRealPipeline
// .test.js): `touched` ist wie überall in dieser Datei der GLOBALE Endstand (irgendwann bis zum Ende
// des geladenen Kerzenfensters berührt), nicht "bereits berührt zum jetzigen Verarbeitungsmoment"
// (toTime). Mit dem rohen `!p.touched` degradierte ein frisch bestätigtes protected-low (siehe
// tryConfirmUptrend) OFT schon beim nächsten Verarbeitungsschritt zu 'LQ-sweep' — Monate bevor der
// eigentliche Touch überhaupt chronologisch stattfand —, einfach weil dieser Touch irgendwann später
// im Fenster als Fakt feststeht. Einmal so fälschlich zu 'LQ-sweep' degradiert, konnte der spätere
// ECHTE Close-drunter (markLqSweeps' 'protected-low' -> 'break-of-structure'-Zweig) nie mehr greifen
// — er sah nur noch 'LQ-sweep' vor und landete im 'low'-Zweig. Reale Auswirkung: bei GBPUSD H1
// (13.07.-23.07.2026) wurde 1.33806 direkt bei seiner eigenen protected-low-Bestätigung
// (15.07., 20:00) sofort wieder zu 'LQ-sweep' degradiert, obwohl der tatsächliche Touch erst am
// 21.07., 15:00 lag — der spätere echte Kerzenschluss darunter erzeugte dadurch nie einen
// break-of-structure.
// direction (Chat 2026-07-25, CHoCH-Erkennung): "down" prüft 'high'/'protected-high' statt
// 'low'/'protected-low' und einen Kerzenschluss DRÜBER statt DRUNTER — sonst identische Regel, für
// den Nested-Gegentrend-Tracker (siehe advanceNestedTrend). Default "up" reproduziert exakt das
// alte Verhalten.
// Der 'protected-type -> break-of-structure'-Zweig prüft den echten Bruch NUR bis zum EIGENEN
// ersten Touch-Zeitpunkt des Levels PLUS einer Toleranz (`graceSeconds`), NICHT bis `toTime` (Bug-
// Report Philip 2026-07-26, echter GBPUSD-Fund: `1.33292` wurde am 06.07. protected-low, am 08.07.
// getoucht (nur Docht, kein Close drunter — korrekt zu 'LQ-sweep' degradiert) und klappte trotzdem
// sofort im NÄCHSTEN Verarbeitungsschritt auf 'break-of-structure' um, weil `toTime`
// (`latestKnownTime`) schon bis zum Ende der geladenen Historie reicht und dort — Wochen später, am
// 22./23.07. — ein völlig anderer, unabhängiger Level (`1.33239`) real bricht; da `1.33239 <
// 1.33292`, "bricht" das automatisch auch das längst verbrauchte `1.33292` mit). Philips Regel:
// "als markante Strukturpunkte dürfen nur untouched pivots gelten" — ABER mit Augenmaß: ein
// zeitgleicher (oder nahezu zeitgleicher) Touch-und-Bruch in EINER durchgehenden Bewegung soll
// weiterhin zählen (Bug-Report Philip, echter GBPUSD-Fund: `1.33806` bricht real nur 1h NACH
// seinem eigenen Touch — dieselbe durchgehende Abwärtsbewegung, kein separates, späteres Ereignis
// wie bei `1.33292`). `graceSeconds` ist dafür dieselbe Bestätigungsverzögerung, die der Algo für
// diesen Pivot-Typ ohnehin schon toleriert (periodOuter/periodInner, siehe `effectiveAsOfTime -
// pivotTimeOf(pivot)` an den beiden Aufrufstellen) — kein neuer, willkürlicher Wert. Für den
// normalen 'low'/'LQ-sweep'-Pendel-Zweig (nicht protected) bleibt `toTime` unverändert — dort geht
// es nur um die kosmetische Sweep-vs-low-Unterscheidung, nicht um einen dauerhaften Strukturmarker.
function markLqSweeps(
  structurePivots: Pivot[],
  candles: Candle[],
  toTime: number,
  direction: TrendDirection = "up",
  graceSeconds = 0,
): Pivot[] {
  const baseType: "low" | "high" = direction === "up" ? "low" : "high";
  const protectedType: "protected-low" | "protected-high" = direction === "up" ? "protected-low" : "protected-high";
  const closesPastLevel = direction === "up" ? closesBelowLevel : closesAboveLevel;
  return structurePivots.map((p) => {
    if ((p.type !== baseType && p.type !== "LQ-sweep" && p.type !== protectedType) || isUntouchedAsOf(p, toTime)) return p;
    if (p.type === protectedType) {
      const touchedTime = p.touched && typeof p.touched.touchedTime === "number" ? p.touched.touchedTime : pivotTimeOf(p);
      const bosDeadline = Math.min(toTime, touchedTime + graceSeconds);
      const brokenWithinGrace = closesPastLevel(candles, pivotTimeOf(p), bosDeadline, p.price);
      return brokenWithinGrace ? { ...p, type: "break-of-structure" as const } : { ...p, type: "LQ-sweep" as const };
    }
    const brokenPast = closesPastLevel(candles, pivotTimeOf(p), toTime, p.price);
    if (brokenPast) return p.type === baseType ? p : { ...p, type: baseType };
    return p.type === "LQ-sweep" ? p : { ...p, type: "LQ-sweep" as const };
  });
}

// Liest einen eingebetteten (z.B. Periode-2-)Pivot ein — läuft NUR gegen die aktuelle Range, NIE
// gegen appliedPivots (das bleibt reine übergeordnete Zeitachse, siehe rangeState2_1: p2Pivot4
// taucht dort nur in innerStructurePivots auf) — siehe Chat 2026-07-19,
// gbp_h1_uptrend_LQ_sweep_long_setup.ts rangeState1_2/rangeState2_1/rangeState1_4:
// 0. Zuerst IMMER markLqSweeps über structurePivots (siehe oben) — unabhängig davon, was der
//    aktuelle Pivot selbst bricht.
// 1. Pivot liegt innerhalb der Range -> reiner Pullback, landet in innerStructurePivots.
// 2. Pivot bricht currRange.high preislich UND mindestens eine Kerze hat seit dem alten High
//    tatsächlich DRÜBER geschlossen (closesAboveOldHigh) -> echter Bruch, kein Sweep mehr ("ein
//    Sweep bedeutet, der Preis kann potenziell umdrehen — ohne Sweep reicht der erste Bruch
//    schon", siehe Chat) -> currRange.high wird SOFORT komplett ersetzt (Preis/Zeit des neuen
//    Pivots), unabhängig davon, ob der Uptrend selbst schon bestätigt. Bestätigt zusätzlich noch
//    (siehe tryConfirmUptrend, "der kleinere Pivot" darf mitbestätigen, siehe rangeState1_4:
//    p2Pivot5 bestätigt anhand von pivot3) -> Trend auf 'uptrend'. Landet in JEDEM Fall zusätzlich
//    in innerStructurePivots (anders als beim übergeordneten Fall, wo appliedPivots wächst).
// 3. Pivot bricht currRange.high preislich, aber KEINE Kerze schließt drüber -> nur Sweep:
//    currRange.high bleibt (Preis/pivotTime unverändert), nur type wird 'sweeped-high' (siehe
//    rangeState2_1: p2Pivot4).
// 4. Spiegelbildlich (seit Chat 2026-07-24, gbp_h1_uptrend_uptrend_break_of_structure_und_
//    trendumkehr.ts): Pivot bricht currRange.low preislich. Schließt seit currRange.low tatsächlich
//    eine Kerze drunter UND war der Uptrend schon bestätigt -> der Uptrend ist komplett invalidiert,
//    Trend zurück auf 'unknown', Algo startet komplett neu (structurePivots/innerStructurePivots
//    geleert, appliedPivots neu) mit dem alten currRange.high (zeitlich VOR dem neuen Low, bärische
//    Origin-Konstellation) und dem brechenden Pivot als neuem Low. War der Uptrend noch nicht
//    bestätigt, wird currRange.low stattdessen nur ausgeweitet (reine Erkundung, nichts zu
//    invalidieren). Kein echter Close drunter -> nur Sweep, 'sweeped-low' (spiegelbildlich zu
//    'sweeped-high').
// Seit Chat 2026-07-26 kann sich nach diesem Reset (trend wieder 'unknown') direkt ein neuer
// Downtrend bestätigen (ein "protected-high" als Pendant zum protected-low, siehe der zusätzliche
// tryConfirmTrend(..., "down")-Versuch im 'trend !== "uptrend"'-Fallback unten) — vorher war das
// hier nur die reine Invalidierung des alten Uptrends, ohne jede symmetrische Downtrend-Logik.
//
// direction (Chat 2026-07-25, zweite CHoCH-Runde: "range.low vom nestedTrend sollte schon tiefer
// sein, ein innerPivot hat sich bereits gebildet" — der Nested-Tracker lief bis dahin NUR über
// Outer-Pivots, siehe advanceNestedTrend, wodurch currRange.low sichtbar hinterherhinkte). "down"
// spiegelt die komplette Funktion für den Nested-Gegentrend-Tracker: 'low' ist dann die
// bestätigende Seite (tryConfirmTrend), 'high' die "darf nicht brechen"-Seite — OHNE
// Promotion-Prüfung beim Invalidieren (anders als bei direction="up"), weil ein Nested-Tracker
// selbst keine tiefere Verschachtelung hat (nestedTrend bleibt dort immer null) — ein durch einen
// echten Kerzenschluss widerlegter CHoCH startet deshalb einfach frisch vom neuen High, statt
// irgendwas zu "promoten". Default "up" reproduziert exakt das alte Verhalten, kein bestehender
// Aufrufer übergibt direction.
function applyInnerMarketStructurePivotCore(
  state: MarketStructureState,
  pivot: Pivot,
  { candles = [], direction = "up", asOfTime }: { candles?: Candle[]; direction?: TrendDirection; asOfTime?: number },
): MarketStructureState {
  const effectiveAsOfTime = asOfTime ?? pivotTimeOf(pivot);
  const sweepChecked = {
    ...state,
    structurePivots: markLqSweeps(state.structurePivots, candles, latestKnownTime(candles, pivot), direction, effectiveAsOfTime - pivotTimeOf(pivot)),
  };
  const { currRange, innerStructurePivots, trend } = sweepChecked;

  if (direction === "up") {
    if (pivot.type === "high" && pivot.price > currRange.high.price) {
      const outcome = evaluateConfirmingBreak(sweepChecked, pivot, "up", candles, effectiveAsOfTime);
      if (outcome.kind === "confirmed") {
        return { ...outcome.state, innerStructurePivots: [...outcome.state.innerStructurePivots, pivot] };
      }
      if (outcome.kind === "extend") {
        // Chat 2026-07-26 ("P5 definiert Struktur, P2 erkennt nur SCHNELLER, wenn diese bereits
        // definierte Struktur bricht"): ein echter, aber NICHT bestätigender Bruch bewegt currRange
        // NICHT mehr über einen Periode-2-Pivot — ABER NUR, wenn der Ursprung bereits eligible ist
        // (siehe isOriginEligible). Ist er das noch NICHT (zufällig falsch geordneter Ursprung,
        // siehe marketStructureAnalysisRealPipeline.test.js — ein echter Bug, den diese Ausnahme
        // beheben soll), bleibt die Ausweitung erlaubt: das ist reine Zeit-Reparatur, kein
        // "Strukturpunkt 3" im Sinne der 4-Punkte-Regel, sonst bliebe eine Range mit unglücklichem
        // Ursprung für IMMER unbestätigbar. Erst sobald eligible, greift die Beschränkung: eine
        // Kaskade rein Periode-2-getriebener, unbestätigter Verschiebungen soll dann keinen
        // "Strukturpunkt" mehr erzeugen können, der nie wirklich als eigenständiger Schwenkpunkt
        // existiert hat (Bug-Report Philip: Nested-Downtrend bestätigte über genau so eine Kaskade,
        // "das ist eigentlich nur Noise").
        if (isOriginEligible(currRange, "up")) {
          return { ...sweepChecked, innerStructurePivots: [...innerStructurePivots, pivot] };
        }
        return {
          ...sweepChecked,
          currRange: { ...currRange, high: { ...pivot, type: "high" } },
          innerStructurePivots: [...innerStructurePivots, pivot],
        };
      }
      return {
        ...sweepChecked,
        currRange: { ...currRange, high: { ...currRange.high, type: "sweeped-high" } },
        innerStructurePivots: [...innerStructurePivots, pivot],
      };
    }

    // Spiegelbildlich zum High-Bruch oben — bis Chat 2026-07-24 der explizit "NICHT implementiert"e
    // Fall (siehe Doku-Kommentar über dieser Funktion). Live beobachtet: p2Pivot66 (1.33003, GBPUSD
    // 1h) bildete sich unter currRange.low (1.33408), mehrere Kerzen schlossen danach tatsächlich
    // drunter — kein bloßer Docht/Sweep mehr.
    if (pivot.type === "low" && pivot.price < currRange.low.price) {
      const isRealBreak = closesBelowLevel(candles, pivotTimeOf(currRange.low), effectiveAsOfTime, currRange.low.price);

      if (isRealBreak) {
        // Ein bereits BESTÄTIGTER Uptrend bricht komplett, sobald eine Kerze wirklich unter
        // currRange.low schließt (Philip: "der uptrend ist komplett gebrochen, trend = unknown...
        // wenn der uptrend gebrochen ist, soll der algo von vorne anfangen") — Invalidierung/
        // Promotion-Entscheidung selbst siehe invalidateUptrend (geteilt mit dem Outer-Pivot-Pfad).
        if (trend === "uptrend") {
          return invalidateUptrend(sweepChecked, pivot, candles);
        }
        // NEU (Chat 2026-07-26, siehe applyMarketStructurePivotCore für die volle Begründung): auch
        // hier kann derselbe Bruch direkt einen neuen Downtrend bestätigen statt nur unbestätigt
        // auszuweiten — Periode-2-Pivots können das sogar VOR dem entsprechenden Periode-5-Pivot
        // (schnellere Erkennung, analog zur bestehenden Uptrend-Bestätigung).
        const confirmedDown = tryConfirmTrend(sweepChecked, pivot, "down");
        if (confirmedDown) {
          return { ...confirmedDown, innerStructurePivots: [...confirmedDown.innerStructurePivots, pivot] };
        }
        // Uptrend noch nicht bestätigt UND (noch) kein qualifizierender Downtrend-Kandidat ->
        // currRange.low bleibt seit Chat 2026-07-26 unangetastet, wenn der Bruch von einem
        // Periode-2-Pivot kommt UND der Ursprung für "down" bereits eligible ist (dieses Feld ist
        // dann bereits "Strukturpunkt 3" für einen möglichen künftigen Downtrend, nicht mehr reine
        // richtungslose Ursprungs-Erkundung — sonst könnte genau dieselbe P2-Kaskade entstehen, die
        // den Nested-Downtrend-Bug verursacht hat, nur diesmal auf der Haupttrend-Ebene). Ist der
        // Ursprung noch NICHT eligible, bleibt die Ausweitung erlaubt — reine Zeit-Reparatur (siehe
        // isOriginEligible-Kommentar), sonst bliebe ein zufällig falsch geordneter Ursprung für
        // IMMER unbestätigbar (Bug-Report Philip, gefunden über die reale GBPUSD-Fixture in
        // marketStructureAnalysisRealPipeline.test.js).
        if (isOriginEligible(currRange, "down")) {
          return {
            ...sweepChecked,
            innerStructurePivots: [...innerStructurePivots, pivot],
          };
        }
        return {
          ...sweepChecked,
          currRange: { ...currRange, low: { ...pivot, type: "low" } },
          innerStructurePivots: [...innerStructurePivots, pivot],
        };
      }
      return {
        ...sweepChecked,
        currRange: { ...currRange, low: { ...currRange.low, type: "sweeped-low" } },
        innerStructurePivots: [...innerStructurePivots, pivot],
      };
    }
  } else {
    // Gespiegelt: 'low' bestätigt/bricht (evaluateConfirmingBreak), 'high' ist die
    // Invalidierungs-Seite.
    if (pivot.type === "low" && pivot.price < currRange.low.price) {
      const outcome = evaluateConfirmingBreak(sweepChecked, pivot, "down", candles, effectiveAsOfTime);
      if (outcome.kind === "confirmed") {
        return { ...outcome.state, innerStructurePivots: [...outcome.state.innerStructurePivots, pivot] };
      }
      if (outcome.kind === "extend") {
        // Gespiegelt: siehe Kommentar im "up"-Zweig oben für die volle Begründung — nur gesperrt,
        // wenn der Ursprung schon eligible ist, sonst bleibt die reine Zeit-Reparatur erlaubt.
        if (isOriginEligible(currRange, "down")) {
          return { ...sweepChecked, innerStructurePivots: [...innerStructurePivots, pivot] };
        }
        return {
          ...sweepChecked,
          currRange: { ...currRange, low: { ...pivot, type: "low" } },
          innerStructurePivots: [...innerStructurePivots, pivot],
        };
      }
      return {
        ...sweepChecked,
        currRange: { ...currRange, low: { ...currRange.low, type: "sweeped-low" } },
        innerStructurePivots: [...innerStructurePivots, pivot],
      };
    }

    if (pivot.type === "high" && pivot.price > currRange.high.price) {
      const isRealBreak = closesAboveOldHigh(candles, pivotTimeOf(currRange.high), effectiveAsOfTime, currRange.high.price);

      if (isRealBreak) {
        if (trend === "downtrend") {
          // Invalidierung — sowohl für den Nested-Tracker (Gegentrend-Kandidat, KEINE Promotion,
          // siehe invalidateDowntrend-Funktionskommentar) als auch, seit Chat 2026-07-26, für einen
          // bestätigten TOP-LEVEL-Downtrend (dann inkl. Archivierung in closedRanges).
          return invalidateDowntrend(sweepChecked, pivot, candles);
        }
        return {
          ...sweepChecked,
          currRange: { ...currRange, high: { ...pivot, type: "high" } },
          innerStructurePivots: [...innerStructurePivots, pivot],
        };
      }
      return {
        ...sweepChecked,
        currRange: { ...currRange, high: { ...currRange.high, type: "sweeped-high" } },
        innerStructurePivots: [...innerStructurePivots, pivot],
      };
    }
  }

  return { ...sweepChecked, innerStructurePivots: [...innerStructurePivots, pivot] };
}

// Öffentlicher Einstiegspunkt, analog zu applyMarketStructurePivot: wickelt
// applyInnerMarketStructurePivotCore ein und stößt danach — AUSSER wenn `nested: true` übergeben
// wird (siehe dortiger Kommentar für die volle Begründung, warum `nested` statt `direction` das
// entscheidet) — auch den Nested-Tracker mit demselben (Periode-2-)Pivot an
// (advanceNestedTrendInner).
export function applyInnerMarketStructurePivot(
  state: MarketStructureState,
  pivot: Pivot,
  {
    candles = [],
    direction = "up",
    nested = false,
    asOfTime,
  }: { candles?: Candle[]; direction?: TrendDirection; nested?: boolean; asOfTime?: number } = {},
): MarketStructureState {
  const result = applyInnerMarketStructurePivotCore(state, pivot, { candles, direction, asOfTime });
  if (nested) return result;
  return advanceNestedTrendInner(result, pivot, candles, asOfTime);
}

// --- Pipeline (Kerzen -> Pivots -> State) --------------------------------------------------------
// Extrahiert aus PriceChart.vue (computeRangesPivotsFor/computeMarketStructureState, Chat 2026-07-24:
// "wie kann es sein, dass Tests grün laufen aber der Algo trotzdem nicht das macht, was die Tests
// eigentlich sicherstellen sollen?") — vorher lebte diese Logik NUR als lokale Funktion im
// Vue-Setup und war damit für Tests nicht direkt aufrufbar; jeder Test lief zwangsläufig gegen eine
// von Hand nachgebaute Kopie der Pipeline statt gegen exakt den Code, den die App tatsächlich
// ausführt. Ab jetzt einzige Quelle für beide Seiten (siehe PriceChart.vue: computeRangesPivotsFor/
// computeMarketStructureState delegieren hierher).
export function computeRangesPivots(candles: Candle[], period: number, cutoff: number, formatTime: (t: number) => string = (t) => String(t)): Pivot[] {
  const { highs, lows } = detectLiquidityLevels(candles, period);
  return [...highs, ...lows]
    .filter((p: any) => p.pivotTime >= cutoff)
    .sort((a: any, b: any) => a.pivotTime - b.pivotTime)
    .map(
      (p: any): Pivot => ({
        type: p.dir === 1 ? "high" : "low",
        price: p.price,
        pivotTime: p.pivotTime,
        pivotAt: formatTime(p.pivotTime),
        touched: p.touched ? { price: p.price, touchedAt: formatTime(p.touchedTime), touchedTime: p.touchedTime } : false,
      }),
    );
}

// CHoCH-Erkennung (Chat 2026-07-25, seit Chat 2026-07-26 in BEIDE Richtungen — "Bescheid :D" auf
// die Rückfrage, ob der bullische Gegentrend-Tracker innerhalb eines Downtrends auch noch gebaut
// werden soll): läuft NUR über Outer-(Periode-5-)Pivots — im Live-Beispiel des Nutzers sind
// 1.35583/1.35206/1.35429/1.34601 alles Periode-5-Pivots, keine Periode-2-Verfeinerung (das wäre
// ein möglicher späterer Ausbau, analog zur bestehenden innerStructurePivots-Idee, aber bewusst
// jetzt nicht gebaut). Wird aus buildMarketStructureState direkt nach jedem
// applyMarketStructurePivot-Aufruf angestoßen, NUR wenn der Haupttrend bereits bestätigt ist —
// ohne bestätigten Haupttrend gibt es nichts, wovon sich ein Gegentrend abheben könnte. Die
// Nested-Richtung ist IMMER die Gegenrichtung des Haupttrends (`uptrend` -> Nested "down",
// `downtrend` -> Nested "up", gespiegelt in JEDEM Detail unten: Ursprungsseite (currRange.high vs.
// currRange.low), wartende Pivot-Seite ('low' vs. 'high'), Feed-Richtung an
// applyMarketStructurePivot).
//
// Die AKTUELLE Ursprungsseite (currRange.high für den "down"-Nested-Fall, currRange.low für den
// "up"-Fall) ist IMMER der einzig gültige Ursprung, unabhängig davon, ob der Nested-Tracker schon
// bestätigt ist oder nicht: ein neues, den Haupttrend fortsetzendes Extrem macht einen zuvor
// getrackten Gegentrend-Kandidaten komplett irrelevant (reseeded auf null, bis der nächste
// Pullback als neuer Pairing-Punkt eintrifft — genau wie initMarketStructureState oben auch ein
// Pivot-Paar braucht, bevor ein State existieren kann). Das gilt SEIT Chat 2026-07-25 (Bug-Report
// Philip: "Choch Linie immernoch zu weit") explizit AUCH für einen bereits BESTÄTIGTEN
// Nested-Tracker: setzt sich der Haupttrend nach der CHoCH-Bestätigung noch weiter fort
// (widerspricht der Lower-High-/Higher-Low-Prämisse, auf der die Bestätigung beruhte), war der
// CHoCH falsch/überholt — vorher blieb ein solcher bereits bestätigter, aber längst nicht mehr
// gültiger Nested-Tracker für den kompletten Rest der Trend-Laufzeit stehen (nie reseeded, da die
// Bestätigung selbst das Reseeden bis dahin blockierte), was in echten Daten zu einer über sehr
// viele Kerzen hinweg gezogenen CHoCH-Linie führte.
function advanceNestedTrend(state: MarketStructureState, outerPivot: Pivot, candles: Candle[], asOfTime?: number): MarketStructureState {
  if (state.trend === "unknown") return { ...state, nestedTrend: null };

  const nested = state.nestedTrend;

  if (state.trend === "uptrend") {
    const originHigh: PivotHigh = { ...state.currRange.high, type: "high" };
    const isStale = nested != null && pivotTimeOf(nested.appliedPivots[0]) !== pivotTimeOf(originHigh);
    if (nested == null || isStale) {
      // Noch kein Pullback-Low seit dem (neuen) Origin-High gesehen -> abwarten, nicht raten.
      if (outerPivot.type !== "low") return { ...state, nestedTrend: null };
      return { ...state, nestedTrend: initMarketStructureState(originHigh, { ...outerPivot, type: "low" }) };
    }
    return { ...state, nestedTrend: applyMarketStructurePivot(nested, outerPivot, { candles, direction: "down", nested: true, asOfTime }) };
  }

  // Gespiegelt (Haupttrend ist 'downtrend'): Ursprung ist currRange.low, wartende Seite ist 'high'.
  const originLow: PivotLow = { ...state.currRange.low, type: "low" };
  const isStale = nested != null && pivotTimeOf(nested.appliedPivots[0]) !== pivotTimeOf(originLow);
  if (nested == null || isStale) {
    if (outerPivot.type !== "high") return { ...state, nestedTrend: null };
    return { ...state, nestedTrend: initMarketStructureState(originLow, { ...outerPivot, type: "high" }) };
  }
  return { ...state, nestedTrend: applyMarketStructurePivot(nested, outerPivot, { candles, direction: "up", nested: true, asOfTime }) };
}

// Periode-2-Pendant zu advanceNestedTrend (Chat 2026-07-25, zweite CHoCH-Runde: "range.low vom
// nestedTrend sollte schon tiefer sein, ein innerPivot hat sich bereits gebildet" — der
// Nested-Tracker lief bis dahin NUR über Outer-Pivots, wodurch currRange.low sichtbar
// hinterherhinkte, sobald ein Periode-2-Pivot schon tiefer stand). Reseeded NICHT selbst — das
// bleibt exklusiv Sache von advanceNestedTrend/Outer-Pivots, weil der Ursprung
// (appliedPivots[0]) immer ein Outer-Pivot ist — läuft nur, wenn bereits ein Nested-Tracker
// existiert, und verfeinert ihn genauso, wie Periode-2 den Haupttrend verfeinert.
function advanceNestedTrendInner(state: MarketStructureState, innerPivot: Pivot, candles: Candle[], asOfTime?: number): MarketStructureState {
  if (state.trend === "unknown" || !state.nestedTrend) return state;
  const nestedDirection: TrendDirection = state.trend === "uptrend" ? "down" : "up";
  return {
    ...state,
    nestedTrend: applyInnerMarketStructurePivot(state.nestedTrend, innerPivot, { candles, direction: nestedDirection, nested: true, asOfTime }),
  };
}

// pivotsOuter/pivotsInner müssen bereits wie computeRangesPivots' Output aussehen (sortiert nach
// pivotTime, type 'high'/'low'). Erster gelesener 'low'/'high' bilden die Start-Range (siehe
// initMarketStructureState), der Rest läuft gemischt nach confirmationTime über
// applyMarketStructurePivot/applyInnerMarketStructurePivot (siehe dortige Kommentare).
export function buildMarketStructureState(
  pivotsOuter: Pivot[] | null,
  pivotsInner: Pivot[] | null,
  periodOuter: number,
  periodInner: number,
  candles: Candle[],
): MarketStructureState | null {
  if (!pivotsOuter || pivotsOuter.length < 2) return null;
  const originLow = pivotsOuter.find((p) => p.type === "low");
  const originHigh = pivotsOuter.find((p) => p.type === "high");
  if (!originLow || !originHigh) return null;

  const [first, second] = originLow.pivotTime! <= originHigh.pivotTime! ? [originLow, originHigh] : [originHigh, originLow];
  let state = initMarketStructureState(first, second);

  const originCutoff = Math.max(first.pivotTime!, second.pivotTime!);
  const outerRest = pivotsOuter
    .filter((p) => p !== originLow && p !== originHigh)
    .map((pivot) => ({ pivot, outer: true, at: pivotTimeOf(pivot) + periodOuter * 3600 }));
  const innerRest = (pivotsInner ?? [])
    .filter((p) => pivotTimeOf(p) > originCutoff)
    .map((pivot) => ({ pivot, outer: false, at: pivotTimeOf(pivot) + periodInner * 3600 }));

  const merged = [...outerRest, ...innerRest].sort((a, b) => a.at - b.at);
  for (const entry of merged) {
    // direction (Chat 2026-07-26, "eigenständige Downtrend-Erkennung"): NICHT mehr hart "up" —
    // sobald der Haupttrend selbst schon 'downtrend' ist (siehe applyMarketStructurePivotCore/
    // applyInnerMarketStructurePivotCore, direction="down"-Bestätigung aus 'unknown' heraus), muss
    // jeder weitere Pivot auch über die gespiegelten "down"-Zweige laufen (sonst würde z.B. ein
    // neuer Höchststand fälschlich als Uptrend-Bestätigungsversuch statt als Downtrend-Invalidierung
    // behandelt). trend wird dafür nach JEDEM Pivot neu ausgelesen, nicht einmalig vorab bestimmt.
    const direction: TrendDirection = state.trend === "downtrend" ? "down" : "up";
    // asOfTime = entry.at (Chat 2026-07-26, "1.32772/1.32934"-Bug): derselbe Anwendungszeitpunkt,
    // der hier ohnehin schon die Verarbeitungsreihenfolge bestimmt (pivotTime + Bestätigungsverzögerung),
    // ist auch die korrekte Obergrenze für den Docht-vs-Bruch-Check (siehe evaluateConfirmingBreak) —
    // bis zu diesem Zeitpunkt sind die Kerzen bereits "bekannt", egal wie lange der Pivot selbst
    // schon zurückliegt.
    state = entry.outer
      ? applyMarketStructurePivot(state, entry.pivot, { candles, direction, asOfTime: entry.at })
      : applyInnerMarketStructurePivot(state, entry.pivot, { candles, direction, asOfTime: entry.at });
  }
  return state;
}

// --- Darstellung/Export (State -> reines JSON) ---------------------------------------------------
// Extrahiert aus PriceChart.vue (Chat 2026-07-27: Daten-Export braucht dieselbe Aufbereitung wie
// das Debug-Metadaten-Panel, siehe dataExport.js) — vorher lebten pivotForDisplay/
// summarizeMarketStructureState nur lokal im Vue-Setup. pivotTime/touched.touchedTime sind nur
// intern nötig (Rendern der Linien bzw. zeitbewusste Pullback-Auswahl in tryConfirmTrend), tauchen
// in Metadaten-Panels/Export bewusst nicht auf (Philips Pivot-Typ hat kein Pflichtfeld dafür, nur
// die menschenlesbaren pivotAt/touchedAt).
export function pivotForDisplay(p: Pivot | null): any {
  if (!p) return null;
  const { pivotTime, ...rest } = p as any;
  if (rest.touched && typeof rest.touched === "object") {
    const { touchedTime, ...touchedRest } = rest.touched;
    rest.touched = touchedRest;
  }
  return rest;
}

// includeAppliedPivots=false fürs Backtest-Daten-Export (Chat 2026-07-27, Philip: "appliedPivots
// ist für die Backtest-Daten komplett irrelevant") — appliedPivots ist reine interne Buchhaltung
// (jeder je gelesene Pivot, unabhängig davon ob er die Struktur beeinflusst hat), fürs
// Debug-Metadaten-Panel (Default true, unverändertes Verhalten) aber weiterhin zum Gegenprüfen
// gegen die hand-hergeleiteten rangeStateN-Fixtures nützlich.
export function summarizeMarketStructureState(
  state: MarketStructureState | null,
  { includeAppliedPivots = true }: { includeAppliedPivots?: boolean } = {},
): any {
  if (!state) return null;
  return {
    trend: state.trend,
    currRange: { high: pivotForDisplay(state.currRange.high), low: pivotForDisplay(state.currRange.low) },
    structurePivots: state.structurePivots.map(pivotForDisplay),
    innerStructurePivots: state.innerStructurePivots.map(pivotForDisplay),
    ...(includeAppliedPivots ? { appliedPivots: state.appliedPivots.map(pivotForDisplay) } : {}),
    // Nested-Gegentrend-Tracker (CHoCH-Erkennung, Chat 2026-07-25) — rekursiv über dieselbe
    // Funktion, damit er im Debug-Panel/Export genauso einsehbar ist wie der Haupttrend.
    nestedTrend: summarizeMarketStructureState(state.nestedTrend, { includeAppliedPivots }),
    closedRanges: state.closedRanges.map((r) => ({ ...r, low: pivotForDisplay(r.low), high: pivotForDisplay(r.high) })),
  };
}

// --- Zeichnung ----------------------------------------------------------------------------------
// Pfeil-Marker (roh: kleines gefülltes Dreieck) für range.high/range.low — sitzt ganz rechts am
// Pane-Rand (wie das Linienende, siehe toLevel), nicht am Pivot selbst (siehe Chat: "nach ganz
// rechts"). Farbe entscheidet die Seite: grün sitzt ÜBER der Linie und zeigt nach oben weg, rot
// UNTER der Linie und zeigt nach unten weg (siehe Chat: "Pfeile umdrehen").
class ArrowRenderer {
  private _point: any;
  private _options: any;

  constructor(point: any, options: any) {
    this._point = point;
    this._options = options;
  }

  draw(target: any) {
    const p = this._point;
    if (p.x === null || p.y === null) return;

    target.useBitmapCoordinateSpace((scope: any) => {
      const ctx = scope.context;
      const x = Math.round(p.x * scope.horizontalPixelRatio);
      const y = Math.round(p.y * scope.verticalPixelRatio);
      const size = 5 * scope.horizontalPixelRatio;
      ctx.fillStyle = this._options.color;
      ctx.beginPath();
      if (this._options.direction === "down") {
        // sitzt über der Linie, zeigt nach oben weg (für range.low)
        ctx.moveTo(x - size, y - size);
        ctx.lineTo(x + size, y - size);
        ctx.lineTo(x, y - size * 3);
      } else {
        // sitzt unter der Linie, zeigt nach unten weg (für range.high)
        ctx.moveTo(x - size, y + size);
        ctx.lineTo(x + size, y + size);
        ctx.lineTo(x, y + size * 3);
      }
      ctx.closePath();
      ctx.fill();
    });
  }
}

class ArrowPaneView {
  private _source: ArrowPrimitive;
  private _point: any;

  constructor(source: ArrowPrimitive) {
    this._source = source;
    this._point = { x: null, y: null };
  }

  update() {
    const series = this._source._series;
    const timeScale = this._source._chart.timeScale();
    const candles = this._source._candles;
    const pivot = this._source._pivot;
    const lastTime = candles.length > 0 ? candles[candles.length - 1].time : null;
    this._point = {
      x: lastTime != null ? timeScale.timeToCoordinate(lastTime) : null,
      y: series.priceToCoordinate(pivot.price),
    };
  }

  renderer() {
    return new ArrowRenderer(this._point, this._source._options);
  }
}

export class ArrowPrimitive {
  _pivot: Pivot;
  _options: { color: string; direction: "up" | "down" };
  _candles: Candle[];
  _paneViews: ArrowPaneView[];
  _chart: any;
  _series: any;

  constructor(pivot: Pivot, options: { color: string; direction: "up" | "down" }, candles: Candle[]) {
    this._pivot = pivot;
    this._options = options;
    this._candles = candles;
    this._paneViews = [new ArrowPaneView(this)];
    this._chart = null;
    this._series = null;
  }

  attached({ chart, series, requestUpdate }: { chart: any; series: any; requestUpdate: () => void }) {
    this._chart = chart;
    this._series = series;
    requestUpdate();
  }

  updateAllViews() {
    this._paneViews.forEach((v) => v.update());
  }

  paneViews() {
    return this._paneViews;
  }
}

// Gerade Linie(n) durch beliebig viele (Zeit, Preis)-Punkte, der Reihe nach verbunden — für die
// abgeschlossene Range nach einer Promotion. Erst als reine 2-Punkte-Linie gebaut (Chat 2026-07-25:
// "nur ne Linie, kein Zigzack"), dann auf beliebig viele Punkte erweitert (Chat 2026-07-25, zweite
// Runde: "ich hätte gerne die ZickZack Linie ... noch im Chart drin" — 3 Punkte low->middle->high,
// siehe ClosedRange/invalidateUptrend). LiquidityLinePrimitive (siehe liquidity.js) zeichnet nur
// horizontale Preis-Level, keine Diagonalen zwischen unterschiedlichen Preisen — deshalb eine
// eigene, kleine Primitive nach demselben Muster wie ArrowPrimitive oben (attached/paneViews/
// Renderer mit useBitmapCoordinateSpace).
class RangeLineRenderer {
  private _points: any[];
  private _options: any;

  constructor(points: any[], options: any) {
    this._points = points;
    this._options = options;
  }

  draw(target: any) {
    const pts = this._points;
    if (pts.length < 2 || pts.some((p) => p.x === null || p.y === null)) return;

    target.useBitmapCoordinateSpace((scope: any) => {
      const ctx = scope.context;
      ctx.strokeStyle = this._options.color;
      ctx.lineWidth = (this._options.lineWidth ?? 1) * scope.horizontalPixelRatio;
      // gestrichelt fürs Protected-Fib (Chat 2026-07-30, siehe computeFibLevels) — dieselben
      // Dash-Werte/derselbe Reset-danach wie LiquidityLinePrimitive (liquidity.js), kein impliziter
      // Reset zwischen Primitives.
      ctx.setLineDash(this._options.dashed ? [6 * scope.horizontalPixelRatio, 4 * scope.horizontalPixelRatio] : []);
      ctx.beginPath();
      ctx.moveTo(pts[0].x * scope.horizontalPixelRatio, pts[0].y * scope.verticalPixelRatio);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x * scope.horizontalPixelRatio, pts[i].y * scope.verticalPixelRatio);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }
}

class RangeLinePaneView {
  private _source: RangeLinePrimitive;
  private _points: any[];

  constructor(source: RangeLinePrimitive) {
    this._source = source;
    this._points = [];
  }

  update() {
    const series = this._source._series;
    const timeScale = this._source._chart.timeScale();
    this._points = this._source.pivots.map((p) => ({
      x: timeScale.timeToCoordinate(p.pivotTime),
      y: series.priceToCoordinate(p.price),
    }));
  }

  renderer() {
    return new RangeLineRenderer(this._points, this._source._options);
  }
}

class RangeLinePrimitive {
  pivots: Pivot[];
  _options: { color: string; lineWidth?: number; dashed?: boolean };
  _paneViews: RangeLinePaneView[];
  _chart: any;
  _series: any;

  // pivots: mindestens 2 Punkte, in Zeichenreihenfolge (nicht zwingend chronologisch, siehe
  // ClosedRange: low->middle->high ist bei einem Uptrend-Archiv automatisch auch chronologisch,
  // müsste es aber nicht sein).
  constructor(pivots: Pivot[], options: { color: string; lineWidth?: number; dashed?: boolean }) {
    this.pivots = pivots;
    this._options = options;
    this._paneViews = [new RangeLinePaneView(this)];
    this._chart = null;
    this._series = null;
  }

  attached({ chart, series, requestUpdate }: { chart: any; series: any; requestUpdate: () => void }) {
    this._chart = chart;
    this._series = series;
    requestUpdate();
  }

  updateAllViews() {
    this._paneViews.forEach((v) => v.update());
  }

  paneViews() {
    return this._paneViews;
  }
}

// Kurzer horizontaler Strich für ein Fib-Level (Chat 2026-07-30, siehe computeFibLevels) — sitzt
// exakt in der "Mitte der Zickzack-Linie" zwischen den beiden Fib-Ankern a/b: X ist der Pixel-
// Mittelwert der beiden Anker-Zeitpunkte (NICHT die Zeit-Mitte selbst durch timeToCoordinate
// gejagt — beides wäre hier äquivalent, aber der Pixel-Mittelwert braucht keine Annahme darüber,
// ob timeToCoordinate für einen nicht-existenten Zwischen-Zeitstempel sauber interpoliert), Y ist
// priceToCoordinate des ECHTEN 0,5-Preises (level.price), nicht der Pixel-Mittelwert der beiden
// Anker-Y-Koordinaten — bei stark unterschiedlicher Preisskala wäre das sonst nicht dasselbe.
// Feste Pixel-Halbbreite wie ArrowRenderer._size oben, kein Zoom-Skalieren nötig.
class FibTickRenderer {
  private _point: any;
  private _options: any;

  constructor(point: any, options: any) {
    this._point = point;
    this._options = options;
  }

  draw(target: any) {
    const p = this._point;
    if (p.x === null || p.y === null) return;

    target.useBitmapCoordinateSpace((scope: any) => {
      const ctx = scope.context;
      const x = p.x * scope.horizontalPixelRatio;
      const y = p.y * scope.verticalPixelRatio;
      const halfWidth = 8 * scope.horizontalPixelRatio;
      ctx.strokeStyle = this._options.color;
      ctx.lineWidth = (this._options.lineWidth ?? 1) * scope.horizontalPixelRatio;
      ctx.beginPath();
      ctx.moveTo(x - halfWidth, y);
      ctx.lineTo(x + halfWidth, y);
      ctx.stroke();
    });
  }
}

class FibTickPaneView {
  private _source: FibTickPrimitive;
  private _point: any;

  constructor(source: FibTickPrimitive) {
    this._source = source;
    this._point = { x: null, y: null };
  }

  update() {
    const series = this._source._series;
    const timeScale = this._source._chart.timeScale();
    const level = this._source._level;
    const xa = timeScale.timeToCoordinate(level.a.pivotTime);
    const xb = timeScale.timeToCoordinate(level.b.pivotTime);
    this._point = {
      x: xa != null && xb != null ? (xa + xb) / 2 : null,
      y: series.priceToCoordinate(level.price),
    };
  }

  renderer() {
    return new FibTickRenderer(this._point, this._source._options);
  }
}

export class FibTickPrimitive {
  _level: FibLevel;
  _options: { color: string; lineWidth?: number };
  _paneViews: FibTickPaneView[];
  _chart: any;
  _series: any;

  constructor(level: FibLevel, options: { color: string; lineWidth?: number }) {
    this._level = level;
    this._options = options;
    this._paneViews = [new FibTickPaneView(this)];
    this._chart = null;
    this._series = null;
  }

  attached({ chart, series, requestUpdate }: { chart: any; series: any; requestUpdate: () => void }) {
    this._chart = chart;
    this._series = series;
    requestUpdate();
  }

  updateAllViews() {
    this._paneViews.forEach((v) => v.update());
  }

  paneViews() {
    return this._paneViews;
  }
}

// Linienstärke ist seit Chat 2026-07-25 im Style-Modal konfigurierbar, EIN Wert PRO Farb-Key
// (rangeHigh/rangeLow/rangeProtectedLow/rangeLqSweep/rangeBreakOfStructure/rangeLiveUptrend/
// rangeLiveDowntrend/rangeClosed/rangeClosedDowntrend/rangeChoch —
// siehe chartLineWidths.js, zweite Runde: "bei jeder Linie, wo man schon die Farbe individuell
// anpassen kann"). rangeLqSweep bleibt per Default dünner als die übrigen (Chat 2026-07-24:
// "Linienstärke des 1h LQ Sweep auf 1px", seit ein Break of Structure existiert ist ein LQ-Sweep
// nur noch informativ) — kein Modul-Konstante mehr, `lineWidth(key)` wird direkt an jeder
// Verwendungsstelle aufgerufen, damit ein Style-Modal-Wechsel live greift.

function toLevel(pivot: Pivot, candles: Candle[]) {
  // Vereinfachung: Linie reicht immer bis zur letzten geladenen Kerze (nicht bis touchedAt-Zeit) —
  // für range.high/range.low/protected-low reicht das, weil sie per Definition der aktuell
  // gültige, unberührte Rand der Struktur sind (in Philips Beispiel sind alle drei `touched: false`).
  const endTime = candles.length > 0 ? candles[candles.length - 1].time : (pivot.pivotTime ?? 0);
  return { price: pivot.price, pivotTime: pivot.pivotTime ?? 0, endTime };
}

// Gegenstück zu toLevel() oben, für Pivots, die per Definition BEREITS berührt sind (1h-LQ-Sweep-
// Linien, siehe markLqSweeps: ein Pivot wird erst dann zu 'LQ-sweep', wenn sein Touch schon Fakt
// ist) — die Linie darf hier nicht bis "jetzt" durchgezeichnet werden, sondern muss am
// tatsächlichen Sweep-Zeitpunkt enden, genau wie liquidity.js: buildLevel es für normale
// Liquiditäts-Level schon macht (Bug-Report Philip 2026-07-28: "bereits früher gesweepte 1h
// LQ-Sweeps werden aktuell durchgezeichnet, bis zur aktuellen Uhrzeit ... in liquidity.js ist es
// bereits korrekt umgesetzt"). Fällt auf "letzte Kerze" zurück, falls touchedTime ausnahmsweise
// fehlt (touched=true, aber kein Zeitstempel, siehe PivotTouched.touchedTime als optional).
function toTouchedLevel(pivot: Pivot, candles: Candle[]) {
  const touchedTime = pivot.touched ? pivot.touched.touchedTime : undefined;
  const endTime = touchedTime ?? (candles.length > 0 ? candles[candles.length - 1].time : (pivot.pivotTime ?? 0));
  return { price: pivot.price, pivotTime: pivot.pivotTime ?? 0, endTime };
}

// Wandelt einen Pivot in die von tradeSetup.js erwartete LqLevel-Form um (siehe liquidity.js:
// buildLevel — dieselben Felder: price/dir/pivotTime/touched/touchedTime/endTime). Bug-Report
// Philip 2026-07-28: Path A/B in tradeSetup.js nutzten bislang eine EIGENE, unabhängige
// H1-Fraktal-Erkennung (liquidity.js auf einem nur 300 Kerzen/≈12,5 Tage kurzen Fenster,
// TRADE_SETUP_H1_CANDLE_COUNT in PriceChart.vue) statt der hier längst vorhandenen, sauber
// gefilterten structurePivots — ein 32 Tage altes, aber gerade erst geswepptes Level (1.13545)
// war dadurch für Path A/B unsichtbar, obwohl es im Debug-Panel längst als "1h LQ-Sweep"
// angezeigt wurde ("das allermeiste [an der alten H1-Fraktal-Erkennung] ist nur Datenmüll" —
// Philip wollte explizit NICHT die Kerzenzahl hochsetzen, sondern die längst gefilterten
// structurePivots wiederverwenden). dir wird vom Aufrufer mitgegeben, siehe collectH1LqLevels.
function toLqLevel(pivot: Pivot, dir: 1 | -1) {
  const touchedTime = pivot.touched ? (pivot.touched.touchedTime ?? null) : null;
  return {
    price: pivot.price,
    dir,
    pivotTime: pivot.pivotTime ?? 0,
    touched: pivot.touched !== false,
    touchedTime,
    // Nur touched Pivots kommen hier überhaupt an (siehe collectH1LqLevels-Filter), und der
    // Algorithmus setzt touchedTime für echte (nicht synthetische Test-)Pivots immer — der
    // pivotTime-Fallback ist rein defensiv für den in der Praxis nicht vorkommenden Fall.
    endTime: touchedTime ?? (pivot.pivotTime ?? 0),
  };
}

// Sammelt alle H1-Level-Kandidaten für EINE tradeSetup-Richtung (dir: -1 Long braucht Low-Seite,
// 1 Short braucht High-Seite) aus structurePivots — sowohl vom Haupttrend als auch von einem
// gerade laufenden Nested-Gegentrend-Kandidaten (CHoCH), falls vorhanden. Welche der beiden
// Pivot-Listen die Low- bzw. High-Seite liefert, hängt vom jeweiligen state.trend ab (uptrend:
// Haupttrend=Low-Seite; downtrend gespiegelt) — dieselbe Zuordnung wie isDowntrend in
// renderMarketStructureAnalysis. Nur touched Pivots sind als LS-Kandidat überhaupt relevant
// (untouched = noch nichts geswept, das ist die Fraktal-Seite, nicht die LS-Seite).
export function collectH1LqLevels(state: MarketStructureState | null | undefined, dir: 1 | -1) {
  if (!state) return [];
  const wantTrend = dir === -1 ? "uptrend" : "downtrend";
  const pivots: Pivot[] = [];
  if (state.trend === wantTrend) pivots.push(...state.structurePivots);
  if (state.nestedTrend && state.nestedTrend.trend === wantTrend) pivots.push(...state.nestedTrend.structurePivots);
  return pivots.filter((p) => p.touched !== false).map((p) => toLqLevel(p, dir));
}

// --- Fibonacci-Level (Chat 2026-07-30) --------------------------------------------------------
// Zwei 0,5er-Fib-Varianten pro Trend-Ebene (Haupttrend UND Nested-Trend, siehe computeFibLevels
// unten) — Bug-Report/Korrektur Philip: die erste Annahme "Fib = currRange.low <-> currRange.high"
// war falsch. Philips tatsächliche Fib-Ziehweise zieht IMMER vom Pivot, der die ganze Bewegung
// EINGELEITET hat — das ist der zuletzt bestätigte protected-low/-high ("Strukturpunkt 2"), nicht
// currRange.low/.high selbst (die Range-Kante kann durch spätere Pullbacks längst weitergewandert
// sein, ohne dass sich am eigentlichen Ursprung der Bewegung etwas geändert hätte). Er will trotzdem
// BEIDE Varianten sehen: "Range-Fib" (low<->high der aktuell laufenden Range, reine Orientierung)
// UND "Protected-Fib" (PP<->gegenüberliegende Range-Kante, die eigentlich gemeinte Bewegung).
export const RANGE_FIB_MIN_PP_DISTANCE_PIPS = 50; // siehe PIP-SETTINGS.md
const RANGE_FIB_MIN_PP_DISTANCE = RANGE_FIB_MIN_PP_DISTANCE_PIPS * PIP_SIZE;

// a/b bewusst nicht "low"/"high" genannt — bei der Protected-Variante ist nicht immer klar, welcher
// der beiden Anker der numerisch höhere ist (nur die Mitte zählt), und die Reihenfolge ist für die
// Zeichnung (Linie zwischen zwei Punkten, Tick genau in der Mitte) irrelevant.
export interface FibLevel {
  a: Pivot;
  b: Pivot;
  price: number;
}

function fibBetween(a: Pivot, b: Pivot): FibLevel {
  return { a, b, price: (a.price + b.price) / 2 };
}

// state kann der Haupttrend ODER ein Nested-Trend sein (identischer Typ, siehe advanceNestedTrend)
// — eine Implementierung für beide Ebenen statt Verdopplung, wie der Rest dieser Datei es auch
// handhabt (evaluateConfirmingBreak, invalidateUptrend/-Downtrend, ...).
export function computeFibLevels(
  state: MarketStructureState,
  minProtectedDistance: number = RANGE_FIB_MIN_PP_DISTANCE,
): { rangeFib: FibLevel; protectedFib: FibLevel | null } {
  const { currRange, structurePivots, trend } = state;
  const isDown = trend === "downtrend";
  const rangeFib = fibBetween(currRange.low, currRange.high);

  const protectedType: "protected-low" | "protected-high" = isDown ? "protected-high" : "protected-low";
  const pp = structurePivots.find((p) => p.type === protectedType) ?? null;
  const edge = isDown ? currRange.low : currRange.high;
  const protectedFib = pp && Math.abs(pp.price - edge.price) >= minProtectedDistance ? fibBetween(pp, edge) : null;

  return { rangeFib, protectedFib };
}

// Sammelt alle Fib-Level (Haupttrend + Nested, falls vorhanden) in klickbarer Form — analog zu
// collectH1LqLevels, aber ohne dir-Parameter (ein Fib ist nicht long/short-spezifisch). Genutzt
// von PriceChart.vue für die Trade-Bestätigungs-Klick-Erfassung (kind='fib', siehe
// tradeConfirmations.ts) — dieselbe A/B-Form wie computeFibLevels, keine gesonderte Aufbereitung
// nötig, weil die Klick-Trefferprüfung dieselbe Pixel-Mittelpunkt-Berechnung braucht wie die
// Zeichnung selbst (siehe FibTickPrimitive).
export function collectFibLevels(
  state: MarketStructureState | null | undefined,
  minProtectedDistance: number = RANGE_FIB_MIN_PP_DISTANCE,
): FibLevel[] {
  if (!state) return [];
  const result: FibLevel[] = [];
  for (const level of [state, state.nestedTrend]) {
    if (!level || level.trend === "unknown") continue;
    const { rangeFib, protectedFib } = computeFibLevels(level, minProtectedDistance);
    result.push(rangeFib);
    if (protectedFib) result.push(protectedFib);
  }
  return result;
}

// Erste Kerze (aus den ANGEZEIGTEN candles, i.d.R. feingranularer als die H1-Pivots selbst — z.B.
// M5, siehe Bug-Report Philip 2026-07-25) NACH fromTime, die tatsächlich unter price SCHLIESST.
// Erst auf reine Docht-Berührung umgestellt gewesen (Chat: "das reine Zeichnen ist doch nur bis
// Kerzenberührung, da reicht sogar ein Docht"), dann aber zurückgebaut (Bug-Report Philip:
// "entsteht der choch pivot im outer-pivot bereich und direkt paar minuten später berührt ein
// innerpivot den choch schon") — der H1-Periode-5-Ursprungspivot (chochAnchor) sitzt auf einer
// groben Stundenrasterung, sein `pivotTime` markiert nicht zwingend exakt den echten M5-Extrempunkt
// innerhalb dieser Stunde; ein reiner Docht-Check direkt danach greift dadurch fast immer sofort
// (normales Kerzenrauschen knapp nach einem frischen Swing-Low), lange bevor der eigentliche
// spätere Bruch passiert. Ein echter Kerzenschluss ist robust genug gegen dieses Rauschen (dieselbe
// Docht-vs-Bruch-Unterscheidung wie bei der Erkennung selbst, siehe closesBelowLevel — hier nur für
// die Zeichnung, nicht für die LQ-Sweep/Strukturbruch-Klassifizierung).
// Der bestätigende Pivot selbst (firstConfirmedAt) sitzt ebenfalls auf der groben H1-Periode-5-
// Rasterung und kann erst Stunden NACH dem eigentlichen Kerzenschluss offiziell als Fraktal
// bestätigt sein (braucht period=5 Kerzen danach, siehe detectLiquidityLevels) — "wo schließt eine
// Kerze tatsächlich unter dem Level" ist ein anderer, FRÜHERER Zeitpunkt als "wo wurde der Pivot
// als Fraktal bestätigt". Fällt auf `fallbackTime` zurück, falls keine Kerze im geladenen Fenster
// tatsächlich drunter schließt (z.B. Kerzendaten reichen nicht weit genug).
function firstCloseBelow(candles: Candle[], fromTime: number, price: number, fallbackTime: number): number {
  for (const c of candles) {
    if (c.time > fromTime && c.close < price) return c.time;
  }
  return fallbackTime;
}

// Spiegelbild von firstCloseBelow für die Nested-BOS-Linie (protected-high, real durch einen
// Kerzenschluss DRÜBER gebrochen) — sonst identische Begründung.
function firstCloseAbove(candles: Candle[], fromTime: number, price: number, fallbackTime: number): number {
  for (const c of candles) {
    if (c.time > fromTime && c.close > price) return c.time;
  }
  return fallbackTime;
}

// Ersetzt existingPrimitives komplett durch die aktuelle Marktstruktur-Darstellung: roter
// Pfeil+Linie an currRange.high, grüner Pfeil+Linie an currRange.low, bei bestätigtem Trend
// zusätzlich eine beschriftete Linie am protected-low (siehe Chat). state=null (oder zu wenig
// Kerzen) -> nur aufräumen, nichts zeichnen.
//
// Sobald ein Break of Structure existiert (Chat 2026-07-24: "damit ich nicht weiter nach Longs
// schaue"), werden alle bullischen "hier gibt's noch eine Long-Chance"-Pfeile unterdrückt — der
// grüne Pfeil an range.low UND jeder goldene LQ-Sweep-Pfeil —, die zugehörigen Linien/Labels
// bleiben aber stehen (weiterhin informativ, welches Level das war). range.low wird zusätzlich
// gestrichelt (signalisiert die Schwäche), unabhängig vom eigenen sweeped-low-Zustand.
export function renderMarketStructureAnalysis(
  series: any,
  state: MarketStructureState | null,
  existingPrimitives: any[],
  candles: Candle[],
  { nowSec, formatPrice }: { nowSec?: number; formatPrice?: (price: number) => string } = {},
) {
  // "Major LS 1,13545 (22d 19h alt)" statt "1h LQ-Sweep (22d 19h alt)" (Chat 2026-07-28: "damit sie
  // sich mit der Trade-Setup-LS-Linie 1:1 überlappen") — der Preis ist jetzt fester Bestandteil des
  // Labels (nicht mehr nur im Debug-Modus, siehe formatLsLabel in liquidity.js), daher immer über
  // formatPrice aufgelöst statt hinter debugPrices versteckt.
  const lqSweepLabel = (price: number, pivotTime: number | undefined) =>
    formatLsLabel(formatPrice ? formatPrice(price) : String(price), pivotTime, nowSec);
  for (const p of existingPrimitives) series.detachPrimitive(p);
  existingPrimitives.length = 0;
  if (!state || candles.length === 0) return;

  const hasBreakOfStructure = state.structurePivots.some((p) => p.type === "break-of-structure");
  // Seit der Promotion-Funktion (Chat 2026-07-25) kann der HAUPTTREND selbst 'downtrend' sein
  // (übernommener Nested-Tracker) — vorher war state.trend hier praktisch immer 'uptrend', daher
  // war die gesamte Darstellung unten bis zum Bug-Report Philip 2026-07-26 ("1h-LQ-Sweeps ... mit
  // einem bullischen Pfeil nach oben angezeigt") hart auf bullisch verdrahtet. isDowntrend steuert
  // ab hier, welche Seite (high/low) die "geschützte", per Break-of-Structure unterdrückbare Seite
  // ist — analog zur bereits bestehenden Nested-Tracker-Darstellung weiter unten.
  const isDowntrend = state.trend === "downtrend";

  const highColor = cssColor("rangeHigh");
  const lowColor = cssColor("rangeLow");
  // Gestrichelt statt durchgezogen, solange range.high/low nur "sweeped" ist (Docht durchbrochen,
  // aber noch keine Kerze drüber/drunter geschlossen -> kein bestätigter Bruch, siehe Chat
  // 2026-07-19) — ODER sobald irgendwo ein Break of Structure steht (Schwäche-Signal, unabhängig
  // vom sweeped-low-Zustand von range.low selbst) — im Uptrend betrifft das range.low (die
  // geschützte Seite), im Downtrend gespiegelt range.high. Dreieck (ArrowPrimitive) bleibt
  // unverändert — nur die Linie ändert sich.
  const highDashed = state.currRange.high.type === "sweeped-high" || (isDowntrend && hasBreakOfStructure);
  const lowDashed = state.currRange.low.type === "sweeped-low" || (!isDowntrend && hasBreakOfStructure);
  const highLine = new LiquidityLinePrimitive(
    toLevel(state.currRange.high, candles),
    { color: highColor, lineWidth: lineWidth("rangeHigh"), dashed: highDashed },
    candles,
  );
  const lowLine = new LiquidityLinePrimitive(
    toLevel(state.currRange.low, candles),
    { color: lowColor, lineWidth: lineWidth("rangeLow"), dashed: lowDashed },
    candles,
  );
  // Bug-Report Philip 2026-07-26: keine Pfeile mehr an range.high/range.low (nur noch bei
  // LQ-Sweep, siehe unten) — die Dreiecke (ArrowPrimitive) wurden hier bewusst entfernt, die reine
  // Linie (inkl. gestrichelt bei sweeped-high/-low bzw. Break of Structure, siehe oben) bleibt.
  const primitives: LiquidityLinePrimitive[] = [highLine, lowLine];
  for (const primitive of primitives) {
    series.attachPrimitive(primitive);
    existingPrimitives.push(primitive);
  }

  const protectedPivot = state.structurePivots.find((p) => p.type === (isDowntrend ? "protected-high" : "protected-low"));
  if (protectedPivot) {
    const line = new LiquidityLinePrimitive(
      toLevel(protectedPivot, candles),
      {
        color: cssColor("rangeProtectedLow"),
        lineWidth: lineWidth("rangeProtectedLow"),
        label: isDowntrend ? "1h protected high" : "1h protected low",
        labelSide: "end",
      },
      candles,
    );
    series.attachPrimitive(line);
    existingPrimitives.push(line);
  }

  // Goldene Linie + Pfeil je LQ-Sweep (siehe Chat 2026-07-19: "GOLDENE Linie ... mit dem label '1h
  // LQ-Sweep'", und Chat 2026-07-20: "noch mit nem goldenen Pfeil nach oben") — anders als
  // protected-low/-high (immer nur der jeweils jüngste) potenziell mehrere gleichzeitig, deshalb
  // hier eine Linie (+ ggf. Pfeil) PRO markiertem structurePivot statt nur die erste. Pfeilrichtung
  // folgt state.trend (Bug-Report Philip 2026-07-26: "1h-LQ-Sweeps ... bärisch aber mit
  // bullischem Pfeil nach oben angezeigt" — nach einer Promotion kann state.structurePivots
  // bärische LQ-Sweeps enthalten, direction war hier bis dahin hart auf "down"/bullisch verdrahtet,
  // siehe dieselbe gespiegelte direction bei der Nested-Tracker-Darstellung unten). Seit Chat
  // 2026-07-24 nur noch 1px breit (LQ_SWEEP_LINE_WIDTH) und OHNE Pfeil, sobald ein Break of
  // Structure existiert — der Long-/Short-Gedanke dahinter gilt dann nicht mehr, die Linie bleibt
  // aber als reine Information stehen.
  for (const lqSweep of state.structurePivots.filter((p) => p.type === "LQ-sweep")) {
    const lqColor = cssColor("rangeLqSweep");
    const line = new LiquidityLinePrimitive(
      toTouchedLevel(lqSweep, candles),
      // Rechtsbündig unter/über der Linie statt "end" (Chat 2026-07-28: "genauso wie schon in
      // trades die Protected Pivots und die LS") — bullischer Sweep (isDowntrend=false) unten,
      // bärischer oben, siehe bullBearLabelSide (liquidity.js).
      {
        color: lqColor,
        lineWidth: lineWidth("rangeLqSweep"),
        label: lqSweepLabel(lqSweep.price, lqSweep.pivotTime),
        labelSide: bullBearLabelSide(isDowntrend),
      },
      candles,
    );
    series.attachPrimitive(line);
    existingPrimitives.push(line);
    if (!hasBreakOfStructure) {
      const arrow = new ArrowPrimitive(lqSweep, { color: lqColor, direction: isDowntrend ? "up" : "down" }, candles);
      series.attachPrimitive(arrow);
      existingPrimitives.push(arrow);
    }
  }

  // Gestrichelte rote Linie + Beschriftung je Break of Structure (Chat 2026-07-24) — analog zu
  // LQ-Sweep potenziell mehrere gleichzeitig (jedes gebrochene protected-low bekommt seine
  // eigene), kein eigener Pfeil (reines Warnsignal, keine Handelsrichtung wie bei LQ-Sweep). Label
  // nur "BOS" (kein Alter — anders als bei LQ-Sweep für die Handelsentscheidung nicht relevant,
  // siehe Chat), mittig über der Linie im Uptrend, mittig darunter im Downtrend — spiegelbildlich
  // zur Trendrichtung (labelSide unten liest dafür state.trend, nicht mehr hart 'uptrend').
  for (const bos of state.structurePivots.filter((p) => p.type === "break-of-structure")) {
    const bosColor = cssColor("rangeBreakOfStructure");
    // Anders als toLevel (das immer bis zur letzten geladenen Kerze zeichnet) endet diese Linie
    // bewusst an der ERSTEN tatsächlich unter bos.price schließenden Kerze (Chat 2026-07-25: "Die
    // BOS Linie soll auch nicht so weit gezeichnet werden, sondern nur bis Kerzenberührung, wie bei
    // CHOCH") — genau der Kerzenschluss, der diesen Pivot überhaupt erst zu 'break-of-structure'
    // reklassifiziert hat (siehe markLqSweeps). Fallback auf die letzte geladene Kerze (altes
    // toLevel-Verhalten), falls diese Kerze im gerade angezeigten (evtl. kürzeren) Fenster fehlt.
    const bosFallback = candles.length > 0 ? candles[candles.length - 1].time : (bos.pivotTime ?? 0);
    const bosEndTime = firstCloseBelow(candles, bos.pivotTime ?? 0, bos.price, bosFallback);
    const bosLevel = { price: bos.price, pivotTime: bos.pivotTime ?? 0, endTime: bosEndTime };
    const line = new LiquidityLinePrimitive(
      bosLevel,
      {
        color: bosColor,
        lineWidth: lineWidth("rangeBreakOfStructure"),
        dashed: true,
        label: "BOS",
        labelSide: state.trend === "uptrend" ? "center-above" : "center-below",
      },
      candles,
    );
    series.attachPrimitive(line);
    existingPrimitives.push(line);
  }

  // Verbindungslinie der AKTUELL laufenden bestätigten Range (Chat 2026-07-25, Bug-Report Philip:
  // "auch den jetzigen bestätigten uptrend auch verbunden") — dieselbe einfache Linie wie bei
  // closedRanges unten, nur schon VOR einer Promotion/Invalidierung sichtbar. Farbe nach
  // Trendrichtung, aber EIGENE Keys statt rangeClosed/rangeChoch (Chat 2026-07-31, Bug-Report
  // Philip: "abgeschlossene range konfiguriert ... die aktuelle" — vorher teilten sich Live- und
  // Closed-Linie denselben Farb-Key, jetzt unabhängig einstellbar, siehe chartColors.js).
  if (state.trend !== "unknown") {
    const liveLineKey = state.trend === "uptrend" ? "rangeLiveUptrend" : "rangeLiveDowntrend";
    const liveLine = new RangeLinePrimitive([state.currRange.low, state.currRange.high], {
      color: cssColor(liveLineKey),
      lineWidth: lineWidth(liveLineKey),
    });
    series.attachPrimitive(liveLine);
    existingPrimitives.push(liveLine);
  }

  // Abgeschlossene Ranges (Chat 2026-07-25, Promotion bei Trend-Invalidierung mit bereits
  // bestätigtem Nested-Trend) — ZigZag low->middle->high (middle = zuletzt bestätigter
  // protected-low/-high dieser Range, siehe invalidateUptrend; ohne middle nur eine gerade Linie).
  // Farbe nach der ARCHIVIERTEN Trendrichtung (Chat 2026-07-25, zweite Runde: "kann die Zeichnung
  // dann noch den uptrend und downtrend farblich unterscheiden?"), nicht nach dem aktuellen
  // state.trend — war zuvor immer hart grün, unabhängig davon, was archiviert wurde. rangeClosed/
  // rangeClosedDowntrend statt rangeChoch fürs Downtrend-Pendant (Chat 2026-07-31) — eigener Key,
  // unabhängig von der Live-Linie UND von der CHoCH-Warnfarbe, siehe chartColors.js.
  for (const closed of state.closedRanges) {
    const closedKey = closed.trend === "uptrend" ? "rangeClosed" : "rangeClosedDowntrend";
    const points = closed.middle ? [closed.low, closed.middle, closed.high] : [closed.low, closed.high];
    const line = new RangeLinePrimitive(points, { color: cssColor(closedKey), lineWidth: lineWidth(closedKey) });
    series.attachPrimitive(line);
    existingPrimitives.push(line);
  }

  // Nested-Gegentrend-Struktur (CHoCH), sobald bestätigt, aber noch nicht promoted (Chat 2026-07-25,
  // Bug-Report Philip: "eine rote Verbindungslinie von 1.35583 bis 1.34601") — rote Linie über die
  // GESAMTE nested Range (aktueller high/low-Stand, kann über die reine Origin-Spanne hinaus
  // weitergewandert sein). Nach der Promotion ist nestedTrend wieder null, dann übernimmt die
  // reguläre currRange-Darstellung (inkl. der Live-Verbindungslinie oben) den neuen Trend.
  if (state.nestedTrend?.trend === "downtrend") {
    const nested = state.nestedTrend;
    const nestedLine = new RangeLinePrimitive([nested.currRange.low, nested.currRange.high], {
      color: cssColor("rangeChoch"),
      lineWidth: lineWidth("rangeChoch"),
    });
    series.attachPrimitive(nestedLine);
    existingPrimitives.push(nestedLine);

    // protected-high/LQ-sweep/break-of-structure für den Nested-Tracker selbst (Chat 2026-07-25,
    // Bug-Report Philip: "dieser bärische LQ Sweep entstand als der downtrend noch ein nestedTrend
    // war ... sollte viel früher erkannt werden" — markLqSweeps(direction="down") lief auf
    // nested.structurePivots schon die ganze Zeit über advanceNestedTrend/advanceNestedTrendInner
    // mit (die ERKENNUNG war also nie das Problem), nur die DARSTELLUNG zeigte bis hierhin
    // ausschließlich state.structurePivots — nested.structurePivots wurde nie gerendert, bevor eine
    // Promotion passierte). Exakt dieselben Elemente wie unten für den Haupttrend, nur an
    // nested.structurePivots und mit gespiegelter Pfeilrichtung (bärisch statt bullisch).
    const hasNestedBreakOfStructure = nested.structurePivots.some((p) => p.type === "break-of-structure");

    const protectedHigh = nested.structurePivots.find((p) => p.type === "protected-high");
    if (protectedHigh) {
      const line = new LiquidityLinePrimitive(
        toLevel(protectedHigh, candles),
        { color: cssColor("rangeProtectedLow"), lineWidth: lineWidth("rangeProtectedLow"), label: "1h protected high", labelSide: "end" },
        candles,
      );
      series.attachPrimitive(line);
      existingPrimitives.push(line);
    }

    for (const lqSweep of nested.structurePivots.filter((p) => p.type === "LQ-sweep")) {
      const lqColor = cssColor("rangeLqSweep");
      const line = new LiquidityLinePrimitive(
        toTouchedLevel(lqSweep, candles),
        // bärischer Nested-Sweep -> Label immer oberhalb (siehe bullBearLabelSide).
        {
          color: lqColor,
          lineWidth: lineWidth("rangeLqSweep"),
          label: lqSweepLabel(lqSweep.price, lqSweep.pivotTime),
          labelSide: bullBearLabelSide(true),
        },
        candles,
      );
      series.attachPrimitive(line);
      existingPrimitives.push(line);
      if (!hasNestedBreakOfStructure) {
        // direction: "up" statt "down" — bärischer Sweep (gehaltener Widerstand), Pfeil zeigt nach
        // unten weg statt wie beim bullischen Pendant nach oben (siehe ArrowRenderer).
        const arrow = new ArrowPrimitive(lqSweep, { color: lqColor, direction: "up" }, candles);
        series.attachPrimitive(arrow);
        existingPrimitives.push(arrow);
      }
    }

    for (const bos of nested.structurePivots.filter((p) => p.type === "break-of-structure")) {
      const bosColor = cssColor("rangeBreakOfStructure");
      const bosFallback = candles.length > 0 ? candles[candles.length - 1].time : (bos.pivotTime ?? 0);
      // firstCloseAbove statt firstCloseBelow — hier bricht ein protected-high durch einen
      // Kerzenschluss DRÜBER, spiegelbildlich zur BOS-Linie des Haupttrends weiter unten.
      const bosEndTime = firstCloseAbove(candles, bos.pivotTime ?? 0, bos.price, bosFallback);
      const bosLevel = { price: bos.price, pivotTime: bos.pivotTime ?? 0, endTime: bosEndTime };
      const line = new LiquidityLinePrimitive(
        bosLevel,
        { color: bosColor, lineWidth: lineWidth("rangeBreakOfStructure"), dashed: true, label: "BOS", labelSide: "center-below" },
        candles,
      );
      series.attachPrimitive(line);
      existingPrimitives.push(line);
    }

    // CHoCH-Label sitzt an der URSPRÜNGLICHEN Nested-Origin-Low (appliedPivots[1] — siehe
    // advanceNestedTrend: nestedTrend wird IMMER via initMarketStructureState(originHigh, lowPivot)
    // geseedet, appliedPivots[0]/[1] sind damit garantiert High/Low des Ursprungs), NICHT am
    // aktuellen currRange.low (das ist der zuletzt brechende Pivot, siehe Bug-Report Philip: "IST
    // 1.34601, SOLL 1.35206" — 1.35206 ist die gebrochene Ursprungsstruktur, nicht der Bruch selbst).
    const chochAnchor = nested.appliedPivots[1];
    // Anders als toLevel (das immer bis zur letzten geladenen Kerze zeichnet) endet diese Linie
    // bewusst NICHT an currRange.low (wandert weiter, solange nicht promoted — Bug-Report Philip:
    // "CHOCH Linie geht noch zu weit") und auch NICHT an firstConfirmedAt selbst (dem H1-Periode-5-
    // Fraktal-Pivot, der erst Stunden NACH dem eigentlichen Kerzenschluss unter dem Level offiziell
    // bestätigt wird) — sondern an der ERSTEN tatsächlich unter chochAnchor.price schließenden
    // Kerze der angezeigten (i.d.R. feineren) Candles. Bewusst Kerzenschluss statt reinem Docht
    // (siehe firstCloseBelow: ein Docht-Check direkt nach dem groben H1-Ursprungspivot greift durch
    // normales Kerzenrauschen fast immer sofort, Bug-Report Philip: "direkt paar minuten später
    // berührt ein innerpivot den choch schon").
    // Bug-Report Philip 2026-07-25: "Linie sollte irgendwo in der MMM am 16.07. 10:30-13:00 enden"
    // — Stunden VOR dem offiziellen Pivot-Bestätigungszeitpunkt 19:00, siehe .debug/metadata.json.
    const chochEndTime = firstCloseBelow(candles, chochAnchor.pivotTime ?? 0, chochAnchor.price, pivotTimeOf(nested.firstConfirmedAt!));
    const chochLevel = { price: chochAnchor.price, pivotTime: chochAnchor.pivotTime ?? 0, endTime: chochEndTime };
    const chochLine = new LiquidityLinePrimitive(
      chochLevel,
      { color: cssColor("rangeChoch"), lineWidth: lineWidth("rangeChoch"), dashed: true, label: "CHoCH", labelSide: "center-below" },
      candles,
    );
    series.attachPrimitive(chochLine);
    existingPrimitives.push(chochLine);
  }

  // Gespiegelt zum Block oben: bullischer Nested-Gegentrend-Kandidat innerhalb eines bestätigten
  // Downtrends (Chat 2026-07-26, "Bescheid :D" auf die Rückfrage, ob das auch noch gebaut werden
  // soll) — exakt dieselben Elemente, nur an einem 'uptrend'-Nested-Tracker und mit gespiegelter
  // Pfeilrichtung/Kerzenschluss-Prüfung (bullisch statt bärisch). Dieselbe Farbe (rangeChoch) wie
  // oben — "CHoCH" ist als Vorlauf-Signal eine eigene Kategorie, unabhängig von der Richtung.
  if (state.nestedTrend?.trend === "uptrend") {
    const nested = state.nestedTrend;
    const nestedLine = new RangeLinePrimitive([nested.currRange.low, nested.currRange.high], {
      color: cssColor("rangeChoch"),
      lineWidth: lineWidth("rangeChoch"),
    });
    series.attachPrimitive(nestedLine);
    existingPrimitives.push(nestedLine);

    const hasNestedBreakOfStructure = nested.structurePivots.some((p) => p.type === "break-of-structure");

    const protectedLow = nested.structurePivots.find((p) => p.type === "protected-low");
    if (protectedLow) {
      const line = new LiquidityLinePrimitive(
        toLevel(protectedLow, candles),
        { color: cssColor("rangeProtectedLow"), lineWidth: lineWidth("rangeProtectedLow"), label: "1h protected low", labelSide: "end" },
        candles,
      );
      series.attachPrimitive(line);
      existingPrimitives.push(line);
    }

    for (const lqSweep of nested.structurePivots.filter((p) => p.type === "LQ-sweep")) {
      const lqColor = cssColor("rangeLqSweep");
      const line = new LiquidityLinePrimitive(
        toTouchedLevel(lqSweep, candles),
        // bullischer Nested-Sweep -> Label immer unterhalb (siehe bullBearLabelSide).
        {
          color: lqColor,
          lineWidth: lineWidth("rangeLqSweep"),
          label: lqSweepLabel(lqSweep.price, lqSweep.pivotTime),
          labelSide: bullBearLabelSide(false),
        },
        candles,
      );
      series.attachPrimitive(line);
      existingPrimitives.push(line);
      if (!hasNestedBreakOfStructure) {
        // direction: "down" statt "up" — bullischer Sweep (gehaltener Support), Pfeil zeigt nach
        // oben weg, spiegelbildlich zum bärischen Pendant oben (siehe ArrowRenderer).
        const arrow = new ArrowPrimitive(lqSweep, { color: lqColor, direction: "down" }, candles);
        series.attachPrimitive(arrow);
        existingPrimitives.push(arrow);
      }
    }

    for (const bos of nested.structurePivots.filter((p) => p.type === "break-of-structure")) {
      const bosColor = cssColor("rangeBreakOfStructure");
      const bosFallback = candles.length > 0 ? candles[candles.length - 1].time : (bos.pivotTime ?? 0);
      // firstCloseBelow — hier bricht ein protected-low durch einen Kerzenschluss DRUNTER,
      // spiegelbildlich zur BOS-Linie des bärischen Nested-Trackers oben.
      const bosEndTime = firstCloseBelow(candles, bos.pivotTime ?? 0, bos.price, bosFallback);
      const bosLevel = { price: bos.price, pivotTime: bos.pivotTime ?? 0, endTime: bosEndTime };
      const line = new LiquidityLinePrimitive(
        bosLevel,
        { color: bosColor, lineWidth: lineWidth("rangeBreakOfStructure"), dashed: true, label: "BOS", labelSide: "center-above" },
        candles,
      );
      series.attachPrimitive(line);
      existingPrimitives.push(line);
    }

    // CHoCH-Label an der URSPRÜNGLICHEN Nested-Origin-High (appliedPivots[1] — advanceNestedTrend
    // seedet den bullischen Nested-Tracker via initMarketStructureState(originLow, highPivot),
    // appliedPivots[0]/[1] sind damit garantiert Low/High des Ursprungs), NICHT am aktuellen
    // currRange.high (das ist der zuletzt brechende Pivot, siehe Begründung oben, gespiegelt).
    const chochAnchor = nested.appliedPivots[1];
    // firstCloseAbove statt firstCloseBelow — hier endet die Linie an der ERSTEN tatsächlich über
    // chochAnchor.price schließenden Kerze, spiegelbildlich zum bärischen Pendant oben.
    const chochEndTime = firstCloseAbove(candles, chochAnchor.pivotTime ?? 0, chochAnchor.price, pivotTimeOf(nested.firstConfirmedAt!));
    const chochLevel = { price: chochAnchor.price, pivotTime: chochAnchor.pivotTime ?? 0, endTime: chochEndTime };
    const chochLine = new LiquidityLinePrimitive(
      chochLevel,
      { color: cssColor("rangeChoch"), lineWidth: lineWidth("rangeChoch"), dashed: true, label: "CHoCH", labelSide: "center-above" },
      candles,
    );
    series.attachPrimitive(chochLine);
    existingPrimitives.push(chochLine);
  }

  // Fib-Level (Chat 2026-07-30, siehe computeFibLevels für die volle Begründung) — EIN Durchlauf
  // für Haupttrend UND Nested-Trend statt eines eigenen Blocks pro Ebene (beide sind derselbe
  // MarketStructureState-Typ). Range-Fib nur als Tick (die Verbindungslinie low<->high existiert
  // schon, siehe rangeClosed/rangeChoch-Linien oben); Protected-Fib zusätzlich als gestrichelte
  // Zickzack-Linie PP<->gegenüberliegende Range-Kante, weil es diese Linie (anders als bei
  // Range-Fib) noch nirgends gibt.
  const fibColor = cssColor("rangeFib");
  const fibWidth = lineWidth("rangeFib");
  for (const level of [state, state.nestedTrend]) {
    if (!level || level.trend === "unknown") continue;
    const { rangeFib, protectedFib } = computeFibLevels(level);

    const rangeTick = new FibTickPrimitive(rangeFib, { color: fibColor, lineWidth: fibWidth });
    series.attachPrimitive(rangeTick);
    existingPrimitives.push(rangeTick);

    if (protectedFib) {
      const zigzag = new RangeLinePrimitive([protectedFib.a, protectedFib.b], { color: fibColor, lineWidth: fibWidth, dashed: true });
      series.attachPrimitive(zigzag);
      existingPrimitives.push(zigzag);

      const protectedTick = new FibTickPrimitive(protectedFib, { color: fibColor, lineWidth: fibWidth });
      series.attachPrimitive(protectedTick);
      existingPrimitives.push(protectedTick);
    }
  }
}
