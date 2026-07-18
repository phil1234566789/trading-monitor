// Domain-Typen jetzt in src/range.type.ts (siehe Chat: Algo und Testdaten sollen denselben
// Vertrag benutzen statt zweier Kopien, die auseinanderlaufen können). Hier nur noch Fixtures +
// die Schritt-für-Schritt-Testzustände.

import { Pivot } from "../src/range.type";

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

