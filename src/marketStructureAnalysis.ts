import { LiquidityLinePrimitive, detectLiquidityLevels } from "./liquidity.js";
import { cssColor } from "./chartColors.js";
import { businessSecondsBetween, formatAge } from "./chartTimeUtils.js";
import type { Pivot, PivotHigh, PivotLow, MarketStructureState } from "./range.type";

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
function tryConfirmUptrend(state: MarketStructureState, breakingPivot: Pivot): MarketStructureState | null {
  const { currRange, structurePivots, innerStructurePivots, trend } = state;
  // Die Eligibility-Prüfung (Origin-High muss NACH Origin-Low liegen) betrifft nur die ALLERERSTE
  // Bestätigung — einmal bestätigt, ist currRange.high per Konstruktion immer schon ein gültiger,
  // späterer Bruch, die Prüfung wäre hier bedeutungslos (und potenziell falsch, siehe unten).
  const highTime = pivotTimeOf(currRange.high);
  if (trend === "unknown" && highTime <= pivotTimeOf(currRange.low)) return null; // nicht eligible

  const advancedRange = { ...currRange, high: { ...breakingPivot, type: "high" as const } };
  const confirmationMoment = pivotTimeOf(breakingPivot);
  const qualifyingPullbacks = [...structurePivots, ...innerStructurePivots].filter(
    (p) => (p.type === "low" || p.type === "LQ-sweep") && pivotTimeOf(p) > highTime && isUntouchedAsOf(p, confirmationMoment),
  );
  if (qualifyingPullbacks.length === 0) {
    // Schon bestätigt, aber kein neuerer Kandidat seit dem letzten High -> nichts zum Weiterrücken,
    // trotzdem ganz normal den Bruch übernehmen (dieselbe Rolle wie der alte "sonst nur High
    // ersetzen"-Fallback in applyMarketStructurePivot/applyInnerMarketStructurePivot).
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
export function applyMarketStructurePivot(state: MarketStructureState, pivot: Pivot, { candles = [] }: { candles?: Candle[] } = {}): MarketStructureState {
  const { currRange, innerStructurePivots, appliedPivots } = state;
  const nextAppliedPivots = [...appliedPivots, pivot];
  // Ein per applyInnerMarketStructurePivot zu 'protected-low' reklassifizierter eingebetteter Pivot
  // würde durch das innerStructurePivots:[] unten sonst sofort wieder verschwinden (Chat 2026-07-23:
  // "protected low verschwindet" — jeder übergeordnete Pivot räumt die eingebettete Struktur weg,
  // unabhängig von seinem eigenen Typ). Erst nach structurePivots migrieren, DANN leeren — auf allen
  // drei Zweigen unten, nicht nur beim Bestätigungsfall, weil auch ein simpler Pullback oder ein
  // Low-Bruch die eingebettete Struktur genauso wegräumt. markLqSweeps läuft danach genau wie auf
  // der Periode-2-Seite (siehe applyInnerMarketStructurePivot), unabhängig davon, was DIESER Pivot
  // selbst bricht — ein LQ-sweep/break-of-structure kann durch jede neue Kerze bestätigt werden.
  const migratedStructurePivots = [...state.structurePivots, ...innerStructurePivots.filter((p) => p.type === "protected-low")];
  const structurePivots = markLqSweeps(migratedStructurePivots, candles, latestKnownTime(candles, pivot));

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
    const confirmed = tryConfirmUptrend({ ...state, structurePivots }, pivot);
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

  return {
    ...state,
    structurePivots: [...structurePivots, pivot],
    innerStructurePivots: [],
    appliedPivots: nextAppliedPivots,
  };
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
function markLqSweeps(structurePivots: Pivot[], candles: Candle[], toTime: number): Pivot[] {
  return structurePivots.map((p) => {
    if ((p.type !== "low" && p.type !== "LQ-sweep" && p.type !== "protected-low") || isUntouchedAsOf(p, toTime)) return p;
    const closedBelow = closesBelowLevel(candles, pivotTimeOf(p), toTime, p.price);
    if (closedBelow) {
      if (p.type === "protected-low") return { ...p, type: "break-of-structure" as const };
      return p.type === "low" ? p : { ...p, type: "low" as const };
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
export function applyInnerMarketStructurePivot(
  state: MarketStructureState,
  pivot: Pivot,
  { candles = [] }: { candles?: Candle[] } = {},
): MarketStructureState {
  const sweepChecked = { ...state, structurePivots: markLqSweeps(state.structurePivots, candles, latestKnownTime(candles, pivot)) };
  const { currRange, innerStructurePivots, trend } = sweepChecked;

  if (pivot.type === "high" && pivot.price > currRange.high.price) {
    const isRealBreak = closesAboveOldHigh(candles, pivotTimeOf(currRange.high), pivotTimeOf(pivot), currRange.high.price);

    if (isRealBreak) {
      const confirmed = tryConfirmUptrend(sweepChecked, pivot);
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
      // wenn der uptrend gebrochen ist, soll der algo von vorne anfangen") — kein direkter Sprung
      // zu 'downtrend', genau wie ein frischer Start auch erstmal 'unknown' ist, bis genug
      // Struktur eine Richtung bestätigt (Downtrend-Bestätigung selbst: siehe unten, noch offen).
      // Der alte currRange.high wird als neuer Origin-High WEITERVERWENDET statt verworfen — er
      // liegt zeitlich vor dem neuen Origin-Low (dem gerade brechenden Pivot), was genau die
      // gespiegelte Eligibility-Bedingung zum Uptrend ist (dort: High NACH Low = bullisch; hier:
      // High VOR Low = bärisch, siehe Philip: "ergo es geht tendenz nach unten").
      if (trend === "uptrend") {
        const newOriginHigh: PivotHigh = { ...currRange.high, type: "high" };
        const newOriginLow: PivotLow = { ...pivot, type: "low" };
        return {
          trend: "unknown",
          currRange: { high: newOriginHigh, low: newOriginLow },
          structurePivots: [],
          innerStructurePivots: [],
          appliedPivots: [newOriginHigh, newOriginLow],
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

  return { ...sweepChecked, innerStructurePivots: [...innerStructurePivots, pivot] };
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

const LINE_WIDTH = 2;
// Dünner als die übrigen Linien (Chat 2026-07-24: "Linienstärke des 1h LQ Sweep auf 1px") — seit
// ein Break of Structure existiert, ist ein LQ-Sweep nur noch informativ (keine Long-Chance mehr,
// siehe hasBreakOfStructure unten), soll also optisch zurücktreten.
const LQ_SWEEP_LINE_WIDTH = 1;

function toLevel(pivot: Pivot, candles: Candle[]) {
  // Vereinfachung: Linie reicht immer bis zur letzten geladenen Kerze (nicht bis touchedAt-Zeit) —
  // für range.high/range.low/protected-low reicht das, weil sie per Definition der aktuell
  // gültige, unberührte Rand der Struktur sind (in Philips Beispiel sind alle drei `touched: false`).
  const endTime = candles.length > 0 ? candles[candles.length - 1].time : (pivot.pivotTime ?? 0);
  return { price: pivot.price, pivotTime: pivot.pivotTime ?? 0, endTime };
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
    { color: highColor, lineWidth: LINE_WIDTH, dashed: highDashed },
    candles,
  );
  const lowLine = new LiquidityLinePrimitive(
    toLevel(state.currRange.low, candles),
    { color: lowColor, lineWidth: LINE_WIDTH, dashed: lowDashed },
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
      { color: cssColor("rangeProtectedLow"), lineWidth: LINE_WIDTH, label: "1h protected low", labelSide: "end" },
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
      { color: lqColor, lineWidth: LQ_SWEEP_LINE_WIDTH, label: `1h LQ-Sweep${ageSuffix(lqSweep.pivotTime, nowSec)}`, labelSide: "end" },
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
  // eigene), kein eigener Pfeil (reines Warnsignal, keine Handelsrichtung wie bei LQ-Sweep).
  for (const bos of state.structurePivots.filter((p) => p.type === "break-of-structure")) {
    const bosColor = cssColor("rangeBreakOfStructure");
    const line = new LiquidityLinePrimitive(
      toLevel(bos, candles),
      { color: bosColor, lineWidth: LINE_WIDTH, dashed: true, label: `Break of Structure${ageSuffix(bos.pivotTime, nowSec)}`, labelSide: "end" },
      candles,
    );
    series.attachPrimitive(line);
    existingPrimitives.push(line);
  }
}
