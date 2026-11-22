// LS-Reaktion-Sicht für Lana (get_trade_setups, get_data_snapshot): dasselbe Urteil wie Chart und dob-watcher.
// Gespeicherte Urteile kommen aus dem Cache des dob-watchers (ls_reaction_verdicts), fehlende rechnet
// computeLsReactionVerdicts nach — ohne zu speichern, das MCP liest nur (Anon-Key).
import { supabase } from "./supabaseClient.ts";
import { readClosedFxcmCandles } from "../_shared/fxcmCandles.ts";
import { getSessions } from "./db.ts";
import { computeLsReactionVerdicts, LS_REACTION_VERSION, type LsReactionVerdict } from "../_shared/lsReactionVerdicts.ts";
import type { DetectedTradeSetup } from "../_shared/tradeSetup.ts";
import { tradeSetupToRow } from "../../../src/tradeSetupRow.js";

const SETUP_COLUMNS = "*, trade_setup_sweeps(price, pivot_time, touched_time, timeframe, is_primary)";

// Kerzen wie der dob-watcher (geschlossene FXCM-Kerzen). fetchForexCandles lud am Wochenende live von cTrader nach
// und ließ get_trade_setups in den 300-s-Timeout laufen.
const closedLoader = (instrument: string, evaluatedAt: number) => (bar: "5m" | "1h" | "1D", count: number) =>
  readClosedFxcmCandles(supabase, instrument, bar, evaluatedAt, count);
// Nachgerechnete Urteile je Aufruf (Edge-CPU); den Rest des Bestands urteilt der dob-watcher laufend vor.
const MAX_COMPUTED = 12;

async function verdictsFor(instrument: string, rows: Record<string, unknown>[], evaluatedAt: number, useCache: boolean) {
  const status = new Map<unknown, LsReactionVerdict>();
  if (useCache && rows.length) {
    const { data, error } = await supabase.from("ls_reaction_verdicts").select("trade_setup_id, status, reason")
      .eq("version", LS_REACTION_VERSION).in("trade_setup_id", rows.map((r) => r.id)).limit(1000);
    if (error) throw new Error(error.message);
    for (const v of data ?? []) status.set(Number(v.trade_setup_id), { status: v.status, reason: v.reason ?? undefined });
  }
  const missing = rows.filter((r) => !status.has(r.id)).slice(0, MAX_COMPUTED);
  const computed = await computeLsReactionVerdicts({ rows: missing, instrument, evaluatedAt, sessionConfigs: await getSessions(instrument),
    load: closedLoader(instrument, evaluatedAt) });
  for (const [id, v] of computed) status.set(id, v);
  return status;
}

// Die neuesten `limit` gespeicherten Setups mit bestandenem LS-Reaktion-Urteil. Die Kandidaten-Spanne ist breiter als
// limit, weil nur ein Teil besteht (20.11.2026: GBP 0 von 14, XAU 3 von 11).
export async function getLsReactionTradeSetups(instrument: string, fromSec?: number, limit = 2, replayUntilSec?: number) {
  const evaluatedAt = replayUntilSec ?? Math.floor(Date.now() / 1000);
  // ob_start_time statt fractal_pivot_time: ohne eigenes Fraktal zeigt das auf ein beliebig altes Level.
  let query = supabase.from("trade_setups").select(SETUP_COLUMNS).eq("instrument", instrument)
    .order("ob_start_time", { ascending: false }).limit(Math.min(500, Math.max(50, limit * 10)));
  if (fromSec != null) query = query.gte("ob_start_time", new Date(fromSec * 1000).toISOString());
  if (replayUntilSec != null) query = query.lte("created_at", new Date(replayUntilSec * 1000).toISOString());
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  const verdicts = await verdictsFor(instrument, rows, evaluatedAt, true);
  return rows.filter((r) => verdicts.get(r.id)?.status === "passed").slice(0, limit);
}

// Frisch erkannte Setups (noch ohne Zeile) mit derselben Zeilen-Bewertung — Rückgabe nur die bestandenen.
// created_at = OB-Start + FVG-Schluss: daraus leitet LS-Reaktion im Chart für ein Live-Setup den Bekanntzeitpunkt ab
// (lsReactionSourceTimes); "jetzt" würde den Trendkontext zu spät auflösen.
export async function passedLsReactionSetups(instrument: string, setups: DetectedTradeSetup[], evaluatedAt: number) {
  const rows = setups.map((s, i) => tradeSetupToRow(s, { id: i, instrument, createdAt: s.obStartTime + 600 }));
  const verdicts = await verdictsFor(instrument, rows, evaluatedAt, false);
  return setups.filter((_, i) => verdicts.get(i)?.status === "passed");
}
