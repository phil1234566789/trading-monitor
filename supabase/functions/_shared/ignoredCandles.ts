// Backend-Gegenstück zu src/ignoredCandles.js: Kerzen einer "Liquidität ignorieren"-Session (Spread
// Hour) für die Erkennung als nicht vorhanden behandeln. Die reine Logik steckt in
// markIgnoredCandles (_shared/sessionOccurrences.js, Voll-Kopie von src/) — hier nur die
// Backend-Zutaten: der Berlin-Offset und das Laden der sessions-Zeilen.
//
// `danger` taugt als Kriterium NICHT: Asia ist genauso 'forbidden', ihre Level sollen bleiben.
// Deshalb die eigene Spalte ignore_liquidity (Migration 20260927150000).
import { markIgnoredCandles } from "./sessionOccurrences.js";
import { berlinOffsetMinutes } from "./berlinTime.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface IgnoreLiquiditySession {
  fromMinutes: number;
  toMinutes: number;
  days: number[] | null;
  ignoreLiquidity: boolean;
}

// sessionOccurrences erwartet Sekunden -> Offset-MINUTEN, berlinOffsetMinutes nimmt Millisekunden
// (derselbe *1000-Fallstrick wie in forbiddenSession.ts, siehe dort).
const berlinOffsetFromSec = (utcSec: number) => berlinOffsetMinutes(utcSec * 1000);

// sessions: bereits auf EIN Instrument gefiltert (Aufrufer-Pflicht, wie überall bei sessionConfigs).
export function markIgnored<T extends { time: number }>(candles: T[], sessions: IgnoreLiquiditySession[]): T[] {
  return markIgnoredCandles(candles, sessions, berlinOffsetFromSec) as T[];
}

// Für die Verbraucher, die die Kerze wirklich weglassen dürfen (Struktur-/Fraktal-Erkennung) — die
// FVG-Erkennung darf das NICHT und liest stattdessen das Flag, siehe markIgnoredCandles.
export function withoutIgnored<T extends { time: number }>(candles: T[], sessions: IgnoreLiquiditySession[]): T[] {
  return markIgnored(candles, sessions).filter((c) => !(c as { ignored?: boolean }).ignored);
}

// Ein Select für ALLE Instrumente, wie poi-watcher es für die Schedules/Forbidden-Sessions auch
// macht — die Tabelle hat eine Handvoll Zeilen, eine Abfrage je Instrument wäre nur Overhead.
export async function fetchIgnoreLiquiditySessions(supabase: SupabaseClient): Promise<Map<string, IgnoreLiquiditySession[]>> {
  const { data, error } = await supabase
    .from("sessions")
    .select("instrument, from_minutes, to_minutes, days, ignore_liquidity")
    .eq("ignore_liquidity", true)
    // Deckel wegen der PostgREST-~1000-Zeilen-Kappung (siehe CLAUDE.md) — die Tabelle hat eine
    // Handvoll Zeilen je Instrument, 200 ist weit jenseits alles Plausiblen.
    .limit(200);
  if (error) throw error;
  const byInstrument = new Map<string, IgnoreLiquiditySession[]>();
  for (const r of data ?? []) {
    const list = byInstrument.get(r.instrument as string) ?? [];
    list.push({
      fromMinutes: r.from_minutes as number,
      toMinutes: r.to_minutes as number,
      days: r.days as number[] | null,
      ignoreLiquidity: true,
    });
    byInstrument.set(r.instrument as string, list);
  }
  return byInstrument;
}
