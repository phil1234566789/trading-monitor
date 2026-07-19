import { Pivot, PivotHigh, PivotLow, RangeState } from "../../../src/range.type";
/** GBPUSD H1-Periode-5 Pivots (Ranges-Metadaten-Panel, Lookback ab 13.07.) — pivotTime = Unix-Sekunden, +02:00 (CEST, wie TREND_ANALYSIS_ANCHOR_TIME in PriceChart.vue) */
const pivot1: PivotLow = { type: 'low', price: 1.33667, pivotAt: '13.07.2026 03:00', pivotTime: 1783904400, touched: { price: 1.33667, touchedAt: '13.07.2026 16:00' } };
const pivot2: PivotHigh = { type: 'high', price: 1.34115, pivotAt: '13.07.2026 10:00', pivotTime: 1783929600, touched: { price: 1.34115, touchedAt: '14.07.2026 14:00' } };
const pivot3: PivotLow = { type: 'low', price: 1.33416, pivotAt: '13.07.2026 23:00', pivotTime: 1783976400, touched: false };
const pivot4: PivotLow = { type: 'low', price: 1.33512, pivotAt: '14.07.2026 09:00', pivotTime: 1784012400, touched: false };
const pivot5: PivotHigh = { type: 'high', price: 1.34434, pivotAt: '14.07.2026 14:00', pivotTime: 1784030400, touched: { price: 1.34434, touchedAt: '15.07.2026 15:00' } };
const pivot6: PivotLow = { type: 'low', price: 1.33681, pivotAt: '14.07.2026 19:00', pivotTime: 1784048400, touched: false };
const pivot7: PivotLow = { type: 'low', price: 1.33806, pivotAt: '15.07.2026 12:00', pivotTime: 1784109600, touched: false };
const pivot8: PivotHigh = { type: 'high', price: 1.35578, pivotAt: '15.07.2026 20:00', pivotTime: 1784138400, touched: false };
const pivot9: PivotLow = { type: 'low', price: 1.35196, pivotAt: '16.07.2026 04:00', pivotTime: 1784167200, touched: { price: 1.35196, touchedAt: '16.07.2026 10:00' } };
const pivot10: PivotHigh = { type: 'high', price: 1.35421, pivotAt: '16.07.2026 09:00', pivotTime: 1784185200, touched: false };
const pivot11: PivotLow = { type: 'low', price: 1.34598, pivotAt: '16.07.2026 19:00', pivotTime: 1784221200, touched: { price: 1.34598, touchedAt: '17.07.2026 06:00' } };
const pivot12: PivotHigh = { type: 'high', price: 1.34805, pivotAt: '17.07.2026 09:00', pivotTime: 1784271600, touched: false };
const pivot13: PivotLow = { type: 'low', price: 1.34262, pivotAt: '17.07.2026 12:00', pivotTime: 1784282400, touched: false };

// erster state Schritt des neuen 1h Algorithmus. zwei pivotpoints werden gelesen
const rangeState1: RangeState = {
    trend: 'unknown',
    currRange: {
        high: pivot2,
        low: pivot1,
    },
    structurePivots: [],
    appliedPivots: [
        pivot1,
        pivot2
    ]
}
// pivot3 lesen
// da pivot3 tiefer ist als pivot 1 wird das low gesetzt
const rangeState2: RangeState = {
    trend: 'unknown',
    currRange: {
        high: pivot2,
        low: pivot3
    },
    structurePivots: [],
    appliedPivots: [
        pivot1,
        pivot2,
        pivot3
    ]
}
// pivot4 lesen
// pivot4 ist ein HL, also innerhalb der Range, daher wird er in die Struktur aufgenommen
const rangeState3: RangeState = {
    trend: 'unknown',
    currRange: {
        high: pivot2,
        low: pivot3
    },
    structurePivots: [
        pivot4
    ],
    appliedPivots: [
        pivot1,
        pivot2,
        pivot3,
        pivot4
    ]
}
// pivot5 lesen
// pivot5 ist höher als das range-high (pivot2), daher setzen. KEINE Trendbestätigung, obwohl
// bereits ein Pullback (pivot4) in structurePivots liegt: pivot2 selbst ist nicht "eligible" als
// Ursprung eines Aufwärts-Legs, weil pivot2 VOR dem aktuellen range-low (pivot3) gelesen wurde
// (13.07 10:00 vor 13.07 23:00) - ein Bruch von pivot2 kann also grundsätzlich nicht bestätigen,
// unabhängig davon, wie viele Pullbacks in structurePivots liegen. Erst pivot5 selbst (nach pivot3
// gelesen) ist ein gültiger Ursprung, siehe rangeState7.
const rangeState4: RangeState = {
    trend: 'unknown',
    currRange: {
        high: pivot5,
        low: pivot3
    },
    structurePivots: [
        pivot4
    ],
    appliedPivots: [
        pivot1,
        pivot2,
        pivot3,
        pivot4,
        pivot5
    ]
}
// pivot6 lesen und wird in structurePivots aufgenommen, da er sich innerhalb der Range befindet
const rangeState5: RangeState = {
    trend: 'unknown',
    currRange: {
        high: pivot5,
        low: pivot3
    },
    structurePivots: [
        pivot4,
        pivot6
    ],
    appliedPivots: [
        pivot1,
        pivot2,
        pivot3,
        pivot4,
        pivot5,
        pivot6
    ]
}
// pivot7 lesen und wird in structurePivots aufgenommen, da er sich innerhalb der Range befindet
const rangeState6: RangeState = {
    trend: 'unknown',
    currRange: {
        high: pivot5,
        low: pivot3
    },
    structurePivots: [
        pivot4,
        pivot6,
        pivot7
    ],
    appliedPivots: [
        pivot1,
        pivot2,
        pivot3,
        pivot4,
        pivot5,
        pivot6,
        pivot7
    ]
}
// pivot8 lesen
// Action! range-high (pivot5) wurde überschritten. Bestätigte bullische Trendstruktur braucht 4
// Punkte in Lese-Reihenfolge: range-low (pivot3), ein range-high NACH diesem range-low (pivot5 -
// eligible, anders als pivot2 in rangeState4), mindestens 1 higher-low NACH diesem range-high
// (pivot6 und pivot7 gelten, pivot4 zählt nicht mehr mit, weil es VOR pivot5 gelesen wurde), und
// der Bruch dieses range-high (pivot8) => bestätigter uptrend!
// außerdem gilt jetzt das JÜNGSTE qualifizierende higher-low (pivot7, nach pivot5 gelesen) als protected-low
const rangeState7: RangeState = {
    trend: 'uptrend',
    currRange: {
        high: pivot8,
        low: pivot3
    },
    structurePivots: [
        pivot4,
        pivot6,
        {...pivot7, type: 'protected-low'}
    ],
    appliedPivots: [
        pivot1,
        pivot2,
        pivot3,
        pivot4,
        pivot5,
        pivot6,
        pivot7,
        pivot8
    ]
}
// folgende pivots sind alle tiefer als das range-high, aber keines davon bricht das protected-low => 1h aufwärtstrend immernoch intakt