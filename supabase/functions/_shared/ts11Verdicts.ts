// TS1.1-Urteil über trade_setups-Zeilen für dob-watcher und MCP (get_trade_setups, get_data_snapshot):
// dieselbe Funktion wie der Chart (tradeSetup11RowVerdicts), plus das Laden des Trendkontexts.
import type { Candle } from "./orderBlocks.ts";
import * as core from "../../../src/tradeSetup11Rows.js";
export const TRADE_SETUP_11_VERSION: string = core.TRADE_SETUP_11_VERSION;

// H1 wie das dob-watcher-Fenster, D1 für die Tagesanker; M5 ab dem Strukturstart, gedeckelt (Edge-CPU).
export const TS11_CONTEXT = { h1: 6000, d1: 300, maxM5: 15000 } as const;
// witness: bestandene Quelle mit dem ältesten Strukturpunkt (nur bei passed; null = bestanden ohne eigene Quelle).
export type Ts11Witness = { price: number; pivotTime: number; touchedTime: number; timeframe: string; sourceKind: string };
export type Ts11Verdict = { status: "passed" | "unmet" | "unknown"; reason?: string; witness?: Ts11Witness | null };
type Load = (bar: "5m" | "1h" | "1D", count: number) => Promise<Candle[]>;
// JS-Defaults (= []) ließen Deno die Parameter als never[] lesen.
const tradeSetup11M5Start = core.tradeSetup11M5Start as unknown as (input: Record<string, unknown>) => number | null;
const tradeSetup11RowVerdicts = core.tradeSetup11RowVerdicts as unknown as (input: Record<string, unknown>) => Map<unknown, Ts11Verdict>;

// rows: Spalten wie tradeSetupFromRow (inkl. trade_setup_sweeps, created_at); sessionConfigs wie sessionFromRow.
export async function computeTs11Verdicts({ rows, instrument, evaluatedAt, sessionConfigs, load, h1 }: {
  rows: Record<string, unknown>[]; instrument: string; evaluatedAt: number; sessionConfigs: unknown[]; load: Load; h1?: Candle[];
}): Promise<Map<unknown, Ts11Verdict>> {
  if (!rows.length) return new Map();
  const h1Candles = h1 ?? await load("1h", TS11_CONTEXT.h1);
  const d1Candles = await load("1D", TS11_CONTEXT.d1);
  const from = tradeSetup11M5Start({ rows, h1Candles, d1Candles });
  // Kalendergrenze überschätzt die Barzahl (Wochenenden), lädt also eher etwas mehr als nötig.
  const m5Candles = from == null ? [] : await load("5m", Math.min(TS11_CONTEXT.maxM5, Math.ceil((evaluatedAt - from) / 300)));
  return tradeSetup11RowVerdicts({ rows, instrument, m5Candles, h1Candles, d1Candles, evaluatedAt, sessionConfigs });
}
