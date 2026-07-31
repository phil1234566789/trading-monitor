import { fetchForexCandles, type Candle } from "./forexCandles.js";
import { berlinDayRangeUtcMs, berlinDateStrFor } from "./berlinTime.js";

// Gemeinsames dateStr/replayUntilSec-Fenster für get_forex_rsi/get_forex_ema — dieselbe Semantik
// wie get_data_export (buildDataExport in dataExport.ts): dateStr wählt den Europe/Berlin-Kalender-
// tag, replayUntilSec deckt innerhalb dieses Tages nur bis zu diesem Zeitpunkt auf (Replay-
// Simulation). Anders als beim Daten-Export brauchen RSI/EMA zusätzlich Vorlauf-Kerzen VOR dem
// Tagesbeginn, damit die Indikator-Rekursion (Wilder-Glättung bzw. EMA-Seed ab erster Kerze) beim
// ersten sichtbaren Punkt des Tages schon eingependelt ist — siehe rsi.ts/ema.js-Kommentare.
export interface DayWindow {
  effectiveDateStr: string;
  startSec: number;
  endSec: number;
  cutoffSec: number;
}

export function resolveDayWindow(dateStr: string | undefined, replayUntilSec: number | undefined): DayWindow {
  const effectiveDateStr = dateStr ?? berlinDateStrFor(replayUntilSec ?? Math.floor(Date.now() / 1000));
  const { startUtcMs, endUtcMs } = berlinDayRangeUtcMs(effectiveDateStr);
  const cutoffMs = replayUntilSec != null ? replayUntilSec * 1000 : endUtcMs;
  return { effectiveDateStr, startSec: startUtcMs / 1000, endSec: endUtcMs / 1000, cutoffSec: cutoffMs / 1000 };
}

// Holt M5-Kerzen bis zum cutoff des Fensters, plus `warmupCandles` Vorlauf davor, in einem Request
// (fetchForexCandles liefert `count` Kerzen ENDEND bei toMs).
export async function fetchM5WithWarmup(instrument: string, warmupCandles: number, window: DayWindow): Promise<Candle[]> {
  const visibleSpanSec = Math.max(Math.min(window.cutoffSec, window.endSec) - window.startSec, 0);
  const dayCandleBudget = Math.ceil(visibleSpanSec / 300) + 5; // +5 Kerzen Puffer für Rundung/Lücken
  return fetchForexCandles(instrument, "5m", { count: dayCandleBudget + warmupCandles, toMs: window.cutoffSec * 1000 });
}

export function isWithinDayWindow(time: number, window: DayWindow): boolean {
  return time >= window.startSec && time < window.endSec && time <= window.cutoffSec;
}
