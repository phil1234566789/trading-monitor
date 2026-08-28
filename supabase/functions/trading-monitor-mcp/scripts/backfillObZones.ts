// Einmaliges Backfill-Script für ob_zones aus dem forex_candles-Archiv (Chat 2026-08-09,
// Sidequest: "Lana braucht schon die ganzen OBs (4h 1h M5 bei entry setup)" für Backtests eines
// festen historischen Zeitraums). Läuft dieselbe Erkennung, die auch poi-watcher live nutzt
// (`detectOrderBlocks`, siehe orderBlockDetection.js — bewusst dependency-frei rausgeschnitten,
// genau für diesen Anwendungsfall) einmalig über die KOMPLETTE archivierte Kerzenserie statt
// nur über ein rollierendes Live-Fenster — die Funktion ist rein (touched/invalidated/end_time
// werden deterministisch aus der übergebenen Kerzenserie berechnet), braucht also keinen
// Live-Zustand.
//
// KEIN Telegram-Versand hier (kein sendTelegram-Import) — das Script schreibt nur `ob_zones`,
// nie an Philip. `notified`/`notified_at` werden so gesetzt, dass poi-watcher später keinen
// rückwirkenden Alarm für eine beim Backfill schon "touched" vorgefundene Zone feuert (dieselbe
// "historischer Alt-Touch beim ersten Erkennen"-Logik, die poi-watcher/index.ts für neue Zonen
// ohne `existing`-Zeile schon selbst hat).
//
// M5 wird HIER bewusst mit persistiert (anders als poi-watchers eigener Live-Cron, der M5 nie
// anfasst, siehe TIMEFRAMES dort — nur 1H/4H) — Migration 20260809130000_ob_zones_allow_5m.sql
// hat den timeframe-CHECK-Constraint dafür erweitert. Für einen fixen Backtest-Zeitpunkt bringt
// "live neu berechnen" keinen Vorteil gegenüber einmal persistieren (Chat-Entscheidung 2026-08-09).
//
// Voraussetzung: forex_candles muss den gewünschten Zeitraum für JEDEN Timeframe schon abdecken
// (siehe backfillForexCandles.ts) — dieses Script liest nur, holt nichts von cTrader selbst.
//
// 2026-08-27 von der Node-Autoren-Kopie (mcp-server/, gelöscht) nach Deno portiert, einzige
// verbleibende Kopie — process.env → Deno.env.get, Cross-Directory-Import aus ../../../src/ ersetzt
// durch die lokale, bereits vorhandene Kopie ../orderBlockDetection.js, sonst unverändert:
//
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... [BACKFILL_INSTRUMENTS=GBPUSD] [BACKFILL_BARS=5m,1h,4h] \
//     deno run --allow-net --allow-env \
//     supabase/functions/trading-monitor-mcp/scripts/backfillObZones.ts
import { supabase } from "../supabaseClient.ts";
import { detectOrderBlocks } from "../orderBlockDetection.js";

// forex_candles.bar ("5m"/"1h"/"4h", unsere eigene Konvention, siehe backfillForexCandles.ts) auf
// die von detectOrderBlocks() erwarteten Timeframe-Labels UND den ob_zones.timeframe-Spaltenwert
// gemappt — beide sind uneinheitlich großgeschrieben (siehe orderBlockDetection.js:
// LOWER_TF_LABELS ["1m","3m","5m"] vs. HTF_FOREX_LABELS ["1H","4H"], und PriceChart.vue taggt M5-
// Zonen mit "5M", nicht "5m") — kein Vertippen riskieren, deshalb eine explizite Tabelle statt
// einer .toUpperCase()-Heuristik.
const BAR_CONFIG: Record<string, { detectParam: string; dbTimeframe: string }> = {
  "5m": { detectParam: "5m", dbTimeframe: "5M" },
  "1h": { detectParam: "1H", dbTimeframe: "1H" },
  "4h": { detectParam: "4H", dbTimeframe: "4H" },
};

