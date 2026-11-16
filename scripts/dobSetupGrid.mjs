// Gemeinsames Raster der DOB-Setup-Skripte (dobSetupWinrate = Messung, dobTradeSetupsFill = Statistikseite), damit beide dieselben Trades zählen.
// Ohne src-Importe: die Skripte laden die src-Module über Vite und reichen die Funktionen herein.

const lowerBound = (rows, t) => { let lo = 0, hi = rows.length; while (lo < hi) { const m = (lo + hi) >> 1; if (rows[m].time < t) lo = m + 1; else hi = m; } return lo; };
const slice = (rows, from, to) => rows.slice(lowerBound(rows, from), lowerBound(rows, to));
export const dobGridInputAt = ({ symbol, m5Marked, m1Marked }, at, lookbackSec) => ({ instrument: symbol, evaluatedAt: at,
  m5Candles: slice(m5Marked, at - lookbackSec, at), m1Candles: slice(m1Marked, at - lookbackSec, at) });

// Raster wie der spätere Watcher: jeder M5-Schluss, Live-Fenster. Letzte Sichtung je ID gewinnt (Entry kommt nach dem Warten).
export function collectDobSetups(data, { startSec, dataEnd, checkDobTradeSetup, dobLiveWindowInput }) {
  const durations = [], bars = [], setups = new Map(), waitedFirst = new Set();
  for (const c of data.m5All) {
    const at = c.time + 300;
    if (at <= startSec || at > dataEnd) continue;
    const live = dobLiveWindowInput(dobGridInputAt(data, at, 2 * 86400));
    if (!live.m1Candles.length) continue;
    const t0 = performance.now();
    const result = checkDobTradeSetup(live);
    durations.push(performance.now() - t0);
    bars.push([live.m5Candles.length, live.m1Candles.length]);
    for (const s of result.setups) if (s.recognizedAt >= startSec) {
      if (!setups.has(s.id) && s.phase === 'ob2Recognized') waitedFirst.add(s.id);
      setups.set(s.id, s);
    }
  }
  return { setups, durations, bars, waitedFirst };
}

// Ausgang aller Entries bis Datenende neu (Trades laufen über Nacht weiter), wie dobWinrate.
export const dobGridTrades = (setups, { symbol, m1Marked }, dataEnd, evaluateDoubleOrderBlockOutcome) =>
  [...setups.values()].filter(s => s.entryTime != null).map(s => ({ ...s,
    outcome: evaluateDoubleOrderBlockOutcome({ direction: s.direction, entryTime: s.entryTime, entryPrice: s.entryPrice,
      stopPrice: s.stopPrice, candles: m1Marked, evaluatedAt: dataEnd, instrument: symbol }) }));

// Mehrere OB1-Partner können denselben Trade (Richtung, Entry, SL) tragen; einmal gezählt = echte Trades. Der letzte Träger gibt Route/Paar vor.
export const dobTradeKey = t => `${t.direction}:${t.entryTime}:${t.entryPrice}:${t.stopPrice}`;
export const uniqueDobTrades = trades => [...new Map(trades.map(t => [dobTradeKey(t), t])).values()];
