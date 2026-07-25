import { LiquidityLinePrimitive, detectLiquidityLevels } from "./liquidity.js";
import { cssColor } from "./chartColors.js";
import { lineWidth } from "./chartLineWidths.js";
import { businessSecondsBetween, formatAge } from "./chartTimeUtils.js";
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
    const qualifyingPullbacks = [...structurePivots, ...innerStructurePivots].filter(
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
  const qualifyingPullbacks = [...structurePivots, ...innerStructurePivots].filter(
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
// NICHT implementiert: die spiegelbildliche Downtrend-Bestätigung (neues Low bricht currRange.low
// mit genug nachträglichen Pullback-Highs in der Struktur) — dafür gibt es noch kein Beispiel in
// tdd_mit_claude.ts, also bewusst offen gelassen statt geraten (wie beim alten trendZigzag.ts:
// "STOPP, schreib den algo erst mal bis hier und nicht weiter").
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
function applyMarketStructurePivotCore(
  state: MarketStructureState,
  pivot: Pivot,
  { candles = [], direction = "up" }: { candles?: Candle[]; direction?: TrendDirection },
): MarketStructureState {
  const { currRange, innerStructurePivots, appliedPivots } = state;
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
  const structurePivots = markLqSweeps(migratedStructurePivots, candles, latestKnownTime(candles, pivot), direction);

  if (direction === "up") {
    if (pivot.type === "low" && pivot.price < currRange.low.price) {
      return {
        ...state,
        currRange: { ...currRange, low: { ...pivot, type: "low" } },
        structurePivots,
        innerStructurePivots: [],
        appliedPivots: nextAppliedPivots,
      };
    }

    if (pivot.type === "high" && pivot.price > currRange.high.price) {
      const confirmed = tryConfirmTrend({ ...state, structurePivots }, pivot, direction);
      if (confirmed) {
        return { ...confirmed, innerStructurePivots: [], appliedPivots: nextAppliedPivots };
      }
      return {
        ...state,
        currRange: { ...currRange, high: { ...pivot, type: "high" } },
        structurePivots,
        innerStructurePivots: [],
        appliedPivots: nextAppliedPivots,
      };
    }
  } else {
    // Gespiegelt: 'high' weitet nur aus (erkundende Seite), 'low' bricht/bestätigt (siehe
    // tryConfirmTrend direction="down").
    if (pivot.type === "high" && pivot.price > currRange.high.price) {
      return {
        ...state,
        currRange: { ...currRange, high: { ...pivot, type: "high" } },
        structurePivots,
        innerStructurePivots: [],
        appliedPivots: nextAppliedPivots,
      };
    }

    if (pivot.type === "low" && pivot.price < currRange.low.price) {
      const confirmed = tryConfirmTrend({ ...state, structurePivots }, pivot, direction);
      if (confirmed) {
        return { ...confirmed, innerStructurePivots: [], appliedPivots: nextAppliedPivots };
      }
      return {
        ...state,
        currRange: { ...currRange, low: { ...pivot, type: "low" } },
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

// Öffentlicher Einstiegspunkt: wickelt applyMarketStructurePivotCore ein und stößt danach — NUR für
// direction="up", also den Haupttrend — den Nested-Gegentrend-Tracker an (advanceNestedTrend,
// CHoCH-Erkennung, Chat 2026-07-25). Der Nested-Tracker selbst wird intern mit direction="down"
// wieder über applyMarketStructurePivot gefüttert (siehe advanceNestedTrend) — der direction==="down"-
// Zweig hier überspringt daher advanceNestedTrend bewusst, sonst würde jede Ebene eine eigene
// Nested-Ebene aufspannen (unendliche Verschachtelung). Dieser Wrapper ist bewusst die einzige
// öffentliche Stelle, damit direkte Testaufrufe (wie überall sonst in diesem Modul üblich) genauso
// automatisch einen Nested-Tracker mitführen wie der eigentliche buildMarketStructureState-Fold.
export function applyMarketStructurePivot(
  state: MarketStructureState,
  pivot: Pivot,
  { candles = [], direction = "up" }: { candles?: Candle[]; direction?: TrendDirection } = {},
): MarketStructureState {
  const result = applyMarketStructurePivotCore(state, pivot, { candles, direction });
  if (direction === "down") return result;
  return advanceNestedTrend(result, pivot, candles);
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
// NICHT implementiert bleibt weiterhin die eigentliche Downtrend-BESTÄTIGUNG (ein "protected-high"
// als Pendant zum protected-low, siehe marketStructureAnalysis.rules.md) — 'break-of-structure'
// ist nur ein Warnsignal, kein Trendwechsel.
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
function markLqSweeps(structurePivots: Pivot[], candles: Candle[], toTime: number, direction: TrendDirection = "up"): Pivot[] {
  const baseType: "low" | "high" = direction === "up" ? "low" : "high";
  const protectedType: "protected-low" | "protected-high" = direction === "up" ? "protected-low" : "protected-high";
  const closesPastLevel = direction === "up" ? closesBelowLevel : closesAboveLevel;
  return structurePivots.map((p) => {
    if ((p.type !== baseType && p.type !== "LQ-sweep" && p.type !== protectedType) || isUntouchedAsOf(p, toTime)) return p;
    const brokenPast = closesPastLevel(candles, pivotTimeOf(p), toTime, p.price);
    if (brokenPast) {
      if (p.type === protectedType) return { ...p, type: "break-of-structure" as const };
      return p.type === baseType ? p : { ...p, type: baseType };
    }
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
// NICHT implementiert: die eigentliche Downtrend-BESTÄTIGUNG (ein "protected-high" als Pendant zum
// protected-low, sobald sich nach diesem Reset eine neue tiefere Struktur bestätigt) — das hier ist
// nur die Invalidierung des alten Uptrends, nicht der Start einer symmetrischen Downtrend-Logik.
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
  { candles = [], direction = "up" }: { candles?: Candle[]; direction?: TrendDirection },
): MarketStructureState {
  const sweepChecked = { ...state, structurePivots: markLqSweeps(state.structurePivots, candles, latestKnownTime(candles, pivot), direction) };
  const { currRange, innerStructurePivots, trend } = sweepChecked;

  if (direction === "up") {
    if (pivot.type === "high" && pivot.price > currRange.high.price) {
      const isRealBreak = closesAboveOldHigh(candles, pivotTimeOf(currRange.high), pivotTimeOf(pivot), currRange.high.price);

      if (isRealBreak) {
        const confirmed = tryConfirmTrend(sweepChecked, pivot, direction);
        if (confirmed) {
          return { ...confirmed, innerStructurePivots: [...confirmed.innerStructurePivots, pivot] };
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
      const isRealBreak = closesBelowLevel(candles, pivotTimeOf(currRange.low), pivotTimeOf(pivot), currRange.low.price);

      if (isRealBreak) {
        // Ein bereits BESTÄTIGTER Uptrend bricht komplett, sobald eine Kerze wirklich unter
        // currRange.low schließt (Philip: "der uptrend ist komplett gebrochen, trend = unknown...
        // wenn der uptrend gebrochen ist, soll der algo von vorne anfangen").
        if (trend === "uptrend") {
          // PROMOTION (Chat 2026-07-25): läuft bereits ein per Nested-Tracker bestätigter Gegentrend
          // (CHoCH, siehe advanceNestedTrend), übernimmt DER als neuer Outer-Trend, statt komplett
          // bei Null neu zu starten — die Vorlaufzeit (structurePivots/protected-high) bleibt damit
          // erhalten. Die alte Uptrend-Range wird für die Darstellung archiviert (closedRanges,
          // einfache Linie range.low -> range.high, kein Zigzag).
          if (sweepChecked.nestedTrend?.trend === "downtrend") {
            const nested = sweepChecked.nestedTrend;
            return {
              trend: "downtrend",
              currRange: nested.currRange,
              structurePivots: nested.structurePivots,
              innerStructurePivots: [],
              appliedPivots: nested.appliedPivots,
              nestedTrend: null,
              closedRanges: [...sweepChecked.closedRanges, { low: currRange.low, high: currRange.high, trend: "uptrend" }],
              firstConfirmedAt: nested.firstConfirmedAt,
            };
          }
          // Kein bestätigter Gegentrend vorhanden -> wie bisher kompletter Reset auf 'unknown', kein
          // direkter Sprung zu 'downtrend', genau wie ein frischer Start auch erstmal 'unknown' ist.
          // Der alte currRange.high wird als neuer Origin-High WEITERVERWENDET statt verworfen — er
          // liegt zeitlich vor dem neuen Origin-Low (dem gerade brechenden Pivot), was genau die
          // gespiegelte Eligibility-Bedingung zum Uptrend ist (dort: High NACH Low = bullisch; hier:
          // High VOR Low = bärisch, siehe Philip: "ergo es geht tendenz nach unten").
          const newOriginHigh: PivotHigh = { ...currRange.high, type: "high" };
          const newOriginLow: PivotLow = { ...pivot, type: "low" };
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
        // Uptrend noch nicht bestätigt -> es gibt nichts zu invalidieren, currRange.low wird
        // stattdessen einfach ausgeweitet (spiegelbildlich zum unconfirmed Low-Bruch in
        // applyMarketStructurePivot — reine Erkundung, kein Bruch von etwas Bestätigtem).
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
    // Gespiegelt: 'low' bestätigt/bricht (tryConfirmTrend), 'high' ist die Invalidierungs-Seite.
    if (pivot.type === "low" && pivot.price < currRange.low.price) {
      const isRealBreak = closesBelowLevel(candles, pivotTimeOf(currRange.low), pivotTimeOf(pivot), currRange.low.price);

      if (isRealBreak) {
        const confirmed = tryConfirmTrend(sweepChecked, pivot, direction);
        if (confirmed) {
          return { ...confirmed, innerStructurePivots: [...confirmed.innerStructurePivots, pivot] };
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
      const isRealBreak = closesAboveOldHigh(candles, pivotTimeOf(currRange.high), pivotTimeOf(pivot), currRange.high.price);

      if (isRealBreak) {
        if (trend === "downtrend") {
          // Nested-Invalidierung (gespiegelt zur Promotion-Prüfung oben) — OHNE Promotion, siehe
          // Funktionskommentar: startet einfach frisch vom neuen (widerlegenden) High. Der alte
          // currRange.low wird als neuer Origin-Low WEITERVERWENDET (bullische Origin-Konstellation:
          // Low VOR High, spiegelbildlich zu "High VOR Low = bärisch" oben). initMarketStructureState
          // reicht hier (statt Handbau wie oben), weil ein Nested-Tracker nie eigene closedRanges
          // ansammelt (appliedPivots[1]=Low bleibt dabei exakt dieselbe Konvention wie beim Seeden
          // in advanceNestedTrend).
          const newOriginLow: PivotLow = { ...currRange.low, type: "low" };
          const newOriginHigh: PivotHigh = { ...pivot, type: "high" };
          return initMarketStructureState(newOriginHigh, newOriginLow);
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
// applyInnerMarketStructurePivotCore ein und stößt danach — NUR für direction="up" — auch den
// Nested-Tracker mit demselben (Periode-2-)Pivot an (advanceNestedTrendInner). direction="down"
// (der Nested-Tracker selbst) überspringt das bewusst, sonst würde jede Ebene eine eigene
// Nested-Ebene aufspannen.
export function applyInnerMarketStructurePivot(
  state: MarketStructureState,
  pivot: Pivot,
  { candles = [], direction = "up" }: { candles?: Candle[]; direction?: TrendDirection } = {},
): MarketStructureState {
  const result = applyInnerMarketStructurePivotCore(state, pivot, { candles, direction });
  if (direction === "down") return result;
  return advanceNestedTrendInner(result, pivot, candles);
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

// CHoCH-Erkennung (Chat 2026-07-25): läuft NUR über Outer-(Periode-5-)Pivots — im Live-Beispiel des
// Nutzers sind 1.35583/1.35206/1.35429/1.34601 alles Periode-5-Pivots, keine Periode-2-Verfeinerung
// (das wäre ein möglicher späterer Ausbau, analog zur bestehenden innerStructurePivots-Idee, aber
// bewusst jetzt nicht gebaut). Wird aus buildMarketStructureState direkt nach jedem
// applyMarketStructurePivot-Aufruf angestoßen, NUR wenn der Haupttrend bereits 'uptrend' ist —
// ohne bestätigten Haupttrend gibt es nichts, wovon sich ein Gegentrend abheben könnte.
//
// Die AKTUELLE currRange.high ist IMMER der einzig gültige Ursprung, unabhängig davon, ob der
// Nested-Tracker schon bestätigt ist oder nicht: ein neues HH macht einen zuvor getrackten
// Gegentrend-Kandidaten komplett irrelevant (reseeded auf null, bis der nächste Pullback-Low als
// neuer Pairing-Punkt eintrifft — genau wie initMarketStructureState oben auch ein Pivot-Paar
// braucht, bevor ein State existieren kann). Das gilt SEIT Chat 2026-07-25 (Bug-Report Philip:
// "Choch Linie immernoch zu weit") explizit AUCH für einen bereits bestätigten (trend:'downtrend')
// Nested-Tracker: bricht der Haupttrend nach der CHoCH-Bestätigung noch ein weiteres, ECHTES neues
// Hoch (widerspricht der Lower-High-Prämisse, auf der die Bestätigung beruhte), war der CHoCH
// falsch/überholt — vorher blieb ein solcher bereits bestätigter, aber längst nicht mehr gültiger
// Nested-Tracker für den kompletten Rest der Uptrend-Laufzeit stehen (nie reseeded, da die
// Bestätigung selbst das Reseeden bis dahin blockierte), was in echten Daten zu einer über sehr
// viele Kerzen hinweg gezogenen CHoCH-Linie führte.
function advanceNestedTrend(state: MarketStructureState, outerPivot: Pivot, candles: Candle[]): MarketStructureState {
  if (state.trend !== "uptrend") return { ...state, nestedTrend: null };

  const nested = state.nestedTrend;
  const originHigh: PivotHigh = { ...state.currRange.high, type: "high" };
  const isStale = nested != null && pivotTimeOf(nested.appliedPivots[0]) !== pivotTimeOf(originHigh);

  if (nested == null || isStale) {
    // Noch kein Pullback-Low seit dem (neuen) Origin-High gesehen -> abwarten, nicht raten.
    if (outerPivot.type !== "low") return { ...state, nestedTrend: null };
    return { ...state, nestedTrend: initMarketStructureState(originHigh, { ...outerPivot, type: "low" }) };
  }

  return { ...state, nestedTrend: applyMarketStructurePivot(nested, outerPivot, { candles, direction: "down" }) };
}

// Periode-2-Pendant zu advanceNestedTrend (Chat 2026-07-25, zweite CHoCH-Runde: "range.low vom
// nestedTrend sollte schon tiefer sein, ein innerPivot hat sich bereits gebildet" — der
// Nested-Tracker lief bis dahin NUR über Outer-Pivots, wodurch currRange.low sichtbar
// hinterherhinkte, sobald ein Periode-2-Pivot schon tiefer stand). Reseeded NICHT selbst — das
// bleibt exklusiv Sache von advanceNestedTrend/Outer-Pivots, weil der Ursprung
// (appliedPivots[0]) immer ein Outer-High ist — läuft nur, wenn bereits ein Nested-Tracker
// existiert, und verfeinert ihn genauso, wie Periode-2 den Haupttrend verfeinert.
function advanceNestedTrendInner(state: MarketStructureState, innerPivot: Pivot, candles: Candle[]): MarketStructureState {
  if (state.trend !== "uptrend" || !state.nestedTrend) return state;
  return { ...state, nestedTrend: applyInnerMarketStructurePivot(state.nestedTrend, innerPivot, { candles, direction: "down" }) };
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
    state = entry.outer ? applyMarketStructurePivot(state, entry.pivot, { candles }) : applyInnerMarketStructurePivot(state, entry.pivot, { candles });
  }
  return state;
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

// Gerade Linie zwischen zwei beliebigen (Zeit, Preis)-Punkten — für die abgeschlossene Range nach
// einer Promotion (Chat 2026-07-25: "nur ne Linie, kein Zigzack"). LiquidityLinePrimitive (siehe
// liquidity.js) zeichnet nur horizontale Preis-Level, keine Diagonalen zwischen zwei
// unterschiedlichen Preisen — deshalb eine eigene, kleine Primitive nach demselben Muster wie
// ArrowPrimitive oben (attached/paneViews/Renderer mit useBitmapCoordinateSpace).
class RangeLineRenderer {
  private _p1: any;
  private _p2: any;
  private _options: any;

  constructor(p1: any, p2: any, options: any) {
    this._p1 = p1;
    this._p2 = p2;
    this._options = options;
  }

  draw(target: any) {
    const { _p1: p1, _p2: p2 } = this;
    if (p1.x === null || p1.y === null || p2.x === null || p2.y === null) return;

    target.useBitmapCoordinateSpace((scope: any) => {
      const ctx = scope.context;
      ctx.strokeStyle = this._options.color;
      ctx.lineWidth = (this._options.lineWidth ?? 1) * scope.horizontalPixelRatio;
      ctx.beginPath();
      ctx.moveTo(p1.x * scope.horizontalPixelRatio, p1.y * scope.verticalPixelRatio);
      ctx.lineTo(p2.x * scope.horizontalPixelRatio, p2.y * scope.verticalPixelRatio);
      ctx.stroke();
    });
  }
}

class RangeLinePaneView {
  private _source: RangeLinePrimitive;
  private _p1: any;
  private _p2: any;

  constructor(source: RangeLinePrimitive) {
    this._source = source;
    this._p1 = { x: null, y: null };
    this._p2 = { x: null, y: null };
  }

  update() {
    const series = this._source._series;
    const timeScale = this._source._chart.timeScale();
    const { low, high } = this._source;
    this._p1 = { x: timeScale.timeToCoordinate(low.pivotTime), y: series.priceToCoordinate(low.price) };
    this._p2 = { x: timeScale.timeToCoordinate(high.pivotTime), y: series.priceToCoordinate(high.price) };
  }

  renderer() {
    return new RangeLineRenderer(this._p1, this._p2, this._source._options);
  }
}

class RangeLinePrimitive {
  low: Pivot;
  high: Pivot;
  _options: { color: string; lineWidth?: number };
  _paneViews: RangeLinePaneView[];
  _chart: any;
  _series: any;

  constructor(low: Pivot, high: Pivot, options: { color: string; lineWidth?: number }) {
    this.low = low;
    this.high = high;
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

// Linienstärke ist seit Chat 2026-07-25 im Style-Modal konfigurierbar, EIN Wert PRO Farb-Key
// (rangeHigh/rangeLow/rangeProtectedLow/rangeLqSweep/rangeBreakOfStructure/rangeClosed/rangeChoch —
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

// " (1d 3h alt)" hinter einem Label, oder "" ohne pivotTime/nowSec (Chat 2026-07-22: "bei den
// relevanten LQ-Leveln das Alter anzeigen ... Wochenende nicht mitzählen", 2026-07-22 zweite Runde:
// "bitte noch bei structure bei 1h LQ-Sweep dazutun") — dieselbe Formel wie im TSC/den
// Liquiditäts-Debug-Labels (tradeSetupCockpit.ts/liquidity.js), hier noch mal separat, weil jede
// Datei ihre eigene, leicht andere Label-Bau-Stelle hat.
function ageSuffix(pivotTime: number | undefined, nowSec: number | undefined): string {
  if (pivotTime == null || nowSec == null) return "";
  const age = formatAge(businessSecondsBetween(pivotTime, nowSec));
  return age ? ` (${age} alt)` : "";
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
  { nowSec }: { nowSec?: number } = {},
) {
  for (const p of existingPrimitives) series.detachPrimitive(p);
  existingPrimitives.length = 0;
  if (!state || candles.length === 0) return;

  const hasBreakOfStructure = state.structurePivots.some((p) => p.type === "break-of-structure");

  const highColor = cssColor("rangeHigh");
  const lowColor = cssColor("rangeLow");
  // Gestrichelt statt durchgezogen, solange range.high/low nur "sweeped" ist (Docht durchbrochen,
  // aber noch keine Kerze drüber/drunter geschlossen -> kein bestätigter Bruch, siehe Chat
  // 2026-07-19) — ODER sobald irgendwo ein Break of Structure steht (Schwäche-Signal, unabhängig
  // vom sweeped-low-Zustand von range.low selbst). Dreieck (ArrowPrimitive) bleibt unverändert —
  // nur die Linie ändert sich.
  const highDashed = state.currRange.high.type === "sweeped-high";
  const lowDashed = state.currRange.low.type === "sweeped-low" || hasBreakOfStructure;
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
  // rot: unter der Linie, zeigt nach oben; grün: über der Linie, zeigt nach unten (siehe Chat).
  // Der grüne range.low-Pfeil fällt bei einem Break of Structure weg (siehe oben) — die Linie
  // bleibt trotzdem stehen, nur ohne die "hier long suchen"-Andeutung.
  const highArrow = new ArrowPrimitive(state.currRange.high, { color: highColor, direction: "up" }, candles);
  const primitives = [highLine, lowLine, highArrow];
  if (!hasBreakOfStructure) {
    primitives.push(new ArrowPrimitive(state.currRange.low, { color: lowColor, direction: "down" }, candles));
  }
  for (const primitive of primitives) {
    series.attachPrimitive(primitive);
    existingPrimitives.push(primitive);
  }

  const protectedLow = state.structurePivots.find((p) => p.type === "protected-low");
  if (protectedLow) {
    const line = new LiquidityLinePrimitive(
      toLevel(protectedLow, candles),
      { color: cssColor("rangeProtectedLow"), lineWidth: lineWidth("rangeProtectedLow"), label: "1h protected low", labelSide: "end" },
      candles,
    );
    series.attachPrimitive(line);
    existingPrimitives.push(line);
  }

  // Goldene Linie + Pfeil je LQ-Sweep (siehe Chat 2026-07-19: "GOLDENE Linie ... mit dem label '1h
  // LQ-Sweep'", und Chat 2026-07-20: "noch mit nem goldenen Pfeil nach oben") — anders als
  // protected-low (immer nur der jeweils jüngste) potenziell mehrere gleichzeitig, deshalb hier
  // eine Linie (+ ggf. Pfeil) PRO markiertem structurePivot statt nur die erste. Pfeil zeigt IMMER
  // nach oben (direction: "down" löst laut ArrowRenderer den nach-oben-zeigenden Zweig aus, siehe
  // dortiger Kommentar) — ein LQ-Sweep ist per Definition bullisch (gesweepter Low, der hält).
  // Downtrend (Pfeil nach unten) noch nicht implementiert, siehe Trend-Logik oben. Seit Chat
  // 2026-07-24 nur noch 1px breit (LQ_SWEEP_LINE_WIDTH) und OHNE Pfeil, sobald ein Break of
  // Structure existiert — der Long-Gedanke dahinter gilt dann nicht mehr, die Linie bleibt aber
  // als reine Information stehen.
  for (const lqSweep of state.structurePivots.filter((p) => p.type === "LQ-sweep")) {
    const lqColor = cssColor("rangeLqSweep");
    const line = new LiquidityLinePrimitive(
      toLevel(lqSweep, candles),
      { color: lqColor, lineWidth: lineWidth("rangeLqSweep"), label: `1h LQ-Sweep${ageSuffix(lqSweep.pivotTime, nowSec)}`, labelSide: "end" },
      candles,
    );
    series.attachPrimitive(line);
    existingPrimitives.push(line);
    if (!hasBreakOfStructure) {
      const arrow = new ArrowPrimitive(lqSweep, { color: lqColor, direction: "down" }, candles);
      series.attachPrimitive(arrow);
      existingPrimitives.push(arrow);
    }
  }

  // Gestrichelte rote Linie + Beschriftung je Break of Structure (Chat 2026-07-24) — analog zu
  // LQ-Sweep potenziell mehrere gleichzeitig (jedes gebrochene protected-low bekommt seine
  // eigene), kein eigener Pfeil (reines Warnsignal, keine Handelsrichtung wie bei LQ-Sweep). Label
  // nur "BOS" (kein Alter — anders als bei LQ-Sweep für die Handelsentscheidung nicht relevant,
  // siehe Chat), mittig über der Linie im Uptrend, mittig darunter im (noch nicht implementierten)
  // Downtrend — spiegelbildlich zur Trendrichtung.
  for (const bos of state.structurePivots.filter((p) => p.type === "break-of-structure")) {
    const bosColor = cssColor("rangeBreakOfStructure");
    const line = new LiquidityLinePrimitive(
      toLevel(bos, candles),
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
  // Trendrichtung (grün bullisch, wie rangeClosed; rot bärisch, wie rangeChoch — nach einer
  // Promotion ist state.trend dann selbst 'downtrend').
  if (state.trend !== "unknown") {
    const liveLineKey = state.trend === "uptrend" ? "rangeClosed" : "rangeChoch";
    const liveLine = new RangeLinePrimitive(state.currRange.low, state.currRange.high, {
      color: cssColor(liveLineKey),
      lineWidth: lineWidth(liveLineKey),
    });
    series.attachPrimitive(liveLine);
    existingPrimitives.push(liveLine);
  }

  // Abgeschlossene Ranges (Chat 2026-07-25, Promotion bei Trend-Invalidierung mit bereits
  // bestätigtem Nested-Trend) — einfache Linie range.low -> range.high, kein Zigzag (bewusst so
  // gewünscht: "wie du es umsetzt ist mir egal").
  for (const closed of state.closedRanges) {
    const line = new RangeLinePrimitive(closed.low, closed.high, { color: cssColor("rangeClosed"), lineWidth: lineWidth("rangeClosed") });
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
    const nestedLine = new RangeLinePrimitive(nested.currRange.low, nested.currRange.high, {
      color: cssColor("rangeChoch"),
      lineWidth: lineWidth("rangeChoch"),
    });
    series.attachPrimitive(nestedLine);
    existingPrimitives.push(nestedLine);

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
}
