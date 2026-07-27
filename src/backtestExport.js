// Rohdaten-Export fürs Forex-Backtesting (siehe trading/backtest-instructions.md) — liefert
// Kerzen (1H/5m/1m) für einen kompletten Berlin-Kalendertag, aufbereitet für Copy/Paste in den
// Claude-Project-Chat. Bewusst NUR Rohdaten, keine vorberechneten OB-/Liquiditätszonen — die
// Setup-Erkennung soll laut Plan im Claude Project anhand der Strategie-Dokumente passieren,
// nicht hier dupliziert werden.
import { fetchInitialCandles } from "./forexCandles.js";

// Aktuell nur GBPUSD: EURUSD bräuchte zusätzlich DXY als Kontext (siehe backtest-instructions.md),
// das ist noch nicht umgesetzt — Liste bewusst als einzige Quelle der Wahrheit fürs Modal-Dropdown,
// damit EURUSD nicht versehentlich auswählbar ist, bevor die Datengrundlage dafür steht.
export const BACKTEST_ASSETS = ["GBPUSD"];

// count jeweils mit Puffer über die reine Tageslänge (24/288/1440) hinaus, damit Rundungen an der
// Tagesgrenze (siehe berlinDayRangeUtcMs) nie eine fehlende Randkerze verursachen — trimAndFormat
// schneidet exakt auf den Tag zurecht.
const EXPORT_TIMEFRAMES = [
  { key: "1h", bar: "1h", count: 30 },
  { key: "5m", bar: "5m", count: 300 },
  { key: "1m", bar: "1m", count: 1500 },
];

const TIME_FORMATTER = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Berlin" });
// "longOffset" liefert z.B. "GMT+2" — DST-aware statt fixem Offset, siehe CLAUDE.md
// "Trading-hours/timezone handling".
const OFFSET_FORMATTER = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", timeZoneName: "longOffset" });

function berlinOffsetMinutes(utcMs) {
  const part = OFFSET_FORMATTER.formatToParts(new Date(utcMs)).find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  const match = part.match(/GMT([+-]\d+)/);
  return match ? Number(match[1]) * 60 : 0;
}

// Wandelt "YYYY-MM-DD" (als Berlin-Kalendertag gemeint) in UTC-ms-Grenzen [start, end) um. Offset
// wird an der Mitternachts-Guess-Zeit bestimmt — für den theoretischen Fall einer DST-Umstellung
// exakt um Mitternacht wäre das ungenau, kommt in Europe/Berlin aber nicht vor (Umstellung ist
// immer um 02:00/03:00).
export function berlinDayRangeUtcMs(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, 0, 0, 0);
  const offsetMin = berlinOffsetMinutes(utcGuess);
  const startUtcMs = utcGuess - offsetMin * 60_000;
  return { startUtcMs, endUtcMs: startUtcMs + 86_400_000 };
}

function trimAndFormat(rawCandles, startSec, endSec) {
  return rawCandles
    .filter((c) => c.time >= startSec && c.time < endSec)
    .map((c) => ({
      time: TIME_FORMATTER.format(new Date(c.time * 1000)),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));
}

export async function buildBacktestExport({ asset, dateStr }) {
  const { startUtcMs, endUtcMs } = berlinDayRangeUtcMs(dateStr);
  const startSec = startUtcMs / 1000;
  const endSec = endUtcMs / 1000;

  const candles = {};
  for (const tf of EXPORT_TIMEFRAMES) {
    const raw = await fetchInitialCandles(asset, tf.bar, tf.count, endUtcMs);
    candles[tf.key] = trimAndFormat(raw, startSec, endSec);
  }

  return { asset, date: dateStr, timezone: "Europe/Berlin", candles };
}
