// Rohdaten-Export fürs Forex-Backtesting (siehe trading/backtest-instructions.md) — liefert M5-
// Kerzen für einen kompletten Berlin-Kalendertag, aufbereitet für Copy/Paste in den Claude-
// Project-Chat. Bewusst NUR Rohdaten, keine vorberechneten OB-/Liquiditätszonen — die Setup-
// Erkennung soll laut Plan im Claude Project anhand der Strategie-Dokumente passieren, nicht hier
// dupliziert werden.
import { fetchInitialCandles } from "./forexCandles.js";
import { fmtDateTime } from "./format.js";

// Aktuell nur GBPUSD: EURUSD bräuchte zusätzlich DXY als Kontext (siehe backtest-instructions.md),
// das ist noch nicht umgesetzt — Liste bewusst als einzige Quelle der Wahrheit fürs Modal-Dropdown,
// damit EURUSD nicht versehentlich auswählbar ist, bevor die Datengrundlage dafür steht.
export const BACKTEST_ASSETS = ["GBPUSD"];

// Asia-Session laut Philip: 00:00-07:00 Europe/Berlin, separat ausgewertet (Range/Pips fürs
// Volatilitätsgefühl) statt nur als Teil der normalen M5-Kerzenliste. Alles ab 07:00 (nach Asia)
// ist der eigentliche Handelsbereich.
const ASIA_SESSION_END_HOUR = 7;
// 1 Pip = 0.0001 bei GBPUSD/EURUSD (5. Nachkommastelle ist die Pipette) — siehe CLAUDE.md/Twelve-
// Data-Client-Kommentar zu 5-Dezimalstellen-Präzision bei Forex.
const PIP_SIZE = 0.0001;
// Puffer über die reine Tageslänge (288 M5-Kerzen/Tag) hinaus, damit Rundungen an der Tagesgrenze
// (siehe berlinDayRangeUtcMs) nie eine fehlende Randkerze verursachen — der Tages-Filter unten
// schneidet ohnehin exakt auf [start, end) zurecht.
const M5_FETCH_COUNT = 300;

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

// Berlin-Kalendertag ("YYYY-MM-DD") eines Unix-Sekunden-Zeitpunkts — fürs Vorbelegen des
// Datumsfelds im Modal, wenn Replay aktiv ist (siehe BacktestExportModal.vue). "en-CA" liefert
// direkt das ISO-Format, ohne Teile manuell zusammenzusetzen.
const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" });
export function berlinDateStrFor(unixSec) {
  return DATE_FORMATTER.format(new Date(unixSec * 1000));
}

function formatCandle(c) {
  return {
    time: TIME_FORMATTER.format(new Date(c.time * 1000)),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  };
}

function rangeStats(rawCandles) {
  if (rawCandles.length === 0) return { rangeHigh: null, rangeLow: null, pips: null };
  const rangeHigh = Math.max(...rawCandles.map((c) => c.high));
  const rangeLow = Math.min(...rawCandles.map((c) => c.low));
  const pips = Math.round(((rangeHigh - rangeLow) / PIP_SIZE) * 10) / 10;
  return { rangeHigh, rangeLow, pips };
}

// replayUntilSec (optional): wenn gesetzt, wird NICHTS über diesen Zeitpunkt hinaus aufgedeckt —
// simuliert fürs Backtesting bewusst "wir kennen den weiteren Tagesverlauf noch nicht", statt den
// kompletten Tag (inkl. Ausgang) auf einmal zu zeigen. Gleiche `<=`-Grenze wie clipReplay()
// (PriceChart.vue), damit ein per Replay eingestellter Zeitpunkt exakt dieselbe letzte Kerze zeigt
// wie im Chart selbst. Liegt der gewählte Tag komplett vor replayUntilSec, hat das keinen Effekt;
// liegt er komplett danach, kommt korrekterweise ein leerer Export raus (noch nichts "bekannt").
export async function buildBacktestExport({ asset, dateStr, replayUntilSec = null }) {
  const { startUtcMs, endUtcMs } = berlinDayRangeUtcMs(dateStr);
  const startSec = startUtcMs / 1000;
  const endSec = endUtcMs / 1000;
  const asiaEndSec = startSec + ASIA_SESSION_END_HOUR * 3600;

  const raw = await fetchInitialCandles(asset, "5m", M5_FETCH_COUNT, endUtcMs);
  const dayCandles = raw.filter(
    (c) => c.time >= startSec && c.time < endSec && (replayUntilSec == null || c.time <= replayUntilSec),
  );
  const asiaCandlesRaw = dayCandles.filter((c) => c.time < asiaEndSec);
  const mainCandlesRaw = dayCandles.filter((c) => c.time >= asiaEndSec);

  // "Aktuelle Zeit" aus Sicht dieses Snapshots — bei aktivem Replay der simulierte Zeitpunkt (bis
  // wohin aufgedeckt wurde), sonst die echte Wanduhrzeit. Hieß vorher generatedAt und zeigte auch
  // bei aktivem Replay immer die echte Klickzeit — Philip: "die info wann ich da genau drauf
  // drücke juckt nicht wirklich, entscheidend ist was die aktuelle Zeit des Snapshots ist".
  const currentTimeSec = replayUntilSec ?? Math.floor(Date.now() / 1000);

  return {
    asset,
    date: dateStr,
    timezone: "Europe/Berlin",
    currentTime: fmtDateTime(currentTimeSec),
    // untilAt dupliziert currentTime bei aktivem Replay (Philip: "ist ja dasselbe Objekt wie aus
    // dem Replay-Modus" — gleiche Form wie PriceChart.vue's replay-Metadaten, bewusst konsistent
    // gehalten statt hier abzuweichen, nur um die paar Zeichen Redundanz zu sparen).
    replay: replayUntilSec == null ? { active: false } : { active: true, until: replayUntilSec, untilAt: fmtDateTime(replayUntilSec) },
    asiaSession: {
      ...rangeStats(asiaCandlesRaw),
      candles: asiaCandlesRaw.map(formatCandle),
    },
    candles: mainCandlesRaw.map(formatCandle),
  };
}
