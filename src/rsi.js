// Wilder's RSI, Standard-Periode 14 (siehe trading/rsi.md). Kanonischer Ort seit 2026-08-11 (vorher
// nur in mcp-server/src/rsi.ts, das dorthin verschoben wurde, weil es bereits dependency-frei war —
// analog zu computeEma in ema.js: EIN Ort, geteilt zwischen dem Live-Chart-RSI-Panel
// (PriceChart.vue) und dem MCP-Tool get_forex_rsi (mcp-server/src/tools/reads.ts), kein zweiter
// Port, kein Drift-Risiko (siehe CLAUDE.md "MCP-Server").
//
// Divergenz-Erkennung (HH/LH etc.) wird bewusst NICHT hier codiert, sondern Claude/Lana überlassen:
// sobald eine saubere RSI-Zahlenreihe neben den Kerzen vorliegt, ist das Musterabgleich, kein
// Rechenrisiko mehr. Die RSI-Berechnung selbst (Wilder-Glättung über viele Kerzen) ist der
// fehleranfällige Teil, den ein LLM nicht im Kopf zuverlässig nachrechnen kann — deshalb hier.

export const DEFAULT_RSI_PERIOD = 14;

// JSDoc-Typen hier nicht nur Doku — ohne sie leitet TS' allowJs-Inferenz für mcp-server/src/tools/
// reads.ts' cross-directory Import (siehe CLAUDE.md "MCP-Server") einen zu unscharfen Rückgabetyp
// her (rsi bleibt beim `.filter()`-Callback dort implizit `any`, `tsc --noEmit` schlägt fehl).
/**
 * @param {{time: number, close: number}[]} candles
 * @param {number} [period]
 * @returns {{time: number, close: number, rsi: number | null}[]}
 */
export function computeRsi(candles, period = DEFAULT_RSI_PERIOD) {
  if (candles.length <= period) {
    return candles.map((c) => ({ time: c.time, close: c.close, rsi: null }));
  }

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change > 0) gainSum += change;
    else lossSum += -change;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  const result = [];
  for (let i = 0; i < candles.length; i++) {
    let rsi = null;
    if (i === period) {
      rsi = rsiFromAverages(avgGain, avgLoss);
    } else if (i > period) {
      const change = candles[i].close - candles[i - 1].close;
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;
      // Wilder-Glättung: neuer Durchschnitt = (alter * (period-1) + neuer Wert) / period
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      rsi = rsiFromAverages(avgGain, avgLoss);
    }
    result.push({ time: candles[i].time, close: candles[i].close, rsi });
  }
  return result;
}

function rsiFromAverages(avgGain, avgLoss) {
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// Klassische Zonen aus trading/rsi.md — Standard 70/30, keine Daytrading-Alternative (80/20),
// da das eine bewusste Trader-Entscheidung je nach Trendstärke ist, kein fixer Default.
export function rsiZone(value) {
  if (value > 70) return "overbought";
  if (value < 30) return "oversold";
  return "neutral";
}
