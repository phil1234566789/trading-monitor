import {computeRangesPivots} from './marketStructureAnalysis.ts';
import {aggregateCandles,candlesInWindow} from './atr.js';

// Struktur-Baustein für Swing-Abfragen anderer Bausteine (SL hinter M15-P2): bestätigte, bis asOf unberührte Pivots einer Periode
// auf einem aus M5 gebauten Timeframe, mit pivotTime ab since. Nur Kerzen vor asOf, damit Lauf und Live-Alarm dasselbe sehen.
// Bestätigt = die period Kerzen rechts sind geschlossen (pivotTime + (period+1) Kerzen <= asOf).
export function untouchedSwingsAsOf(m5Candles,{asOf,since,barSeconds=900,period=2}){
 // Vorlauf period+4 Kerzen: so viele braucht der Fraktal-Kern links (liquidityDetection.js, liquidityPivotStart).
 const from=Math.floor(since/barSeconds)*barSeconds-(period+4)*barSeconds;
 const rows=aggregateCandles(candlesInWindow(m5Candles,from,asOf).filter(c=>!c.ignored),barSeconds);
 return computeRangesPivots(rows,period,since).filter(p=>p.pivotTime+(period+1)*barSeconds<=asOf&&!p.touched);
}
