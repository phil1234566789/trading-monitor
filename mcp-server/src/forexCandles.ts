import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabaseClient.js";
import { getForexCandlesArchiveUpTo } from "./db.js";

// Node-Port von src/forexCandles.js — ruft dieselbe `forex-candles` Edge Function auf, mit dem
// anon-key als Bearer-Token (exakt das Pattern, das pg_cron laut
// supabase/migrations/20260705200000_poi_watcher_cron.sql schon für den JWT-Gate der Function nutzt).
const FOREX_FN_URL = `${SUPABASE_URL}/functions/v1/forex-candles`;
const REQUEST_TIMEOUT_MS = 20_000;

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Exportiert (statt privat), damit backfillForexCandles.ts das aufrufen kann — Bug-Report Philip
// 2026-08-10: das Script (dessen ganzer Zweck ist, frisch von cTrader zu lesen und ins Archiv zu
// SCHREIBEN) importierte bisher fetchForexCandles unten, das archive-first ist. Sobald der
// Backfill-Lauf selbst schon ein paar Zeilen fürs gerade laufende Instrument/Timeframe geschrieben
// hatte, griffen SPÄTERE Seiten desselben Laufs auf genau diese frisch geschriebenen (aber noch
// unvollständigen) Archiv-Zeilen zu — ein Teiltreffer löste denselben "Live-Rest nachladen"-Zweig
// aus wie bei jedem anderen Aufrufer, nur dass hier der zurückgegebene Kerzen-Umfang nicht mehr
// zur eigenen Pagination-Cursor-Arithmetik des Backfill-Scripts passte (Lücken/Doppelungen
// riskiert). Ein Backfill-Script darf nie im Archiv lesen, das es selbst gerade befüllt.
export async function fetchLiveForexCandles(symbol: string, bar: string, { count, toMs }: { count: number; toMs?: number }): Promise<Candle[]> {
  const params = new URLSearchParams({ symbol, period: bar, count: String(count) });
  if (toMs) params.set("to", String(toMs));
  const res = await fetch(`${FOREX_FN_URL}?${params}`, {
    headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json; // oldest zuerst
}

// Bug-Report Philip 2026-08-10: Lana versuchte für ein GBPUSD-Datum mitten im archivierten
// Bereich (03.06.2026) trotzdem 3× live cTrader, bevor sie sich selbst mit
// get_forex_candles_archive beholfen hat — dieses Modul (genutzt von get_data_export,
// get_forex_rsi/-ema via indicatorWindow.ts, UND dem get_forex_candles-Tool selbst) rief bisher
// ausschließlich fetchLiveForexCandles auf. Das neue Archiv-Tool war nur eine ZUSÄTZLICHE,
// separat aufzurufende Option, kein automatischer Ersatz — dieselbe Lücke wie beim Frontend-Chart
// vor dem DB-first-Fix, nur hier noch nicht geschlossen. Jetzt exakt dasselbe Muster wie
// src/forexCandles.js's fetchInitialCandles: erst das Archiv bis toMs/"jetzt", live nur noch für
// den Rest danach — schlägt der Live-Rest fehl, wird NICHT geworfen, sondern der archivierte
// Stand zurückgegeben. Gilt jetzt für JEDEN Aufrufer dieser Funktion, ohne dass dataExport.ts/
// indicatorWindow.ts selbst etwas davon wissen müssen.
//
// Bug-Report Philip 2026-08-10 (zweiter Fund, selbe Ursache wie im Frontend-Chart): `forex_candles`
// wird nur durch den einmaligen Backfill-Lauf gefüllt, es gibt keinen laufenden Sync (siehe
// CLAUDE.md "Persisted candle archive") — die neueste archivierte Kerze kann also beliebig alt
// sein, auch wenn `archived.length >= count` längst erfüllt ist (genug Historie != aktuell). Ohne
// Frische-Check hätte Laniakea an einem Montag nach dem WE für "jetzt" den Freitagsschluss aus dem
// Archiv bekommen, exakt wie beim Frontend-Chart. Fix: neueste archivierte Kerze gegen toMs prüfen,
// bei Veraltung (>1,5 Bar-Perioden) IMMER live nachladen statt nur bei zu wenigen Archiv-Zeilen.
const BAR_SECONDS: Record<string, number> = { "1m": 60, "3m": 180, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400 };
function barSecondsFor(bar: string): number {
  return BAR_SECONDS[bar.toLowerCase()] ?? 60;
}

export async function fetchForexCandles(symbol: string, bar: string, { count, toMs }: { count: number; toMs?: number }): Promise<Candle[]> {
  const now = toMs ?? Date.now();
  const toIso = new Date(now).toISOString();
  const archived = await getForexCandlesArchiveUpTo(symbol, bar, count, toIso);
  if (!archived) return fetchLiveForexCandles(symbol, bar, { count, toMs });

  const lastArchivedMs = archived[archived.length - 1].time * 1000;
  const isStale = now - lastArchivedMs > barSecondsFor(bar) * 1000 * 1.5;
  if (archived.length >= count && !isStale) return archived;

  try {
    const liveCount = archived.length >= count ? count : count - archived.length;
    const rest = await fetchLiveForexCandles(symbol, bar, { count: liveCount, toMs });
    const merged = archived.concat(rest.filter((c) => c.time * 1000 > lastArchivedMs));
    return merged.slice(-count);
  } catch (err) {
    console.error("Live-Rest seit Archiv-Ende fehlgeschlagen, gebe nur archivierten Stand zurück:", err);
    return archived;
  }
}
