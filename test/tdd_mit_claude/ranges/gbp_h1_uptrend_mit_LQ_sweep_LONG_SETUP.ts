import { Pivot, PivotHigh, PivotLow, RangeState } from "../../../src/range.type";

/** GBPUSD H1-Periode-5 Pivots ab 01.07.2026 10:00 bis 09.07.2026 12:00 (test/fixtures/gbpusd-h1-trend.json,
 * exakt wie detectLiquidityLevels/buildLevel in src/liquidity.js erkannt+getoucht) — etwas weiter gefasst
 * als gbp_h1_uptrend_mit_inner_structure.ts (dort ab 01.07. 15:00 bis 08.07. 16:00): pivot1..13 hier sind
 * bewusst identisch mit pivot1..13 dort (dieselbe Fraktal-Serie), zusätzlich pivot14/15 als Fortsetzung
 * Richtung LQ-Sweep-Long-Setup (siehe Chat 2026-07-19: "echt geiles Long-Setup", Alarm/Bling-Bling folgt
 * separat). */
const pivot1: PivotLow = { type: 'low', price: 1.32189, pivotAt: '01.07.2026 15:00', pivotTime: 1782910800, touched: false };
const pivot2: PivotHigh = { type: 'high', price: 1.32918, pivotAt: '01.07.2026 16:00', pivotTime: 1782914400, touched: { price: 1.32918, touchedAt: '02.07.2026 04:00' } };
const pivot3: PivotLow = { type: 'low', price: 1.32635, pivotAt: '01.07.2026 23:00', pivotTime: 1782939600, touched: false };
const pivot4: PivotLow = { type: 'low', price: 1.32972, pivotAt: '02.07.2026 14:00', pivotTime: 1782993600, touched: false };
const pivot5: PivotHigh = { type: 'high', price: 1.33844, pivotAt: '02.07.2026 16:00', pivotTime: 1783000800, touched: { price: 1.33844, touchedAt: '06.07.2026 20:00' } };
const pivot6: PivotLow = { type: 'low', price: 1.33346, pivotAt: '03.07.2026 02:00', pivotTime: 1783036800, touched: { price: 1.33346, touchedAt: '06.07.2026 07:00' } };
const pivot7: PivotHigh = { type: 'high', price: 1.3381, pivotAt: '03.07.2026 08:00', pivotTime: 1783058400, touched: { price: 1.3381, touchedAt: '06.07.2026 19:00' } };
const pivot8: PivotLow = { type: 'low', price: 1.33459, pivotAt: '03.07.2026 15:00', pivotTime: 1783083600, touched: { price: 1.33459, touchedAt: '03.07.2026 22:00' } };
const pivot9: PivotLow = { type: 'low', price: 1.33286, pivotAt: '06.07.2026 09:00', pivotTime: 1783321200, touched: { price: 1.33286, touchedAt: '08.07.2026 11:00' } };
const pivot10: PivotHigh = { type: 'high', price: 1.34016, pivotAt: '07.07.2026 03:00', pivotTime: 1783386000, touched: { price: 1.34016, touchedAt: '08.07.2026 19:00' } };
const pivot11: PivotHigh = { type: 'high', price: 1.33941, pivotAt: '07.07.2026 13:00', pivotTime: 1783422000, touched: { price: 1.33941, touchedAt: '08.07.2026 19:00' } };
const pivot12: PivotLow = { type: 'low', price: 1.33421, pivotAt: '08.07.2026 03:00', pivotTime: 1783472400, touched: { price: 1.33421, touchedAt: '08.07.2026 10:00' } };
const pivot13: PivotLow = { type: 'low', price: 1.33222, pivotAt: '08.07.2026 11:00', pivotTime: 1783501200, touched: false };
const pivot14: PivotHigh = { type: 'high', price: 1.34103, pivotAt: '08.07.2026 19:00', pivotTime: 1783530000, touched: { price: 1.34103, touchedAt: '09.07.2026 08:00' } };
const pivot15: PivotHigh = { type: 'high', price: 1.34308, pivotAt: '09.07.2026 08:00', pivotTime: 1783576800, touched: { price: 1.34308, touchedAt: '10.07.2026 03:00' } };

