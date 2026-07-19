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
