// Wilder's RSI, Standard-Periode 14 (siehe trading/rsi.md). Kein Port eines existierenden
// Frontend/Backend-Algorithmus wie orderBlocks.js/liquidity.js/tradeSetup.js — RSI gab es bisher
// nirgends im Repo, also kein Drift-Risiko durch eine zweite Implementierung.
//
// Divergenz-Erkennung (HH/LH etc.) wird bewusst NICHT hier codiert, sondern Claude überlassen:
// sobald eine saubere RSI-Zahlenreihe neben den Kerzen vorliegt, ist das Musterabgleich, kein
// Rechenrisiko mehr. Die RSI-Berechnung selbst (Wilder-Glättung über viele Kerzen) ist der
// fehleranfällige Teil, den ein LLM nicht im Kopf zuverlässig nachrechnen kann — deshalb hier.

export interface RsiCandle {
  time: number;
  close: number;
}

export interface RsiPoint {
  time: number;
  close: number;
  rsi: number | null;
}

export const DEFAULT_RSI_PERIOD = 14;

export function computeRsi(candles: RsiCandle[], period: number = DEFAULT_RSI_PERIOD): RsiPoint[] {
  const result: RsiPoint[] = candles.map((c) => ({ time: c.time, close: c.close, rsi: null }));
  if (candles.length <= period) return result;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change > 0) gainSum += change;
    else lossSum += -change;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  result[period].rsi = rsiFromAverages(avgGain, avgLoss);

  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    // Wilder-Glättung: neuer Durchschnitt = (alter * (period-1) + neuer Wert) / period
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i].rsi = rsiFromAverages(avgGain, avgLoss);
  }
  return result;
}

function rsiFromAverages(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export type RsiZone = "overbought" | "oversold" | "neutral";

// Klassische Zonen aus trading/rsi.md — Standard 70/30, keine Daytrading-Alternative (80/20),
// da das eine bewusste Trader-Entscheidung je nach Trendstärke ist, kein fixer Default.
export function rsiZone(value: number): RsiZone {
  if (value > 70) return "overbought";
  if (value < 30) return "oversold";
  return "neutral";
}
