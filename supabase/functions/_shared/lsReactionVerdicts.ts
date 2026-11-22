// LS-Reaktion-Urteil über trade_setups-Zeilen für dob-watcher und MCP (get_trade_setups, get_data_snapshot):
// dieselbe Funktion wie der Chart (lsReactionRowVerdicts), plus das Laden des Trendkontexts.
import type { Candle } from "./orderBlocks.ts";
import * as core from "../../../src/lsReactionRows.js";
export const LS_REACTION_VERSION: string = core.LS_REACTION_VERSION;

// H1 wie das dob-watcher-Fenster, D1 für die Tagesanker; M5 ab dem Strukturstart, gedeckelt (Edge-CPU).
export const LS_REACTION_CONTEXT = { h1: 6000, d1: 300, maxM5: 15000 } as const;
// witness: bestandene Quelle mit dem ältesten Strukturpunkt (nur bei passed; null = bestanden ohne eigene Quelle).
export type LsReactionWitness = { price: number; pivotTime: number; touchedTime: number; timeframe: string; sourceKind: string };
export type LsReactionVerdict = { status: "passed" | "unmet" | "unknown"; reason?: string; witness?: LsReactionWitness | null };
type Load = (bar: "5m" | "1h" | "1D", count: number) => Promise<Candle[]>;
// JS-Defaults (= []) ließen Deno die Parameter als never[] lesen.
const lsReactionM5Start = core.lsReactionM5Start as unknown as (input: Record<string, unknown>) => number | null;
const lsReactionRowVerdicts = core.lsReactionRowVerdicts as unknown as (input: Record<string, unknown>) => Map<unknown, LsReactionVerdict>;

// rows: Spalten wie tradeSetupFromRow (inkl. trade_setup_sweeps, created_at); sessionConfigs wie sessionFromRow.
export async function computeLsReactionVerdicts({ rows, instrument, evaluatedAt, sessionConfigs, load, h1 }: {
  rows: Record<string, unknown>[]; instrument: string; evaluatedAt: number; sessionConfigs: unknown[]; load: Load; h1?: Candle[];
}): Promise<Map<unknown, LsReactionVerdict>> {
  if (!rows.length) return new Map();
  const h1Candles = h1 ?? await load("1h", LS_REACTION_CONTEXT.h1);
  const d1Candles = await load("1D", LS_REACTION_CONTEXT.d1);
  const from = lsReactionM5Start({ rows, h1Candles, d1Candles });
  // Kalendergrenze überschätzt die Barzahl (Wochenenden), lädt also eher etwas mehr als nötig.
  const m5Candles = from == null ? [] : await load("5m", Math.min(LS_REACTION_CONTEXT.maxM5, Math.ceil((evaluatedAt - from) / 300)));
  return lsReactionRowVerdicts({ rows, instrument, m5Candles, h1Candles, d1Candles, evaluatedAt, sessionConfigs });
}
