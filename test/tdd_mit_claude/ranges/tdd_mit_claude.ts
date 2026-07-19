// Domain-Typen jetzt in src/range.type.ts (siehe Chat: Algo und Testdaten sollen denselben
// Vertrag benutzen statt zweier Kopien, die auseinanderlaufen können). Hier nur noch Fixtures +
// die Schritt-für-Schritt-Testzustände.

import { Pivot, PivotHigh, PivotLow, MarketStructureState } from "../../../src/range.type";

/** GBPUSD M5-Periode-10 Pivots der Test-Range ab 15.07.19:30, die zum Zeitpunkt der Erkennung immer untouched sind */
const swingHighTestRange: Pivot = { type: 'high', price: 1.35578, pivotAt: '15.07.2026 20:20', touched: false };
const nextPivot1: Pivot  = { type: 'low', price: 1.35273, pivotAt: '15.07.2026 21:35',  touched: false };
const nextPivot2: Pivot  = { price: 1.35392, pivotAt: '15.07.2026 22:25', type: 'high', touched: false };
const nextPivot3: Pivot  = { price: 1.35269, pivotAt: '15.07.2026 23:55', type: 'low', touched: false };
const nextPivot4: Pivot  = { price: 1.35418, pivotAt: '16.07.2026 00:30', type: 'high', touched: false };
const nextPivot5: Pivot  = { price: 1.35440, pivotAt: '16.07.2026 02:15', type: 'high', touched: false }; // "1,3544" im Screenshot (gerundet)
const nextPivot6: Pivot  = { price: 1.35196, pivotAt: '16.07.2026 04:15', type: 'low', touched: false };
const nextPivot7: Pivot  = { price: 1.35377, pivotAt: '16.07.2026 05:30', type: 'high', touched: false };
const nextPivot8: Pivot  = { price: 1.35306, pivotAt: '16.07.2026 06:25', type: 'low', touched: false };
const nextPivot9: Pivot  = { price: 1.35409, pivotAt: '16.07.2026 07:30', type: 'high', touched: false };
const nextPivot10: Pivot  = { price: 1.35271, pivotAt: '16.07.2026 07:55', type: 'low', touched: false };
const nextPivot11: Pivot  = { price: 1.35421, pivotAt: '16.07.2026 09:00', type: 'high', touched: false };

/** GBPUSD H1-Periode-5 Pivots ab 08.07.2026 11:00 bis 13.07.2026 23:00 (test/fixtures/gbpusd-h1-trend.json,
 * exakt wie detectLiquidityLevels/buildLevel in src/liquidity.js erkannt+getoucht) — mehrere Tage vor der
 * bisherigen Uptrend-Range (swingHighTestRange/nextPivot1..11 oben), für den Bug "Range geht mehrere Tage
 * zurück -> Algo bricht" (siehe Chat 2026-07-19). pivot10/11/12 sind bewusst identisch mit pivot1/2/3 aus
 * test/rangeAnalysis.test.js — dieselben Pivots, hier nur weiter zurück fortgesetzt. */
const pivot1: Pivot = { type: 'low', price: 1.33222, pivotAt: '08.07.2026 11:00', pivotTime: 1783501200, touched: false };
const pivot2: Pivot = { type: 'high', price: 1.34103, pivotAt: '08.07.2026 19:00', pivotTime: 1783530000, touched: { price: 1.34103, touchedAt: '09.07.2026 08:00' } };
const pivot3: Pivot = { type: 'high', price: 1.34308, pivotAt: '09.07.2026 08:00', pivotTime: 1783576800, touched: { price: 1.34308, touchedAt: '10.07.2026 03:00' } };
const pivot4: Pivot = { type: 'low', price: 1.33807, pivotAt: '09.07.2026 14:00', pivotTime: 1783598400, touched: { price: 1.33807, touchedAt: '13.07.2026 00:00' } };
const pivot5: Pivot = { type: 'high', price: 1.34192, pivotAt: '09.07.2026 20:00', pivotTime: 1783620000, touched: { price: 1.34192, touchedAt: '10.07.2026 02:00' } };
const pivot6: Pivot = { type: 'low', price: 1.33907, pivotAt: '09.07.2026 23:00', pivotTime: 1783630800, touched: { price: 1.33907, touchedAt: '12.07.2026 23:00' } };
const pivot7: Pivot = { type: 'high', price: 1.34516, pivotAt: '10.07.2026 04:00', pivotTime: 1783648800, touched: { price: 1.34516, touchedAt: '15.07.2026 16:00' } };
const pivot8: Pivot = { type: 'high', price: 1.34374, pivotAt: '10.07.2026 13:00', pivotTime: 1783681200, touched: { price: 1.34374, touchedAt: '14.07.2026 14:00' } };
const pivot9: Pivot = { type: 'low', price: 1.33919, pivotAt: '10.07.2026 16:00', pivotTime: 1783692000, touched: { price: 1.33919, touchedAt: '12.07.2026 23:00' } };
const pivot10: Pivot = { type: 'low', price: 1.33667, pivotAt: '13.07.2026 03:00', pivotTime: 1783904400, touched: { price: 1.33667, touchedAt: '13.07.2026 16:00' } };
const pivot11: Pivot = { type: 'high', price: 1.34115, pivotAt: '13.07.2026 10:00', pivotTime: 1783929600, touched: { price: 1.34115, touchedAt: '14.07.2026 14:00' } };
const pivot12: Pivot = { type: 'low', price: 1.33416, pivotAt: '13.07.2026 23:00', pivotTime: 1783976400, touched: false };

// Algo sollte von pivot1 bis pivot7 bereits einen gültigen uptrend finden.