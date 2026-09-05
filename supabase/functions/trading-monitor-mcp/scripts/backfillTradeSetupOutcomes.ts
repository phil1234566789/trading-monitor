// Einmaliges Backfill + wiederholbarer Recompute für trade_setup_outcomes (milk-city-Task
// trade-setup-winrate-outcome-tracking-kriterien-filter, Chat 2026-09-05) — berechnet für jedes
// bestehende trade_setups-Row Entry/SL/TP + Kriterien-Rohwerte + Outcome (win/loss/pending) und
// druckt die Winrate für ein paar erste Kriterien-Kombinationen aus. Upsert (onConflict trade_setup_id)
// statt reinem Insert, damit ein erneuter Lauf sowohl neue Setups aufnimmt als auch zuvor "pending"
// gebliebene Zeilen mit inzwischen neu archivierten Kerzen auflöst — kein separates "resolve pending"-
// Script nötig, bis das direkt in poi-watcher verdrahtet ist (Schritt 2 des Tasks).
//
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... [BACKFILL_INSTRUMENTS=GBPUSD,EURUSD] \
//     deno run --allow-net --allow-env \
//     supabase/functions/trading-monitor-mcp/scripts/backfillTradeSetupOutcomes.ts
import { supabase } from "../supabaseClient.ts";
import { isWithinTradingWindows, type TradingWindows } from "../../_shared/tradingHoursGate.ts";
import {
  deriveEntryInvalidation,
  computeSlTp,
  classifyOutcome,
  computeSweepAgeHours,
  classifyInducementAge,
  type SetupDirection,
  type OutcomeCandle,
} from "../../_shared/tradeSetupOutcome.ts";

const INSTRUMENTS = (Deno.env.get("BACKFILL_INSTRUMENTS") ?? "GBPUSD,EURUSD").split(",").map((s) => s.trim());
const READ_PAGE_SIZE = 5000; // siehe backfillObZones.ts — PostgREST kappt serverseitig ohnehin auf ~1000

const stderrEncoder = new TextEncoder();
function writeStderr(text: string) {
  Deno.stderr.writeSync(stderrEncoder.encode(text));
}

function toSec(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000);
}

interface TradeSetupRow {
  id: number;
  instrument: string;
  direction: SetupDirection;
  ob_top: number;
  ob_bottom: number;
  ob_start_time: string;
  ls_pivot_time: string;
  ls_touched_time: string;
}

async function fetchAllTradeSetups(instrument: string): Promise<TradeSetupRow[]> {
  const all: TradeSetupRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("trade_setups")
      .select("id, instrument, direction, ob_top, ob_bottom, ob_start_time, ls_pivot_time, ls_touched_time")
      .eq("instrument", instrument)
      .order("ob_start_time", { ascending: true })
      .range(from, from + READ_PAGE_SIZE - 1);
    if (error) throw new Error(`trade_setups lesen fehlgeschlagen (${instrument}): ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as TradeSetupRow[]));
    from += data.length;
  }
  return all;
}

// Nur high/low + time nötig für classifyOutcome — kein voller OHLCV-Fetch.
async function fetchAllM5Candles(instrument: string): Promise<OutcomeCandle[]> {
  const all: OutcomeCandle[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("forex_candles")
      .select("time, high, low")
      .eq("instrument", instrument)
      .eq("bar", "5m")
      .order("time", { ascending: true })
      .range(from, from + READ_PAGE_SIZE - 1);
    if (error) throw new Error(`Kerzen lesen fehlgeschlagen (${instrument}): ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as any[]).map((r) => ({ time: toSec(r.time), high: r.high, low: r.low })));
    from += data.length;
    writeStderr(`\r${instrument} 5m: ${all.length} Kerzen geladen...`);
  }
  writeStderr("\n");
  return all;
}

interface OutcomeRow {
  trade_setup_id: number;
  instrument: string;
  direction: SetupDirection;
  entry_price: number;
  invalidation_price: number;
  sl_price: number;
  tp_price: number;
  sl_pips: number;
  within_trading_hours: boolean;
  sweep_age_hours: number;
  outcome: "win" | "loss" | "pending";
  resolved_at: string | null;
}