/**
 * GBPUSD H1-Periode-2 Pivots (eingebettete Struktur) im selben Fenster, 01.07.2026 10:00 bis
 * 09.07.2026 12:00 — beachte: p2Pivot1 (Docht bei 11:00) liegt VOR pivot1 (Origin-Low bei 15:00),
 * ist also für die Range-Analyse selbst irrelevant (siehe computeRangeAnalysisState in
 * PriceChart.vue: nur p2Pivots NACH dem übergeordneten Origin-Paar zählen).
 */
const p2Pivot1: PivotHigh = { type: 'high', price: 1.32568, pivotAt: '01.07.2026 11:00', pivotTime: 1782896400, touched: { price: 1.32568, touchedAt: '01.07.2026 15:00' } };
const p2Pivot2: PivotLow = { type: 'low', price: 1.32189, pivotAt: '01.07.2026 15:00', pivotTime: 1782910800, touched: false };
const p2Pivot3: PivotHigh = { type: 'high', price: 1.32918, pivotAt: '01.07.2026 16:00', pivotTime: 1782914400, touched: { price: 1.32918, touchedAt: '02.07.2026 04:00' } };
const p2Pivot4: PivotLow = { type: 'low', price: 1.32635, pivotAt: '01.07.2026 23:00', pivotTime: 1782939600, touched: false };
const p2Pivot5: PivotHigh = { type: 'high', price: 1.32947, pivotAt: '02.07.2026 04:00', pivotTime: 1782957600, touched: { price: 1.32947, touchedAt: '02.07.2026 08:00' } };
const p2Pivot6: PivotHigh = { type: 'high', price: 1.33627, pivotAt: '02.07.2026 10:00', pivotTime: 1782979200, touched: { price: 1.33627, touchedAt: '02.07.2026 14:00' } };
const p2Pivot7: PivotLow = { type: 'low', price: 1.32972, pivotAt: '02.07.2026 14:00', pivotTime: 1782993600, touched: false };
const p2Pivot8: PivotHigh = { type: 'high', price: 1.33844, pivotAt: '02.07.2026 16:00', pivotTime: 1783000800, touched: { price: 1.33844, touchedAt: '06.07.2026 20:00' } };
const p2Pivot9: PivotLow = { type: 'low', price: 1.33379, pivotAt: '02.07.2026 19:00', pivotTime: 1783011600, touched: { price: 1.33379, touchedAt: '02.07.2026 23:00' } };
const p2Pivot10: PivotLow = { type: 'low', price: 1.33351, pivotAt: '02.07.2026 23:00', pivotTime: 1783026000, touched: { price: 1.33351, touchedAt: '03.07.2026 02:00' } };
const p2Pivot11: PivotLow = { type: 'low', price: 1.33346, pivotAt: '03.07.2026 02:00', pivotTime: 1783036800, touched: { price: 1.33346, touchedAt: '06.07.2026 07:00' } };
const p2Pivot12: PivotHigh = { type: 'high', price: 1.33663, pivotAt: '03.07.2026 04:00', pivotTime: 1783044000, touched: { price: 1.33663, touchedAt: '03.07.2026 07:00' } };
const p2Pivot13: PivotHigh = { type: 'high', price: 1.3381, pivotAt: '03.07.2026 08:00', pivotTime: 1783058400, touched: { price: 1.3381, touchedAt: '06.07.2026 19:00' } };
const p2Pivot14: PivotLow = { type: 'low', price: 1.33492, pivotAt: '03.07.2026 12:00', pivotTime: 1783072800, touched: { price: 1.33492, touchedAt: '03.07.2026 15:00' } };
const p2Pivot15: PivotHigh = { type: 'high', price: 1.33637, pivotAt: '03.07.2026 13:00', pivotTime: 1783076400, touched: { price: 1.33637, touchedAt: '06.07.2026 17:00' } };
const p2Pivot16: PivotLow = { type: 'low', price: 1.33459, pivotAt: '03.07.2026 15:00', pivotTime: 1783083600, touched: { price: 1.33459, touchedAt: '03.07.2026 22:00' } };
const p2Pivot17: PivotHigh = { type: 'high', price: 1.33582, pivotAt: '03.07.2026 19:00', pivotTime: 1783098000, touched: { price: 1.33582, touchedAt: '06.07.2026 16:00' } };
const p2Pivot18: PivotLow = { type: 'low', price: 1.33421, pivotAt: '05.07.2026 23:00', pivotTime: 1783285200, touched: { price: 1.33421, touchedAt: '06.07.2026 03:00' } };
const p2Pivot19: PivotHigh = { type: 'high', price: 1.33564, pivotAt: '06.07.2026 02:00', pivotTime: 1783296000, touched: { price: 1.33564, touchedAt: '06.07.2026 16:00' } };
const p2Pivot20: PivotLow = { type: 'low', price: 1.33392, pivotAt: '06.07.2026 04:00', pivotTime: 1783303200, touched: { price: 1.33392, touchedAt: '06.07.2026 07:00' } };
const p2Pivot21: PivotLow = { type: 'low', price: 1.33286, pivotAt: '06.07.2026 09:00', pivotTime: 1783321200, touched: { price: 1.33286, touchedAt: '08.07.2026 11:00' } };
const p2Pivot22: PivotHigh = { type: 'high', price: 1.33501, pivotAt: '06.07.2026 10:00', pivotTime: 1783324800, touched: { price: 1.33501, touchedAt: '06.07.2026 14:00' } };
const p2Pivot23: PivotHigh = { type: 'high', price: 1.33969, pivotAt: '06.07.2026 21:00', pivotTime: 1783364400, touched: { price: 1.33969, touchedAt: '07.07.2026 01:00' } };
const p2Pivot24: PivotLow = { type: 'low', price: 1.33816, pivotAt: '06.07.2026 23:00', pivotTime: 1783371600, touched: { price: 1.33816, touchedAt: '07.07.2026 07:00' } };
const p2Pivot25: PivotHigh = { type: 'high', price: 1.34016, pivotAt: '07.07.2026 03:00', pivotTime: 1783386000, touched: { price: 1.34016, touchedAt: '08.07.2026 19:00' } };
const p2Pivot26: PivotLow = { type: 'low', price: 1.33878, pivotAt: '07.07.2026 03:00', pivotTime: 1783386000, touched: { price: 1.33878, touchedAt: '07.07.2026 07:00' } };
const p2Pivot27: PivotLow = { type: 'low', price: 1.3375, pivotAt: '07.07.2026 09:00', pivotTime: 1783407600, touched: { price: 1.3375, touchedAt: '07.07.2026 12:00' } };
const p2Pivot28: PivotHigh = { type: 'high', price: 1.33938, pivotAt: '07.07.2026 10:00', pivotTime: 1783411200, touched: { price: 1.33938, touchedAt: '07.07.2026 13:00' } };
const p2Pivot29: PivotLow = { type: 'low', price: 1.33695, pivotAt: '07.07.2026 12:00', pivotTime: 1783418400, touched: { price: 1.33695, touchedAt: '07.07.2026 15:00' } };
const p2Pivot30: PivotHigh = { type: 'high', price: 1.33941, pivotAt: '07.07.2026 13:00', pivotTime: 1783422000, touched: { price: 1.33941, touchedAt: '08.07.2026 19:00' } };
const p2Pivot31: PivotLow = { type: 'low', price: 1.33609, pivotAt: '07.07.2026 16:00', pivotTime: 1783432800, touched: { price: 1.33609, touchedAt: '07.07.2026 20:00' } };
const p2Pivot32: PivotHigh = { type: 'high', price: 1.33761, pivotAt: '07.07.2026 20:00', pivotTime: 1783447200, touched: { price: 1.33761, touchedAt: '08.07.2026 15:00' } };
const p2Pivot33: PivotHigh = { type: 'high', price: 1.33552, pivotAt: '08.07.2026 02:00', pivotTime: 1783468800, touched: { price: 1.33552, touchedAt: '08.07.2026 05:00' } };
const p2Pivot34: PivotLow = { type: 'low', price: 1.33421, pivotAt: '08.07.2026 03:00', pivotTime: 1783472400, touched: { price: 1.33421, touchedAt: '08.07.2026 10:00' } };
const p2Pivot35: PivotHigh = { type: 'high', price: 1.33589, pivotAt: '08.07.2026 05:00', pivotTime: 1783479600, touched: { price: 1.33589, touchedAt: '08.07.2026 08:00' } };
const p2Pivot36: PivotHigh = { type: 'high', price: 1.337, pivotAt: '08.07.2026 10:00', pivotTime: 1783497600, touched: { price: 1.337, touchedAt: '08.07.2026 15:00' } };
const p2Pivot37: PivotLow = { type: 'low', price: 1.33222, pivotAt: '08.07.2026 11:00', pivotTime: 1783501200, touched: false };
const p2Pivot38: PivotHigh = { type: 'high', price: 1.33775, pivotAt: '08.07.2026 15:00', pivotTime: 1783515600, touched: { price: 1.33775, touchedAt: '08.07.2026 18:00' } };
const p2Pivot39: PivotHigh = { type: 'high', price: 1.34103, pivotAt: '08.07.2026 19:00', pivotTime: 1783530000, touched: { price: 1.34103, touchedAt: '09.07.2026 08:00' } };
const p2Pivot40: PivotLow = { type: 'low', price: 1.33804, pivotAt: '08.07.2026 23:00', pivotTime: 1783544400, touched: { price: 1.33804, touchedAt: '13.07.2026 00:00' } };
const p2Pivot41: PivotHigh = { type: 'high', price: 1.3404, pivotAt: '09.07.2026 02:00', pivotTime: 1783555200, touched: { price: 1.3404, touchedAt: '09.07.2026 07:00' } };
const p2Pivot42: PivotLow = { type: 'low', price: 1.33867, pivotAt: '09.07.2026 03:00', pivotTime: 1783558800, touched: { price: 1.33867, touchedAt: '09.07.2026 13:00' } };
const p2Pivot43: PivotHigh = { type: 'high', price: 1.34308, pivotAt: '09.07.2026 08:00', pivotTime: 1783576800, touched: { price: 1.34308, touchedAt: '10.07.2026 03:00' } };