const INSTRUMENTS = (Deno.env.get("BACKFILL_INSTRUMENTS") ?? "GBPUSD").split(",").map((s) => s.trim());
const BARS = (Deno.env.get("BACKFILL_BARS") ?? "5m,1h,4h").split(",").map((s) => s.trim());

const READ_PAGE_SIZE = 5000; // Supabase-Read-Pagination — M5 übers ganze Jahr sind >70k Zeilen, weit über dem PostgREST-Default-Limit
const UPSERT_BATCH_SIZE = 500;

interface CandleRow {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Liest die KOMPLETTE archivierte Kerzenserie für instrument+bar, aufsteigend sortiert — via
// .range()-Pagination, da eine einzelne Supabase-Anfrage serverseitig gedeckelt ist.
async function fetchAllCandles(instrument: string, bar: string): Promise<CandleRow[]> {
  const all: CandleRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("forex_candles")
      .select("time, open, high, low, close, volume")
      .eq("instrument", instrument)
      .eq("bar", bar)
      .order("time", { ascending: true })
      .range(from, from + READ_PAGE_SIZE - 1);
    if (error) throw new Error(`Kerzen lesen fehlgeschlagen (${instrument} ${bar}): ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data.map((r) => ({ ...r, time: Math.floor(new Date(r.time as unknown as string).getTime() / 1000) })));
    // Bug (Chat 2026-08-09, im ersten Testlauf aufgefallen: nur 1000 statt 44882 M5-Kerzen
    // gelesen): PostgREST deckelt eine einzelne Response serverseitig (offenbar max_rows=1000),
    // UNABHÄNGIG von der per .range() angefragten Größe — data.length < READ_PAGE_SIZE ist daher
    // KEIN verlässliches "letzte Seite erreicht"-Signal, das kann auch nur der Server-Cap sein.
    // Um die tatsächlich zurückgegebene Anzahl weiterzählen statt um READ_PAGE_SIZE, sonst werden
    // bei einem kleineren Server-Cap ganze Bereiche übersprungen. Nur ein wirklich leeres Ergebnis
    // (oben) heißt "fertig".
    from += data.length;
  }
  return all;
}

// Bug-Report Philip 2026-08-23: eine Zone (start_time außerhalb von poi-watchers rollierendem
// Live-Fenster, siehe FOREX_H4_LOOKBACK_CANDLES in poi-watcher/index.ts) wurde real vom Preis
// getouched (sogar invalidated), blieb in der DB aber für immer touched=false, weil poi-watchers
// "if (candles)"-Zweig eine Zone außerhalb des Fensters nie wieder aus `zones` bekommt. Analog zu
// backfillLiquidityLevels.ts: für jede vorhandene, noch touched=false-Zeile, deren Zustand laut der
// REINEN Archiv-Neuberechnung (detectOrderBlocks über die komplette Kerzenserie, s.o.) tatsächlich
// schon touched/invalidated ist, wird die Zeile aktualisiert.
//
// KEIN analoger "end_time nachziehen"-Fall für weiterhin korrekt untouched Zonen (früherer Versuch,
// wieder verworfen, Chat 2026-08-23) — orderBlocks.js' ZonePaneView zeichnet eine noch aktive Zone
// jetzt bis zur letzten geladenen Kerze statt bis zu einem gespeicherten end_time-Wert (derselbe
// Bug-Report), also liest fürs Rendering niemand mehr end_time einer untouched Zeile. Ein
// Nachziehen hier wäre reine Arbeit ohne Leser.
async function correctMissedTouches(instrument: string, dbTimeframe: string, zones: ReturnType<typeof detectOrderBlocks>) {
  const { data: existingRows, error } = await supabase
    .from("ob_zones")
    .select("start_time, direction, top, bottom, touched")
    .eq("instrument", instrument)
    .eq("timeframe", dbTimeframe)
    .eq("touched", false);
  if (error) throw new Error(`OB-Zonen lesen fehlgeschlagen (${instrument} ${dbTimeframe}): ${error.message}`);
  if (!existingRows || existingRows.length === 0) return 0;

  const untouchedKeys = new Set(
    existingRows.map((r) => `${r.direction}_${Math.floor(new Date(r.start_time).getTime() / 1000)}`),
  );

  let corrected = 0;
  for (const z of zones) {
    if (!z.touched) continue;
    const direction = z.dir === 1 ? "long" : "short";
    const key = `${direction}_${z.startTime}`;
    if (!untouchedKeys.has(key)) continue;

    const { error: updateError } = await supabase
      .from("ob_zones")
      .update({ touched: true, invalidated: z.invalidated, end_time: new Date(z.endTime * 1000).toISOString(), notified: true })
      .eq("instrument", instrument)
      .eq("timeframe", dbTimeframe)
      .eq("direction", direction)
      .eq("start_time", new Date(z.startTime * 1000).toISOString());
    if (updateError) throw new Error(`OB-Zone korrigieren fehlgeschlagen (${instrument} ${dbTimeframe}): ${updateError.message}`);
    corrected += 1;
  }
  return corrected;
}

async function upsertZones(instrument: string, dbTimeframe: string, zones: ReturnType<typeof detectOrderBlocks>) {
  for (let i = 0; i < zones.length; i += UPSERT_BATCH_SIZE) {
    const batch = zones.slice(i, i + UPSERT_BATCH_SIZE).map((z) => ({
      instrument,
      timeframe: dbTimeframe,
      direction: z.dir === 1 ? "long" : "short",
      top: z.top,
      bottom: z.bottom,
      weak: z.weak,
      touched: z.touched,
      invalidated: z.invalidated,
      start_time: new Date(z.startTime * 1000).toISOString(),
      end_time: new Date(z.endTime * 1000).toISOString(),
      alert_price: null,
      // Wie poi-watcher/index.ts's !existing-Zweig: schon beim ersten Erkennen touched -> als
      // "notified" markieren, damit poi-watcher hier später keinen rückwirkenden Alarm feuert,
      // aber notified_at bleibt null (kein echter Versand fand je statt).
      notified: z.touched,
      notified_at: null,
    }));
    // ignoreDuplicates statt Update: eine bereits vorhandene Zeile kann von poi-watchers Live-Lauf
    // stammen (überlappender Zeitraum, z.B. Juli/August) und dessen intraday-Live-Preis-Touch-
    // Erkennung ist genauer als unsere reine Kerzenschluss-Berechnung — die soll eine bereits
    // live getrackte Zone nie zurücksetzen. Für Zonen, die es noch nicht gibt (der eigentliche
    // Zweck hier), ist das Ergebnis ohnehin deterministisch identisch bei jedem erneuten Lauf.
    const { error } = await supabase
      .from("ob_zones")
      .upsert(batch, { onConflict: "instrument,timeframe,start_time,direction", ignoreDuplicates: true });
    if (error) throw new Error(`OB-Zonen upserten fehlgeschlagen (${instrument} ${dbTimeframe}): ${error.message}`);
  }
}

async function backfillOne(instrument: string, bar: string) {
  const config = BAR_CONFIG[bar];
  if (!config) throw new Error(`Unbekannter Timeframe: ${bar} (erlaubt: ${Object.keys(BAR_CONFIG).join(", ")})`);

  const candles = await fetchAllCandles(instrument, bar);
  if (candles.length === 0) {
    console.warn(`${instrument} ${bar}: keine archivierten Kerzen gefunden, übersprungen.`);
    return;
  }
  const zones = detectOrderBlocks(candles, config.detectParam, true);
  const corrected = await correctMissedTouches(instrument, config.dbTimeframe, zones);
  await upsertZones(instrument, config.dbTimeframe, zones);
  console.log(
    `${instrument} ${bar} (${candles.length} Kerzen): ${zones.length} OB-Zonen erkannt/gesichert, ${corrected} verpasste Touches korrigiert.`,
  );
}

for (const instrument of INSTRUMENTS) {
  for (const bar of BARS) {
    await backfillOne(instrument, bar);
  }
}
