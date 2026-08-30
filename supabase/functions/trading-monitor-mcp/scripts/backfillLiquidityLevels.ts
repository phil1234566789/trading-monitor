// Einmaliges Backfill-Script für liquidity_levels aus dem forex_candles-Archiv (Bug-Report Philip
// 2026-08-23: ein Level vom Februar 2026 konnte nicht gepinnt werden — "Dieses Liquiditäts-Level
// ist noch nicht gespeichert" — weil poi-watchers Live-Erkennung nur über ein rollierendes
// FOREX_H1_LOOKBACK_CANDLES=3000-Fenster (~125 Tage) läuft, siehe poi-watcher/index.ts. Ein Pivot,
// der zu JEDEM Zeitpunkt seit der letzten Fenster-Erweiterung (2026-08-02) mehr als 125 Tage
// zurücklag, wurde dadurch nie persistiert, egal wie lange man wartet. Analog zu
// backfillObZones.ts: läuft dieselbe Erkennung, die auch poi-watcher live nutzt
// (`detectLiquidityLevels`, siehe liquidityDetection.js — bewusst dependency-frei, genau für
// diesen Anwendungsfall) einmalig über die KOMPLETTE archivierte Kerzenserie statt nur über
// das rollierende Live-Fenster — die Funktion ist rein (touched/endTime deterministisch aus der
// übergebenen Kerzenserie berechnet), braucht also keinen Live-Zustand.
//
// 4H seit derselben Nachbesserung (Philip: preisnahe relevante 4H-Level zusätzlich zu 1H) —
// poi-watcher erkennt/persistiert 4H jetzt genauso wie 1H (siehe 20260823140000_liquidity_levels_
// allow_4h.sql), also braucht auch der Backfill beide Timeframes.
//
// KEIN Telegram-Versand hier (kein sendTelegram-Import) — das Script schreibt nur
// `liquidity_levels`, nie an Philip. `notified`/`notified_at` werden so gesetzt, dass poi-watcher
// später keinen rückwirkenden Alarm für ein beim Backfill schon "touched" vorgefundenes Level
// feuert (dieselbe "historischer Alt-Touch beim ersten Erkennen"-Logik wie poi-watcher/index.ts
// für neue Level ohne `existing`-Zeile) — end_time bleibt bei einem UNBERÜHRTEN Level explizit
// null (nicht der letzte Kerzen-Zeitpunkt), exakt wie poi-watchers eigene Konvention
// (endTimeIso: !lvl.touched ? null : ...), sonst würde ein Chart-Rendering-Konsument den
// Backfill-Lauf-Zeitpunkt fälschlich als "Level endet hier" lesen statt "wächst weiter mit".
//
// `ignoreDuplicates: true` beim Upsert (statt Update) — eine bereits vorhandene Zeile stammt aus
// poi-watchers Live-Lauf und dessen intraday-Preis-Touch-Erkennung ist genauer als unsere reine
// Kerzenschluss-Berechnung hier; die soll ein bereits live getracktes Level nie zurücksetzen. Für
// Level, die es noch nicht gibt (der eigentliche Zweck hier), ist das Ergebnis ohnehin
// deterministisch identisch bei jedem erneuten Lauf.
//
// Voraussetzung: forex_candles muss den gewünschten Zeitraum für JEDEN Timeframe schon abdecken
// (siehe backfillForexCandles.ts) — dieses Script liest nur, holt nichts von cTrader selbst.
// Migration 20260823130000_liquidity_levels_anon_insert.sql schaltet anon-Insert frei
// (liquidity_levels war bisher anon-select-only, gleiches Muster wie ob_zones vor 20260809140000).
//
// 2026-08-27 von der Node-Autoren-Kopie (mcp-server/, gelöscht) nach Deno portiert, einzige
// verbleibende Kopie — process.env → Deno.env.get, Cross-Directory-Import aus ../../../src/ ersetzt
// durch die lokale, bereits vorhandene Kopie ../liquidityDetection.js, sonst unverändert:
//
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... [BACKFILL_INSTRUMENTS=GBPUSD,EURUSD] \
//     [BACKFILL_BARS=1h,4h] deno run --allow-net --allow-env \
//     supabase/functions/trading-monitor-mcp/scripts/backfillLiquidityLevels.ts
import { supabase } from "../supabaseClient.ts";
import { detectLiquidityLevels, LIQUIDITY_FRACTAL_PERIOD } from "../../_shared/liquidityDetection.ts";

// forex_candles.bar ("1h"/"4h", unsere eigene Konvention, siehe backfillForexCandles.ts) auf den
// liquidity_levels.timeframe-Spaltenwert gemappt (uneinheitlich großgeschrieben, siehe
// backfillObZones.ts: BAR_CONFIG-Kommentar für dasselbe Muster bei ob_zones).
const BAR_CONFIG: Record<string, { dbTimeframe: string }> = {
  "1h": { dbTimeframe: "1H" },
  "4h": { dbTimeframe: "4H" },
};

const INSTRUMENTS = (Deno.env.get("BACKFILL_INSTRUMENTS") ?? "GBPUSD,EURUSD").split(",").map((s) => s.trim());
const BARS = (Deno.env.get("BACKFILL_BARS") ?? "1h,4h").split(",").map((s) => s.trim());

const READ_PAGE_SIZE = 5000; // Supabase-Read-Pagination — siehe backfillObZones.ts
const UPSERT_BATCH_SIZE = 500;

