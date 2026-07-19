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
 * testdaten pivots 1h periode 2 auch ab 01.07.2026 15:00 bis 08.07.2026 16:00
 */
const p2Pivot1: PivotLow = { type: 'low', price: 1.32189, pivotAt: '01.07.2026 15:00', pivotTime: 1782910800, touched: false };
const p2Pivot2: PivotHigh = { type: 'high', price: 1.32918, pivotAt: '01.07.2026 16:00', pivotTime: 1782914400, touched: { price: 1.32918, touchedAt: '02.07.2026 04:00' } };
const p2Pivot3: PivotLow = { type: 'low', price: 1.32635, pivotAt: '01.07.2026 23:00', pivotTime: 1782939600, touched: false };
const p2Pivot4: PivotHigh = { type: 'high', price: 1.32947, pivotAt: '02.07.2026 04:00', pivotTime: 1782957600, touched: { price: 1.32947, touchedAt: '02.07.2026 08:00' } };
const p2Pivot5: PivotHigh = { type: 'high', price: 1.33627, pivotAt: '02.07.2026 10:00', pivotTime: 1782979200, touched: { price: 1.33627, touchedAt: '02.07.2026 14:00' } };
const p2Pivot6: PivotLow = { type: 'low', price: 1.32972, pivotAt: '02.07.2026 14:00', pivotTime: 1782993600, touched: false };
const p2Pivot7: PivotHigh = { type: 'high', price: 1.33844, pivotAt: '02.07.2026 16:00', pivotTime: 1783000800, touched: { price: 1.33844, touchedAt: '06.07.2026 20:00' } };
const p2Pivot8: PivotLow = { type: 'low', price: 1.33379, pivotAt: '02.07.2026 19:00', pivotTime: 1783011600, touched: { price: 1.33379, touchedAt: '02.07.2026 23:00' } };
const p2Pivot9: PivotLow = { type: 'low', price: 1.33351, pivotAt: '02.07.2026 23:00', pivotTime: 1783026000, touched: { price: 1.33351, touchedAt: '03.07.2026 02:00' } };
const p2Pivot10: PivotLow = { type: 'low', price: 1.33346, pivotAt: '03.07.2026 02:00', pivotTime: 1783036800, touched: { price: 1.33346, touchedAt: '06.07.2026 07:00' } };
const p2Pivot11: PivotHigh = { type: 'high', price: 1.33663, pivotAt: '03.07.2026 04:00', pivotTime: 1783044000, touched: { price: 1.33663, touchedAt: '03.07.2026 07:00' } };
const p2Pivot12: PivotHigh = { type: 'high', price: 1.3381, pivotAt: '03.07.2026 08:00', pivotTime: 1783058400, touched: { price: 1.3381, touchedAt: '06.07.2026 19:00' } };
const p2Pivot13: PivotLow = { type: 'low', price: 1.33492, pivotAt: '03.07.2026 12:00', pivotTime: 1783072800, touched: { price: 1.33492, touchedAt: '03.07.2026 15:00' } };
const p2Pivot14: PivotHigh = { type: 'high', price: 1.33637, pivotAt: '03.07.2026 13:00', pivotTime: 1783076400, touched: { price: 1.33637, touchedAt: '06.07.2026 17:00' } };
const p2Pivot15: PivotLow = { type: 'low', price: 1.33459, pivotAt: '03.07.2026 15:00', pivotTime: 1783083600, touched: { price: 1.33459, touchedAt: '03.07.2026 22:00' } };
const p2Pivot16: PivotHigh = { type: 'high', price: 1.33582, pivotAt: '03.07.2026 19:00', pivotTime: 1783098000, touched: { price: 1.33582, touchedAt: '06.07.2026 16:00' } };
const p2Pivot17: PivotLow = { type: 'low', price: 1.33421, pivotAt: '05.07.2026 23:00', pivotTime: 1783285200, touched: { price: 1.33421, touchedAt: '06.07.2026 03:00' } };
const p2Pivot18: PivotHigh = { type: 'high', price: 1.33564, pivotAt: '06.07.2026 02:00', pivotTime: 1783296000, touched: { price: 1.33564, touchedAt: '06.07.2026 16:00' } };
const p2Pivot19: PivotLow = { type: 'low', price: 1.33392, pivotAt: '06.07.2026 04:00', pivotTime: 1783303200, touched: { price: 1.33392, touchedAt: '06.07.2026 07:00' } };
const p2Pivot20: PivotLow = { type: 'low', price: 1.33286, pivotAt: '06.07.2026 09:00', pivotTime: 1783321200, touched: { price: 1.33286, touchedAt: '08.07.2026 11:00' } };
const p2Pivot21: PivotHigh = { type: 'high', price: 1.33501, pivotAt: '06.07.2026 10:00', pivotTime: 1783324800, touched: { price: 1.33501, touchedAt: '06.07.2026 14:00' } };
const p2Pivot22: PivotHigh = { type: 'high', price: 1.33969, pivotAt: '06.07.2026 21:00', pivotTime: 1783364400, touched: { price: 1.33969, touchedAt: '07.07.2026 01:00' } };
const p2Pivot23: PivotLow = { type: 'low', price: 1.33816, pivotAt: '06.07.2026 23:00', pivotTime: 1783371600, touched: { price: 1.33816, touchedAt: '07.07.2026 07:00' } };
const p2Pivot24: PivotHigh = { type: 'high', price: 1.34016, pivotAt: '07.07.2026 03:00', pivotTime: 1783386000, touched: { price: 1.34016, touchedAt: '08.07.2026 19:00' } };
const p2Pivot25: PivotLow = { type: 'low', price: 1.33878, pivotAt: '07.07.2026 03:00', pivotTime: 1783386000, touched: { price: 1.33878, touchedAt: '07.07.2026 07:00' } };
const p2Pivot26: PivotLow = { type: 'low', price: 1.3375, pivotAt: '07.07.2026 09:00', pivotTime: 1783407600, touched: { price: 1.3375, touchedAt: '07.07.2026 12:00' } };
const p2Pivot27: PivotHigh = { type: 'high', price: 1.33938, pivotAt: '07.07.2026 10:00', pivotTime: 1783411200, touched: { price: 1.33938, touchedAt: '07.07.2026 13:00' } };
const p2Pivot28: PivotLow = { type: 'low', price: 1.33695, pivotAt: '07.07.2026 12:00', pivotTime: 1783418400, touched: { price: 1.33695, touchedAt: '07.07.2026 15:00' } };
const p2Pivot29: PivotHigh = { type: 'high', price: 1.33941, pivotAt: '07.07.2026 13:00', pivotTime: 1783422000, touched: { price: 1.33941, touchedAt: '08.07.2026 19:00' } };
const p2Pivot30: PivotLow = { type: 'low', price: 1.33609, pivotAt: '07.07.2026 16:00', pivotTime: 1783432800, touched: { price: 1.33609, touchedAt: '07.07.2026 20:00' } };
const p2Pivot31: PivotHigh = { type: 'high', price: 1.33761, pivotAt: '07.07.2026 20:00', pivotTime: 1783447200, touched: { price: 1.33761, touchedAt: '08.07.2026 15:00' } };
const p2Pivot32: PivotHigh = { type: 'high', price: 1.33552, pivotAt: '08.07.2026 02:00', pivotTime: 1783468800, touched: { price: 1.33552, touchedAt: '08.07.2026 05:00' } };
const p2Pivot33: PivotLow = { type: 'low', price: 1.33421, pivotAt: '08.07.2026 03:00', pivotTime: 1783472400, touched: { price: 1.33421, touchedAt: '08.07.2026 10:00' } };
const p2Pivot34: PivotHigh = { type: 'high', price: 1.33589, pivotAt: '08.07.2026 05:00', pivotTime: 1783479600, touched: { price: 1.33589, touchedAt: '08.07.2026 08:00' } };
const p2Pivot35: PivotHigh = { type: 'high', price: 1.337, pivotAt: '08.07.2026 10:00', pivotTime: 1783497600, touched: { price: 1.337, touchedAt: '08.07.2026 15:00' } };
const p2Pivot36: PivotLow = { type: 'low', price: 1.33222, pivotAt: '08.07.2026 11:00', pivotTime: 1783501200, touched: false };
const p2Pivot37: PivotHigh = { type: 'high', price: 1.33775, pivotAt: '08.07.2026 15:00', pivotTime: 1783515600, touched: { price: 1.33775, touchedAt: '08.07.2026 18:00' } };

/**
 * Szenario A: uptrend besser und schneller erkennen.
 */