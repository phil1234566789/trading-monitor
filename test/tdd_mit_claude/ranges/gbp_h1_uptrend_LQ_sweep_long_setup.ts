import { Pivot, PivotHigh, PivotLow, RangeState } from "../../../src/range.type";

/** GBPUSD H1-Periode-5 Pivots ab 01.07.2026 15:00 bis 08.07.2026 16:00 (test/fixtures/gbpusd-h1-trend.json,
 * exakt wie detectLiquidityLevels/buildLevel in src/liquidity.js erkannt+getoucht) — liegt direkt VOR der
 * Range aus tdd_mit_claude.ts (08.07.2026 11:00 bis 13.07.2026 23:00): pivot13 hier ist bewusst identisch
 * mit pivot1 dort, dieselbe Fraktal-Serie nur weiter zurück fortgesetzt. Für den LQ-Sweep-Long-Setup kurz
 * nach 08.07. (siehe Chat 2026-07-19: "echt geiles Long-Setup", Alarm/Bling-Bling folgt separat). */
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

/**
 * Szenario A: uptrend besser und schneller erkennen.
 */