interface CandleRow {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// 1:1 aus backfillObZones.ts übernommen (identisches PostgREST-Cap-Problem, siehe dortiger
// Kommentar) — nicht dedupliziert, weil ein drittes gemeinsames Modul für zwei Ein-Zeilen-Skripte
// mehr Indirektion wäre als Nutzen.
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
    from += data.length; // tatsächliche Länge weiterzählen, nicht READ_PAGE_SIZE (Server-Cap-Falle)
  }
  return all;
}

type Level = ReturnType<typeof detectLiquidityLevels>["highs"][number];

// Bug-Report Philip 2026-08-23: ein Level außerhalb von poi-watchers rollierendem Live-Fenster
// (FOREX_H1_LOOKBACK_CANDLES, siehe poi-watcher/index.ts) wurde real vom Preis erreicht, blieb
// aber touched=false für immer, weil poi-watchers Live-Preis-Prüfung ein solches Level strukturell
// nie wieder besucht (dortiger Fix behebt das nur für KÜNFTIGE Touches). Diese Funktion korrigiert
// bereits verpasste, in der Vergangenheit liegende Touches: für jede bereits vorhandene, noch
// touched=false-Zeile, deren Preis laut der REINEN Archiv-Neuberechnung (detectLiquidityLevels
// über die komplette Kerzenserie, s.o.) tatsächlich schon berührt wurde, wird die Zeile
// aktualisiert (touched/end_time/notified) — anders als upsertLevels unten, das eine bereits
// vorhandene Zeile bewusst NIE anfasst (siehe deren eigener Kommentar), weil das den Normalfall
// (live getrackte Zeile ist genauer als diese reine Kerzenschluss-Berechnung) korrekt bevorzugt.
// Hier geht es nur um den Sonderfall "poi-watcher konnte diese Zeile aus Fenstergründen strukturell
// nie selbst korrigieren" — alert_price/notified_at bleiben null (kein echter Live-Preis bekannt,
// analog zum Verhalten bei einem beim Backfill schon "touched" vorgefundenen neuen Level).
async function correctMissedTouches(instrument: string, dbTimeframe: string, levels: (Level & { direction: "high" | "low" })[]) {
  const { data: existingRows, error } = await supabase
    .from("liquidity_levels")
    .select("pivot_time, direction, price, touched")
    .eq("instrument", instrument)
    .eq("timeframe", dbTimeframe)
    .eq("touched", false);
  if (error) throw new Error(`Liquiditäts-Level lesen fehlgeschlagen (${instrument} ${dbTimeframe}): ${error.message}`);
  if (!existingRows || existingRows.length === 0) return 0;

  const untouchedKeys = new Set(
    existingRows.map((r) => `${r.direction}_${Math.floor(new Date(r.pivot_time).getTime() / 1000)}`),
  );

  let corrected = 0;
  for (const l of levels) {
    if (!l.touched || l.endTime == null) continue;
    const key = `${l.direction}_${l.pivotTime}`;
    if (!untouchedKeys.has(key)) continue;

    const { error: updateError } = await supabase
      .from("liquidity_levels")
      .update({ touched: true, end_time: new Date(l.endTime * 1000).toISOString(), notified: true })
      .eq("instrument", instrument)
      .eq("timeframe", dbTimeframe)
      .eq("direction", l.direction)
      .eq("pivot_time", new Date(l.pivotTime * 1000).toISOString());
    if (updateError) throw new Error(`Liquiditäts-Level korrigieren fehlgeschlagen (${instrument} ${dbTimeframe}): ${updateError.message}`);
    corrected += 1;
  }
  return corrected;
}

async function upsertLevels(instrument: string, dbTimeframe: string, levels: (Level & { direction: "high" | "low" })[]) {
  for (let i = 0; i < levels.length; i += UPSERT_BATCH_SIZE) {
    const batch = levels.slice(i, i + UPSERT_BATCH_SIZE).map((l) => ({
      instrument,
      timeframe: dbTimeframe,
      direction: l.direction,
      price: l.price,
      pivot_time: new Date(l.pivotTime * 1000).toISOString(),
      touched: l.touched,
      end_time: l.touched && l.endTime != null ? new Date(l.endTime * 1000).toISOString() : null,
      alert_price: null,
      notified: l.touched,
      notified_at: null,
    }));
    const { error } = await supabase
      .from("liquidity_levels")
      .upsert(batch, { onConflict: "instrument,timeframe,direction,pivot_time", ignoreDuplicates: true });
    if (error) throw new Error(`Liquiditäts-Level upserten fehlgeschlagen (${instrument} ${dbTimeframe}): ${error.message}`);
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
  const { highs, lows } = detectLiquidityLevels(candles, LIQUIDITY_FRACTAL_PERIOD);
  const levels = [
    ...highs.map((l) => ({ ...l, direction: "high" as const })),
    ...lows.map((l) => ({ ...l, direction: "low" as const })),
  ];
  const corrected = await correctMissedTouches(instrument, config.dbTimeframe, levels);
  await upsertLevels(instrument, config.dbTimeframe, levels);
  console.log(
    `${instrument} ${bar} (${candles.length} Kerzen): ${levels.length} Liquiditäts-Level erkannt/gesichert, ${corrected} verpasste Touches korrigiert.`,
  );
}

for (const instrument of INSTRUMENTS) {
  for (const bar of BARS) {
    await backfillOne(instrument, bar);
  }
}
