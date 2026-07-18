// Domain-Typen jetzt in src/trendTypes.ts (siehe Chat: Algo und Testdaten sollen denselben
// Vertrag benutzen statt zweier Kopien, die auseinanderlaufen können). Hier nur noch Fixtures +
// die Schritt-für-Schritt-Testzustände.
import type { Pivot, PivotSwingHigh, PivotSwingLow, TrendAnalyseState } from "../src/trendTypes";

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



// Candles lesen ab 15.07. 19:30
// 1: zum Zeitpunkt 22:20
// algo: Ausgangspunkt - High und Low werden als swing-high/swing-low markiert, trendState steht
// auf 'unconfirmed' (Richtung ist erkennbar, aber ohne Lower-High/Lower-Low noch keine
// bestätigte Struktur).
// Klassifizierte Fassungen für range.* - swingHighTestRange/nextPivot1 selbst bleiben roh (type
// 'high'/'low'), weil appliedPivots die ungeklassifizierte Lese-Reihenfolge braucht.
const swingHigh: PivotSwingHigh = { ...swingHighTestRange, type: 'swing-high' };
const swingLow: PivotSwingLow = { ...nextPivot1, type: 'swing-low' };

const stateSchritt1: TrendAnalyseState = {
    trendOrdnung: 1,
    direction: 'down',
    confirmation: 'unconfirmed', // mit einem high & low können wir grad mal die Richtung sagen, ist aber kein bestätigter Trend
    range: {
        high: swingHigh,
        low: swingLow
    },
    structure: [], // noch keine Struktur vorhanden
    innerStructure: [],
    appliedPivots: [
        swingHighTestRange,
        nextPivot1
    ],
    trendInvalidatingPivot: null // noch kein Bruch des swing-high passiert
}
// 2: zum Zeitpunkt 23:10
// algo: neuer Pivot bricht weder High noch Low, range bleibt unverändert. Er wird trotzdem als
// lower-high in struktur[] abgelegt (erster Baustein der Struktur), trendState bleibt
// 'unconfirmed' - ein einzelnes lower-high reicht noch nicht für einen bestätigten Trend.
const stateSchritt2: TrendAnalyseState = {
    trendOrdnung: 1,
    direction: 'down',
    confirmation: 'unconfirmed',
    range: {
        high: swingHigh,
        low: swingLow
    },
    structure: [
        { ...nextPivot2, type: 'lower-high'} // hier bildet sich grad die Struktur von trend-1, Trend ist aber noch unconfirmed
    ],
    innerStructure: [], // wir sind noch in TrendOrdnung 1, keine Unterstruktur vorhanden
    appliedPivots: [
        swingHighTestRange,
        nextPivot1,
        nextPivot2
    ],
    trendInvalidatingPivot: null
}
// 3: um 16.07. 00:25
// algo: neuer Pivot macht ein Lower Low -> range.low wird angepasst. Damit haben wir 4 Pivots
// (swingHigh, swingLow, lower-high, lower-low), aus denen sich eine bärische Linien-Struktur
// zeichnen lässt - Lehrbuch: Lower Low, Lower High, neues Lower Low. trendState wechselt auf
// 'confirmed', weil jetzt Lower-High + Lower-Low als echte Struktur vorliegen (siehe struktur[]
// unten für die Details zu "weak"). Die Zigzag-Linie dieser Struktur wird separat in Rot gezeichnet.
const newSwingLow: PivotSwingLow = { ...nextPivot3, type: 'swing-low'};
const stateSchritt3: TrendAnalyseState = {
    trendOrdnung: 1,
    direction: 'down',
    confirmation: 'confirmed', // ham ja lower-low, lower-high, also confirmed.
    range: {
        high: swingHigh,
        low: newSwingLow
    },
    structure: [
        { ...nextPivot2, type: 'weak-high'}, // schließt keine M5-Kerze zwischen pivot2 und pivot3 per CLOSE unter pivot2, gilt pivot2 nur als "weak" statt lower-high
        { ...nextPivot3, type: 'lower-low'}
    ],
    innerStructure: [],
    appliedPivots: [
        swingHighTestRange,
        nextPivot1,
        nextPivot2,
        nextPivot3
    ],
    trendInvalidatingPivot: null
}

// 4. nächster pivot hat sich gebildet und wird vom algo eingelesen


// STOPP, schreib den algo erst mal bis hier und nicht weiter.



// Alte Referenznotiz (Shape des inzwischen entfernten trendStructure.js-Engines, siehe Chat) —
// kein gültiges JS/TS, deshalb zum Kompilieren auskommentiert statt gelöscht.
/*
{
"chartLabel": "Rahmen (übergeordnet)"
"direction": "down"
"swingHigh": {
"price": 1.35578
"at": "15.07., 20:20"
"touched": false
"touchedAt": "–"
}
"swingLow": {
"price": 1.34262
"at": "17.07., 12:50"
"touched": false
"touchedAt": "–"
}
"unterstruktur": [
{
"chartLabel": "M5 aktuell"
"direction": "down"
"confirmedAt": "16.07., 04:00"
"invalidatedAt": "–"
"swingHigh": {
"price": 1.35578
"at": "15.07., 20:20"
"touched": false
"touchedAt": "–"
}
"swingLow": {
"price": 1.34262
"at": "17.07., 12:50"
"touched": false
"touchedAt": "–"
}
"protectedHigh": {
"price": 1.34598
"at": "17.07., 19:05"
"touched": false
"touchedAt": "–"
}
"protectedLow": null
"choch": {
"price": 1.34466
"protectedSince": "17.07., 13:40"
"brokenAt": "17.07., 15:50"
}
*/