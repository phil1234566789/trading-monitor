import type { Pivot, MarketStructureState } from "./range.type";
import { collectNestedChain } from "./marketStructureAnalysis";

// Wandelt einen Pivot in die von tradeSetup.js erwartete LqLevel-Form um (siehe liquidity.js:
// buildLevel — dieselben Felder: price/dir/pivotTime/touched/touchedTime/endTime). Bug-Report
// Philip 2026-07-28: Path A/B in tradeSetup.js nutzten bislang eine EIGENE, unabhängige
// H1-Fraktal-Erkennung (liquidity.js auf einem nur 300 Kerzen/≈12,5 Tage kurzen Fenster,
// TRADE_SETUP_H1_CANDLE_COUNT in PriceChart.vue) statt der hier längst vorhandenen, sauber
// gefilterten structurePivots — ein 32 Tage altes, aber gerade erst geswepptes Level (1.13545)
// war dadurch für Path A/B unsichtbar, obwohl es im Debug-Panel längst als "1h LQ-Sweep"
// angezeigt wurde ("das allermeiste [an der alten H1-Fraktal-Erkennung] ist nur Datenmüll" —
// Philip wollte explizit NICHT die Kerzenzahl hochsetzen, sondern die längst gefilterten
// structurePivots wiederverwenden). dir wird vom Aufrufer mitgegeben, siehe collectStructureLqLevels.
function toLqLevel(pivot: Pivot, dir: 1 | -1) {
  const touchedTime = pivot.touched ? (pivot.touched.touchedTime ?? null) : null;
  return {
    price: pivot.price,
    dir,
    pivotTime: pivot.pivotTime ?? 0,
    touched: pivot.touched !== false,
    touchedTime,
    // Nur touched Pivots kommen hier überhaupt an (siehe collectStructureLqLevels-Filter), und der
    // Algorithmus setzt touchedTime für echte (nicht synthetische Test-)Pivots immer — der
    // pivotTime-Fallback ist rein defensiv für den in der Praxis nicht vorkommenden Fall.
    endTime: touchedTime ?? (pivot.pivotTime ?? 0),
  };
}

// Sammelt alle H1-Level-Kandidaten für EINE tradeSetup-Richtung (dir: -1 Long braucht Low-Seite,
// 1 Short braucht High-Seite) aus structurePivots — sowohl vom Haupttrend als auch von einem
// gerade laufenden Nested-Gegentrend-Kandidaten (CHoCH), falls vorhanden. Welche der beiden
// Pivot-Listen die Low- bzw. High-Seite liefert, hängt vom jeweiligen state.trend ab (uptrend:
// Haupttrend=Low-Seite; downtrend gespiegelt) — dieselbe Zuordnung wie isDowntrend in
// renderMarketStructureAnalysis. Nur touched Pivots sind als LS-Kandidat überhaupt relevant
// (untouched = noch nichts geswept, das ist die Fraktal-Seite, nicht die LS-Seite).
//
// Die Trend-Ebene allein reicht als Seiten-Auswahl NICHT (Bug-Report Philip 2026-09-23, GBPUSD
// Setup #4986): structurePivots sammelt jeden Pullback-Pivot BEIDER Seiten (siehe
// applyMarketStructurePivotCore), und findLsInArray prüft für Short nur `lvl.price <
// fractal.price` — das erfüllt jedes beliebige Tief unter dem Fraktal. So landete ein 1H-Tief
// 9 Pip UNTER dem Order Block als "Liquidity Sweep" eines Short-Setups, und weil collectObSweeps
// nach Alter sortiert, verdrängte es auch noch den echten jungen Sweep aus sweeps[0].
// Gefiltert wird die Gegenseite statt die eigene zu whitelisten: 'LQ-sweep'/'break-of-structure'
// tragen die Seite nicht im Namen, sind aber innerhalb einer Trend-Ebene fast immer schon die
// gesuchte (markLqSweeps läuft dort mit derselben Richtung) — und gerade ein LQ-sweep ist der
// wertvollste LS-Kandidat. Bleibt ein Rest: ein Tief, das in einer früheren uptrend-/unknown-Phase
// derselben Ebene zu 'LQ-sweep' umgetauft wurde, behält den Namen auch nach dem Trendwechsel.
export function collectStructureLqLevels(state: MarketStructureState | null | undefined, dir: 1 | -1, includeUntouched = false) {
  if (!state) return [];
  const wantTrend = dir === -1 ? "uptrend" : "downtrend";
  const falscheSeite = dir === 1 ? "low" : "high";
  const pivots: Pivot[] = [];
  for (const level of collectNestedChain(state)) {
    if (level.trend === wantTrend) pivots.push(...level.structurePivots);
  }
  return pivots.filter((p) => (includeUntouched || p.touched !== false) && !p.type.endsWith(falscheSeite)).map((p) => toLqLevel(p, dir));
}
