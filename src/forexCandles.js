// Forex-Kerzen (GBPUSD/EURUSD) über die `forex-candles`-Edge-Function. Backend war Twelve Data
// (Nachfolger von ctraderCandles.js, siehe Chat 2026-07-22), seit 2026-08-03 wieder cTrader
// (neues Pepperstone-Demokonto statt der zuvor deaktivierten Prop-Firm-Challenge, siehe
// forex-candles/index.ts und _shared/ctrader/client.ts) — die Response-Form/das Bar-Label-Mapping
// hier am Frontend blieb dabei unverändert, deshalb hat sich an diesem File selbst kaum was
// geändert. Antwortform {time,open,high,low,close,volume}, oldest-first.
import { supabase } from "./supabaseClient.js";
import { barSecondsFor } from "./timeframes.js";

const FOREX_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/forex-candles`;
// Die Edge Function baut pro Request eine frische cTrader-TLS-Verbindung inkl. Auth-Handshake auf
// (_shared/ctrader/client.ts) — ein großzügiger Client-Timeout schadet trotzdem nicht (siehe Chat:
// HTTP-Aktivitäts-Indikator blieb bei einem hängenden Fetch dauerhaft "an").
const REQUEST_TIMEOUT_MS = 20_000;

// Netzwerkfehler (TypeError "Failed to fetch") und ein abgelaufener AbortSignal.timeout (DOMException
// "TimeoutError") sind IMMER einen Retry wert. Eine reguläre HTTP-Fehlerantwort dagegen nur, wenn
// die Edge Function selbst mit 502 antwortet (forex-candles/index.ts nutzt 502 als Catch-All für
// alles, was beim cTrader-Handshake schiefgeht — inkl. des eigenen Connect-Timeouts in
// _shared/ctrader/client.ts, siehe Bug-Report Philip 2026-08-07 im M1-Live-Test: genau DAS ist der
// häufigste, transiente Fall, ein 400 bei z.B. einem unbekannten Timeframe-Label wäre dagegen beim
// Retry identisch nochmal falsch). status wird unten am Error mitgegeben, um das zu unterscheiden.
function isRetryable(err) {
  if (err instanceof TypeError || err?.name === "TimeoutError" || err?.name === "AbortError") return true;
  return err?.status === 502;
}

async function fetchCandlesOnce(symbol, bar, { count, to } = {}) {
  const params = new URLSearchParams({ symbol, period: bar, count: String(count) });
  if (to) params.set("to", String(to));
  const res = await fetch(`${FOREX_FN_URL}?${params}`, {
    headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json; // oldest zuerst
}

async function fetchCandlesBatchOnce(items) {
  const res = await fetch(FOREX_FN_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: items.map((it) => ({ symbol: it.symbol, period: it.bar, count: it.count, to: it.to })),
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json.results; // Array von Kerzen-Arrays, gleiche Reihenfolge wie `items`
}

// Bug-Report Philip 2026-08-07: seit dem Umstieg auf cTrader kommt "signal timed out"/eine 502
// ständig, vor allem im Live-Modus — die Edge Function baut PRO Request eine frische cTrader-TLS-
// Verbindung + Auth-Handshake auf (kein Pooling, siehe _shared/ctrader/client.ts). Ein einmaliger
// Retry bei transienten Fehlern (siehe isRetryable) fängt vereinzelte Handshake-Hänger/-Ausreißer
// ab, ohne dauerhaft kaputte Requests (z.B. ein 400) endlos zu wiederholen.
async function fetchSingleWithRetry(symbol, bar, opts) {
  try {
    return await fetchCandlesOnce(symbol, bar, opts);
  } catch (err) {
    if (!isRetryable(err)) throw err;
    return await fetchCandlesOnce(symbol, bar, opts);
  }
}

// Der eigentliche Grund für die gehäuften Timeouts: PriceChart.vue feuert beim Mount mehrere
// unabhängige Forex-Fetches gleichzeitig (Haupt-Kerzen/M5-Trade-Setups/1H-Ranges/4H-OBs) — ohne
// Bündelung öffnet jeder davon SEINE EIGENE cTrader-Verbindung, mehrere gleichzeitige Handshakes
// gegen denselben Account begünstigen Kollisionen/Hänger. `poi-watcher` hat genau dafür schon
// `fetchTrendbarsBatch` (eine Verbindung, mehrere Trendbar-Requests) — dasselbe Muster hier auf
// Transport-Ebene: Calls, die innerhalb von BATCH_WINDOW_MS ankommen, werden zu einem POST-Request
// zusammengefasst statt N GETs parallel zu feuern. Bewusst HIER (statt PriceChart.vue umzubauen) —
// loadInitial/loadTradeSetupM5/loadRangesCandles/loadObs4hCandles behalten ihre eigene Sequenz-
// Guard-/Replay-/Cache-Logik unverändert, das Bündeln passiert transparent darunter. Ein einzelner,
// isoliert ankommender Call (z.B. ein Poll auf Kerzenschluss) bekommt nach BATCH_WINDOW_MS ganz
// normal seinen eigenen GET-Request — kein Batch-Overhead für den häufigsten Fall.
const BATCH_WINDOW_MS = 50;
let pendingBatch = null; // { items: [{symbol,bar,count,to,resolve,reject}] }

function flushBatch(batch) {
  const { items } = batch;
  if (items.length === 1) {
    const it = items[0];
    fetchSingleWithRetry(it.symbol, it.bar, { count: it.count, to: it.to }).then(it.resolve, it.reject);
    return;
  }
  (async () => {
    try {
      let results;
      try {
        results = await fetchCandlesBatchOnce(items);
      } catch (err) {
        if (!isRetryable(err)) throw err;
        results = await fetchCandlesBatchOnce(items);
      }
      items.forEach((it, i) => it.resolve(results[i]));
    } catch (err) {
      items.forEach((it) => it.reject(err));
    }
  })();
}

function fetchCandles(symbol, bar, { count, to } = {}) {
  return new Promise((resolve, reject) => {
    if (!pendingBatch) {
      pendingBatch = { items: [] };
      setTimeout(() => {
        const batch = pendingBatch;
        pendingBatch = null;
        flushBatch(batch);
      }, BATCH_WINDOW_MS);
    }
    pendingBatch.items.push({ symbol, bar, count, to, resolve, reject });
  });
}

// Pilot-Backfill (Chat 2026-08-09, siehe CLAUDE.md "Persisted candle archive"): nur diese drei
// Timeframes und nur GBPUSD sind aktuell in forex_candles gefüllt (Migration
// 20260809120000_forex_candles.sql) — EURUSD oder andere Timeframes liefern hier einfach 0 Zeilen
// zurück, kein Sonderfall nötig, aber der Set spart pro Miss eine unnötige Supabase-Anfrage.
const DB_ARCHIVED_BARS = new Set(["5m", "1h", "4h"]);

function mapArchivedRows(rows) {
  return rows
    .map((r) => ({
      time: Math.floor(new Date(r.time).getTime() / 1000),
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
    }))
    .reverse(); // Rows kommen "neueste zuerst" (fürs LIMIT auf den jüngsten Teil), Rest der App erwartet oldest-first
}

// Supabase/PostgREST deckelt eine einzelne Response serverseitig bei diesem Wert (empirisch
// bestätigt) — UNABHÄNGIG davon, wie groß .limit()/.range() angefragt wird, kein Fehler, einfach
// weniger Zeilen als erbeten. Bug-Report Philip 2026-08-09: ein Replay-Sprung auf GBPUSD M5
// (INITIAL_CANDLE_COUNT 1000 + REPLAY_LOOKAHEAD_SEC-Kerzen, macht zusammen 3500) zeigte fast gar
// keine Kerzen — fetchArchivedPage unten fragte 3500 an, bekam still 1000 zurück (aus einem
// Zeitfenster WEIT NACH dem eigentlichen Replay-Punkt, weil "neueste zuerst" ja beim Lookahead-
// Ende ansetzt), der komplette eigentlich sichtbare Bereich fehlte. Per Pagination gefixt.
const DB_READ_PAGE_SIZE = 1000;

// Liest bis zu `count` archivierte Kerzen absteigend ab einer Zeitgrenze — entweder `ltIso`
// (exklusiv, für Scroll-Back: strikt VOR einer schon geladenen Kerze) oder `lteIso` (inklusiv,
// für Initial-/TF-Wechsel-Load: bis EINSCHLIESSLICH eines Zeitpunkts). Paginiert in
// DB_READ_PAGE_SIZE-Schritten statt eines einzelnen großen .limit(count) (siehe oben) — jede
// Folgeseite grenzt exklusiv an die vorherige an (sonst würde die Grenz-Kerze doppelt gezählt).
// null nur, wenn WIRKLICH nichts gefunden wurde (Signal an den Aufrufer: live fetchen) — bei
// einem Fehler nach bereits erfolgreich gelesenen Seiten lieber das Teilergebnis zurückgeben als
// alles wegzuwerfen.
async function fetchArchivedPage(symbol, bar, count, { ltIso, lteIso }) {
  if (!DB_ARCHIVED_BARS.has(bar)) return null;
  const rows = [];
  let boundary = ltIso ?? lteIso;
  let inclusive = ltIso == null;
  while (rows.length < count) {
    const pageLimit = Math.min(DB_READ_PAGE_SIZE, count - rows.length);
    let query = supabase
      .from("forex_candles")
      .select("time, open, high, low, close, volume")
      .eq("instrument", symbol)
      .eq("bar", bar)
      .order("time", { ascending: false })
      .limit(pageLimit);
    query = inclusive ? query.lte("time", boundary) : query.lt("time", boundary);
    const { data, error } = await query;
    if (error) {
      console.error("Kerzen-Archiv lesen fehlgeschlagen, falle auf Live-cTrader zurück:", error);
      break;
    }
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageLimit) break; // ehrlich weniger Historie vorhanden als angefragt, fertig
    boundary = data[data.length - 1].time; // ältestes in dieser Seite (data ist desc sortiert)
    inclusive = false;
  }
  if (rows.length === 0) return null;
  return mapArchivedRows(rows);
}

// Die neuesten `count` archivierten Kerzen bis (inklusive) toIso — für den Initial-/TF-Wechsel-Load
// (siehe fetchInitialCandles unten).
async function fetchArchivedUpTo(symbol, bar, count, toIso) {
  return fetchArchivedPage(symbol, bar, count, { lteIso: toIso });
}

// toMs (optional, ms-Epoch): ohne das die neuesten `count` Kerzen bis "jetzt" — für den
// Replay-Modus (siehe PriceChart.vue: clipReplay/loadRangesCandles/loadTradeSetupCandles) muss
// der initiale Fetch aber bis zum Replay-Zeitpunkt zurückreichen, nicht bis zur echten aktuellen
// Zeit, sonst deckt ein festes count/Lookback-Fenster den geclippten Bereich nicht ab.
//
// Bug-Report Philip 2026-08-09: TF-Wechsel auf 1H hing komplett fest an einem cTrader-Timeout —
// dieser Fetch (via loadInitial/fetchCandlesCached, genutzt von JEDEM Forex-Erstladen: Haupt-
// Kerzen, loadTradeSetupM5, 1H-Ranges, 4H-OBs) lief bisher IMMER live, unabhängig vom DB-first-Fix
// für Scroll-Back oben. Jetzt erst das Archiv bis toMs/"jetzt", live nur noch für den Rest DANACH
// — schlägt der Live-Rest fehl, wird NICHT geworfen, sondern einfach der (leicht veraltete)
// Archiv-Stand zurückgegeben. Lieber ein paar Minuten alter Chart als ein hängender.
//
// Bug-Report Philip 2026-08-10: Live-Modus GBPUSD blieb komplett am Freitag-Marktschluss hängen,
// obwohl am Montag längst neue Asia-Session-Kerzen existierten. Ursache: `forex_candles` wird NUR
// durch den einmaligen Backfill-Lauf gefüllt, es gibt (noch) keinen laufenden Sync (siehe
// CLAUDE.md "Persisted candle archive") — das Archiv hat also immer genug Zeilen für
// `archived.length >= count`, aber die NEUESTE archivierte Kerze kann beliebig alt sein (hier:
// der letzte Kerzenschluss vorm Wochenende). Der alte Code hat bei "genug Zeilen" den Live-Rest
// komplett übersprungen, egal wie veraltet die neueste Zeile war. Fix: die Frische der neuesten
// archivierten Kerze gegen toMs prüfen (>1,5 Bar-Perioden alt = potenziell veraltet) und in dem
// Fall IMMER live nachladen, dann mergen + auf `count` kappen — nicht mehr nur, wenn das Archiv zu
// wenige Zeilen hatte.
export async function fetchInitialCandles(symbol, bar, count, toMs) {
  const now = toMs ?? Date.now();
  const toIso = new Date(now).toISOString();
  const archived = await fetchArchivedUpTo(symbol, bar, count, toIso);
  if (!archived) return fetchCandles(symbol, bar, { count, to: toMs });

  const lastArchivedMs = archived[archived.length - 1].time * 1000;
  const isStale = now - lastArchivedMs > barSecondsFor(bar) * 1000 * 1.5;
  if (archived.length >= count && !isStale) return archived;

  try {
    const liveCount = archived.length >= count ? count : count - archived.length;
    const rest = await fetchCandles(symbol, bar, { count: liveCount, to: toMs });
    const merged = archived.concat(rest.filter((c) => c.time * 1000 > lastArchivedMs));
    return merged.slice(-count);
  } catch (err) {
    console.error("Live-Rest seit Archiv-Ende fehlgeschlagen, zeige nur archivierten Stand:", err);
    return archived;
  }
}

export async function fetchRecentCandles(symbol, bar, count) {
  return fetchCandles(symbol, bar, { count });
}

// Scroll-Back zuerst aus dem DB-Archiv statt live von cTrader (Bug-Report/Wunsch Philip
// 2026-08-09: "hast du schon eingebaut, dass wir zuerst in der DB die Candles holen"), da JEDER
// Live-Fetch einen eigenen cTrader-OAuth-Handshake kostet und genau das die Timeout-Serie hinter
// PriceChart.vue's showLoadOlderButton verursacht hat. `count` wird hier NICHT auf das
// cTrader-Live-Limit gekappt — Postgres liefert auch ein paar tausend Zeilen in einem Call
// problemlos, damit deckt ein einziger Scroll-Back-Schritt gleich mehrere Handelstage ab statt in
// 100er-Schritten nachzuladen. `null` (statt leerem Array) heißt "hier nicht anwendbar/nichts
// gefunden" und ist das Signal für den Aufrufer, auf den Live-Fetch zurückzufallen — ein
// tatsächlich leeres Live-Ergebnis (echtes Ende der Historie) bleibt dagegen ein echtes `[]`.
// Wochenend-/Feiertagslücken (Markt zu, ~60h Fr-Abend bis So-Abend, gelegentlich mehr bei
// Feiertagen) sind ECHTE Marktschließzeiten, kein Bug — dieselbe Abwägung wie candleCache.js'
// MAX_ACCEPTABLE_GAP_SEC (dort 4 Tage, siehe Kommentar dort). Ein Schwellwert nah an einer
// Bar-Periode würde JEDEN Wochenend-Scroll fälschlich als Archiv-Lücke werten und unnötig live
// nachfetchen — genau der Timeout-Fall, den der DB-first-Ansatz eigentlich vermeiden soll.
const MAX_ARCHIVE_GAP_SEC = 4 * 24 * 3600;

async function fetchOlderCandlesFromDb(symbol, bar, oldestLoadedTime, count) {
  const page = await fetchArchivedPage(symbol, bar, count, { ltIso: new Date(oldestLoadedTime * 1000).toISOString() });
  if (!page) return null;
  // Lücken-Check: `forex_candles` wächst nicht automatisch mit (kein laufender Sync, nur ein
  // manueller Backfill-Lauf, siehe CLAUDE.md "Persisted candle archive") — die neueste archivierte
  // Kerze kann dadurch beliebig weit vor oldestLoadedTime liegen, obwohl bei cTrader live
  // durchgehend Daten existieren. Ohne diesen Check würde loadOlderCandlesNow eine NICHT an
  // oldestLoadedTime anschließende Kerzenreihe klaglos vor die schon geladenen Kerzen hängen —
  // sichtbare Lücke im Chart (Bug-Report Philip 2026-08-18: EURUSD M5 fehlte 07.08. 22:55 bis
  // 13.08. 11:40 komplett, weil das Archiv seit 07.08. 20:55 UTC nicht mehr weitergewachsen ist —
  // ein Zeitraum weit über jede plausible Wochenend-/Feiertagslücke hinaus). null zurückgeben
  // lässt den Aufrufer stattdessen live nachfetchen, wie bei einem echten Archiv-Miss.
  const newestArchived = page[page.length - 1].time;
  if (oldestLoadedTime - newestArchived > MAX_ARCHIVE_GAP_SEC) return null;
  return page;
}

// Für Scroll-Back: Kerzen strikt vor `oldestLoadedTime` (Sekunden). Erst DB-Archiv versuchen
// (siehe fetchOlderCandlesFromDb), nur bei einem Miss (nicht abgedecktes Instrument/Timeframe/
// Zeitraum) live von cTrader nachfetchen — der Live-Zweig bleibt dabei unverändert vom
// count-Aufrufer abhängig, die forex-candles Edge Function kappt serverseitig ohnehin auf
// MAX_COUNT (aktuell 1000).
// `allowLive` (Bug-Report Philip 2026-08-23, siehe PriceChart.vue: loadOlderCandlesNow) — mit
// `false` liefert diese Funktion bei einem Archiv-Miss `null` statt automatisch live nachzufetchen,
// damit der Aufrufer erst eine Bestätigung einholen kann (weit Herauszoomen löste sonst eine
// automatische Kette mehrerer langsamer Live-Fetches aus, ohne dass der User eingreifen konnte).
// Default `true` (unverändertes Verhalten) für alle bestehenden Aufrufer.
export async function fetchOlderCandles(symbol, bar, oldestLoadedTime, count, { allowLive = true } = {}) {
  const fromDb = await fetchOlderCandlesFromDb(symbol, bar, oldestLoadedTime, count);
  if (fromDb) return fromDb;
  if (!allowLive) return null;
  const page = await fetchCandles(symbol, bar, { count, to: oldestLoadedTime * 1000 });
  return page.filter((c) => c.time < oldestLoadedTime);
}