function formatWinrate(wins: number, losses: number): string {
  const decided = wins + losses;
  if (decided === 0) return "keine aufgelösten Setups";
  if (decided < 100) return `${wins}W/${losses}L (n=${decided}, zu wenig für %-Angabe)`;
  return `${Math.round((wins / decided) * 100)}% (${wins}W/${losses}L, n=${decided})`;
}

function printGroup(label: string, rows: OutcomeRow[]) {
  const wins = rows.filter((r) => r.outcome === "win").length;
  const losses = rows.filter((r) => r.outcome === "loss").length;
  const pending = rows.filter((r) => r.outcome === "pending").length;
  console.log(`  ${label.padEnd(40)} n=${rows.length}  Pending=${pending}  Winrate=${formatWinrate(wins, losses)}`);
}

async function runFor(instrument: string) {
  const [setups, candles, schedule] = await Promise.all([
    fetchAllTradeSetups(instrument),
    fetchAllM5Candles(instrument),
    supabase.from("trading_schedules").select("trading_windows").eq("instrument", instrument).maybeSingle(),
  ]);
  if (schedule.error) throw new Error(`trading_schedules lesen fehlgeschlagen (${instrument}): ${schedule.error.message}`);
  if (setups.length === 0) {
    console.warn(`${instrument}: keine trade_setups gefunden, übersprungen.`);
    return;
  }
  const tradingWindows = schedule.data?.trading_windows as TradingWindows | undefined;
  if (!tradingWindows) throw new Error(`Keine trading_schedules-Zeile für ${instrument}.`);

  const outcomeRows: OutcomeRow[] = setups.map((s) => {
    const obStartTimeSec = toSec(s.ob_start_time);
    const lsPivotTimeSec = toSec(s.ls_pivot_time);
    const lsTouchedTimeSec = toSec(s.ls_touched_time);
    const { entry, invalidation } = deriveEntryInvalidation(s.direction, s.ob_top, s.ob_bottom);
    const { slPrice, tpPrice, slPips } = computeSlTp(s.direction, entry, invalidation);
    const { outcome, resolvedAt } = classifyOutcome(candles, s.direction, obStartTimeSec, slPrice, tpPrice);
    return {
      trade_setup_id: s.id,
      instrument: s.instrument,
      direction: s.direction,
      entry_price: entry,
      invalidation_price: invalidation,
      sl_price: slPrice,
      tp_price: tpPrice,
      sl_pips: slPips,
      within_trading_hours: isWithinTradingWindows(obStartTimeSec, tradingWindows),
      sweep_age_hours: computeSweepAgeHours(lsTouchedTimeSec, lsPivotTimeSec),
      outcome,
      resolved_at: resolvedAt != null ? new Date(resolvedAt * 1000).toISOString() : null,
    };
  });

  for (let i = 0; i < outcomeRows.length; i += 500) {
    const chunk = outcomeRows.slice(i, i + 500);
    const { error } = await supabase.from("trade_setup_outcomes").upsert(chunk, { onConflict: "trade_setup_id" });
    if (error) throw new Error(`trade_setup_outcomes schreiben fehlgeschlagen (${instrument}): ${error.message}`);
  }

  console.log(`\n=== ${instrument} (${outcomeRows.length} Setups) ===`);
  printGroup("GESAMT", outcomeRows);
  const withinHours = outcomeRows.filter((r) => r.within_trading_hours);
  printGroup("+ innerhalb Handelszeiten", withinHours);
  // Inducement-Klassifizierung (Minor/Medium/Major, siehe classifyInducementAge) statt der
  // ursprünglich erfundenen "Sweep-Alter >= 6h"-Grenze — Philips eigentliche Bedeutung war die
  // bestehende Alters-Einteilung aus trading-Repo liquidität.md, siehe Kommentar dort.
  for (const cls of ["minor", "medium", "major"] as const) {
    printGroup(`+ Handelszeiten + ${cls}`, withinHours.filter((r) => classifyInducementAge(r.sweep_age_hours) === cls));
  }
}

for (const instrument of INSTRUMENTS) {
  await runFor(instrument);
}
