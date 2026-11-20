// Kerzen-Batch je Instrument und Tick, aus index.ts herausgelöst (Datei lag über 1000 Zeilen).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { Candle } from "../_shared/orderBlocks.ts";
import { readFxcmCandles } from "../_shared/fxcmCandles.ts";
import { LIVE_TOUCH_WINDOW_SEC } from "./liveTouch.ts";

// 300h (~12,5 Tage) reichten nicht, um lange unberührte 1H-Liquiditäts-Level (und 1H-OB-Zonen, die
// denselben Kerzensatz mitnutzen) im Blick zu behalten — Philip tradet von Ziel zu Ziel und
// braucht dafür ein paar unberührte Level ober-/unterhalb des Kurses, auch wenn die schon
// Wochen/Monate alt sind. Bug-Report 2026-08-02: ein 45 Tage alter, nie erneut erkannter Pivot
// (1,15297, 18.06.) fehlte deshalb komplett in liquidity_levels. 3000h (~125 Tage) statt 300h —
export const FOREX_H1_LOOKBACK_CANDLES = 3000;
// Bug-Report Philip 2026-08-23: eine 4H-OB-Zone vom 12.05. (start_time außerhalb des alten
// CANDLE_LIMIT=300-Fensters, ~50 Tage) wurde real getouched+invalidated (Kerzen-Vollarchiv-
// Neuberechnung bestätigt: 19.08. ~13:00 UTC), blieb in der DB aber für immer touched=false —
// derselbe Fensterblindfleck wie oben bei FOREX_H1_LOOKBACK_CANDLES, nur diesmal beim 4H-Fetch, der
// bis dahin bei den alten 300 Kerzen (~50 Tage) belassen wurde. Auf dieselbe Größenordnung wie 1H
// angehoben (3000 4H-Kerzen = ~500 Tage) — das Archiv liefert die geschlossenen Kerzen ohne
// zusätzlichen Broker-Abruf.
const FOREX_H4_LOOKBACK_CANDLES = 3000;
// Eine PostgREST-Seite (~10 Handelstage). Ältere unberührte M15-Zonen bleiben über den
// DB-Bestand im Touch-Check (Off-Window-Pfad in index.ts), nur ihre Invalidierung nicht.
const FOREX_M15_LOOKBACK_CANDLES = 1000;
export const TRADE_SETUP_M5_CANDLE_LIMIT = 300; // ~25h M5-Historie, deutlich mehr als der Lookback (siehe DEFAULT_TRADE_SETUP_PARAMS.maxLookbackSec)

// FXCM-H4 folgt dem New-York-Handelstag. Archiv-Lesen pro Tick vermeidet
// starre UTC-Grenzen und verpasst auch verspätet eingetroffene Kerzen nicht.
export async function fetchForexBatch(
  db: SupabaseClient, symbol: string, h4LastProcessed: number | null,
): Promise<{ currentPrice: number; stale: boolean; h4LastTime: number; candlesByTf: Map<string, Candle[]> }> {
  const [m5, h1, h4Probe, m15] = await Promise.all([
    readFxcmCandles(db, symbol, "5m", TRADE_SETUP_M5_CANDLE_LIMIT),
    readFxcmCandles(db, symbol, "1h", FOREX_H1_LOOKBACK_CANDLES),
    readFxcmCandles(db, symbol, "4h", 1),
    readFxcmCandles(db, symbol, "15m", FOREX_M15_LOOKBACK_CANDLES),
  ]);
  if (!m5.length || !h1.length || !h4Probe.length) throw new Error(`FXCM history missing: ${symbol}`);
  // Das volle 4H-Fenster kostet 3 Roundtrips fuer 3000 Zeilen, aendern kann sich daran aber nur
  // beim Schluss einer neuen 4H-Kerze — also alle 48 Laeufe einmal. Die Probe (1 Zeile) beantwortet
  // genau das; ohne neue Kerze laeuft 4H in den Skip-Pfad, der ohnehin nur den DB-Stand gegen die
  // juengsten M5-Kerzen prueft. 1H bleibt jedes Mal noetig (Trade-Setup-Fraktale, candles1hForSetup).
  const h4LastTime = h4Probe[0].time;
  const h4 = h4LastTime === h4LastProcessed
    ? null
    : await readFxcmCandles(db, symbol, "4h", FOREX_H4_LOOKBACK_CANDLES);
  const candlesByTf = new Map<string, Candle[]>([["M5", m5], ["1H", h1]]);
  if (h4) candlesByTf.set("4H", h4);
  // M15 optional statt Pflicht wie M5/1H: der Gold-Collector schrieb anfangs kein 15m, ein
  // fehlender M15-Feed darf 1H/4H und die Setups des Instruments nicht mitreißen.
  if (m15.length) candlesByTf.set("15M", m15);
  const latest = m5[m5.length - 1];
  // An LIVE_TOUCH_WINDOW_SEC gekoppelt, nicht zufaellig gleich: haengt der Feed weiter zurueck als
  // das Touch-Fenster reicht, faellt jede geladene Kerze aus dem Fenster und recentCandles liefert
  // leer — der Lauf pruefte dann still ueberhaupt keinen Touch mehr.
  const stale = Date.now() / 1000 - latest.time > LIVE_TOUCH_WINDOW_SEC;
  return { currentPrice: latest.close, stale, h4LastTime, candlesByTf };
}