/**
 * LOS GEHTS
 * Wir starten schon etwas später im Algo.
 * als letztes wurde pivot9 eingelesen
 */
// Mapping der kopierten Metadaten auf die oben deklarierten Konstanten (pivot1..pivot12).
// KORREKTUR (Claude, 2026-07-19): touched hier NICHT der volle Fixture-Endstand, sondern der
// tatsächliche Stand zum Zeitpunkt dieses States — der ursprünglich kopierte Live-JSON hatte das
// schon richtig (touched: false für pivot10/11), ich hatte das beim ersten Durchgang fälschlich
// als "Zeit-Clipping-Artefakt" verworfen und mit dem Endstand überschrieben. War falsch (siehe
// Chat: "Zum Startpunkt des Algos ist pivot9 doch untouched?"). rangeState1 liegt zeitlich direkt
// bei pivot12s Bestätigung (pivotTime + 5h = 08.07. 08:00) — zu diesem Zeitpunkt sind pivot9/10/11/12
// alle noch NICHT getoucht (ihr jeweiliges touchedAt liegt erst danach: 10:00/19:00/19:00/11:00).
// Nur pivot5/6/7/8 (touchedAt alle vor 06.07.) sind zu diesem Zeitpunkt schon korrekt getoucht.
//
// GEGENGECHECKT (Claude): pivot3 (nicht pivot4!) ist hier protected-low — das kann NICHT aus
// pivot1..pivot12 allein entstanden sein. applyRangePivot mit nur den Outer-Pivots pur durchlaufen
// liefert stattdessen pivot4 als protected-low (beide qualifizieren als Pullback nach pivot2, aber
// pivot4 liegt zeitlich näher an pivot5s Bruch -> "jüngster qualifizierender Pullback" siehe
// tryConfirmUptrend). Dass hier pivot3 gewählt wurde, beweist: der Uptrend wurde in Wirklichkeit
// schon FRÜHER bestätigt — über p2Pivot5 (eingebettet, Periode 2), bevor pivot4 (Periode 5) überhaupt
// gelesen war (genau wie in gbp_h1_uptrend_mit_inner_structure.ts: rangeState1_4). pivot4 kam danach
// nur noch als normaler Pullback dazu (tryConfirmUptrend bricht sofort ab, sobald trend !== 'unknown'
// ist), und pivot5/pivot10/... haben currRange.high seither nur noch ohne erneute Bestätigung
// weitergeschoben. Schöner Live-Beweis, dass die Outer/Inner-Verzahnung in PriceChart.vue
// (computeRangeAnalysisState) tatsächlich korrekt greift.
const rangeState1: RangeState = {
    trend: 'uptrend',
    currRange: {
        high: { ...pivot10, touched: false },
        low: pivot1,
    },
    structurePivots: [
        { ...pivot3, type: 'protected-low' },
        pivot4,
        pivot5,
        pivot6,
        pivot7,
        pivot8,
        { ...pivot9, touched: false },
        { ...pivot11, touched: false },
        { ...pivot12, touched: false },
    ],
    innerStructurePivots: [],
    appliedPivots: [
        pivot1,
        pivot2,
        pivot3,
        pivot4,
        pivot5,
        pivot6,
        pivot7,
        pivot8,
        { ...pivot9, touched: false },
        { ...pivot10, touched: false },
        { ...pivot11, touched: false },
        { ...pivot12, touched: false },
    ],
}
// zwei Schritte weiter: p2Pivot36 war schon, jetzt wurde p2Pivot37 erkannt
// pivot9 & pivot12 wurden GETOUCHED
/**
 * POTENTIELLER 1h bullischer LQ-Sweep & LONG TRADE MÖGLICH:
 * - wir stellen fest: keine der aktuellen Kerzen um p2Pivot37 herum SCHLIEßT UNTER pivot9
 * 
 * Das heißt der Algo müsste:
 * - frisch getouchten structurePivots prüfen, ob die Bedingung erfüllt ist, 
 * dass es einen touched structurePivot GIBT, 
 * wo beim neuesten p2Pivot keine Kerze drunter geschlossen hat
 * - es darf keine Pivots einbeziehen, welche schon längst touched waren (pivot6 & pivot8) 
 * => daher ist pivot9 das zählende 1h-pivot mit LQ-Sweep, da der Kerzenzeitpunkt NACH pivot6.touched.touchedAt und pivot8.touched.touchedAt ist
 * 
 * Was wir auch machen können: structurePivots die kaum eine Rolle mehr spielen, als 'legacy' flaggen.
 * Bedingungen könnten sein: touched. neues p5 pivot mit niedrigerem Preis gebildet.
 * 
 * 
 * - sind alle Bedingungen erfüllt, wird der entsprechende structurePivot als 'LQ-sweep' gekennzeichnet
 * 
 * 
 * Visualisierung:
 * An der Stelle soll im Chart eine GOLDENE Linie bei pivot9 gezeichnet werden mit dem label '1h LQ-Sweep'
*/
// AUSGEFÜLLT + GEGENGECHECKT (Claude), siehe closesBelowLevel/markLqSweeps in rangeAnalysis.ts:
// gegen die echten Kerzen (test/fixtures/gbpusd-h1-trend.json) geprüft, ob zwischen jedem touched
// LOW-structurePivot und p2Pivot37 (08.07. 11:00) je eine Kerze DRUNTER geschlossen hat:
// - pivot6 (touchedAt 06.07. 07:00): ja, schließt später drunter -> bleibt 'low'
// - pivot8 (touchedAt 03.07. 22:00): ja, schließt später drunter -> bleibt 'low'
// - pivot9 (touchedAt 08.07. 11:00, exakt p2Pivot37s eigene Kerze): NIE eine Kerze drunter
//   geschlossen -> 'LQ-sweep'.
// - pivot12 (touchedAt 08.07. 10:00): schließt bei 08.07. 10:00 UND 11:00 tatsächlich drunter
//   (1.33397 / 1.33418 < 1.33421) -> bleibt 'low'.
// Der markLqSweeps-BUG selbst (fehlende Bidirektionalität, siehe rangeAnalysis.ts) ist unabhängig
// von den touched-Werten hier gefixt — die touched-Korrektur unten ist eine SEPARATE Korrektur
// (touched muss den Stand ZUM ZEITPUNKT DIESES STATES zeigen, nicht den vollen Fixture-Endstand,
// siehe Kommentar über rangeState1). Zum p2Pivot37-Zeitpunkt (08.07. 11:00) sind pivot9 (exakt
// 11:00) und pivot12 (10:00, davor) schon getoucht, pivot10/pivot11 (beide erst 19:00) NICHT.
const rangeState1_1: RangeState = {
    trend: 'uptrend',
    currRange: {
        high: { ...pivot10, touched: false },
        low: pivot1,
    },
    structurePivots: [
        { ...pivot3, type: 'protected-low' },
        pivot4,
        pivot5,
        pivot6,
        pivot7,
        pivot8,
        { ...pivot9, type: 'LQ-sweep' },
        { ...pivot11, touched: false },
        pivot12,
    ],
    innerStructurePivots: [
        p2Pivot36,
        p2Pivot37
    ],
    appliedPivots: [
        pivot1,
        pivot2,
        pivot3,
        pivot4,
        pivot5,
        pivot6,
        pivot7,
        pivot8,
        pivot9,
        { ...pivot10, touched: false },
        { ...pivot11, touched: false },
        pivot12,
    ],
}