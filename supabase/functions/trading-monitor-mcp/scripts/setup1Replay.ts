import { detectLiquidityLevels, type LiquidityLevel } from "../../_shared/liquidityDetection.ts";
import { isWithinTradingWindows, type TradingWindows } from "../../_shared/tradingHoursGate.ts";
import { detectSetupObs, detectTradeSetup, DEFAULT_TRADE_SETUP_PARAMS, TRADE_SETUP_M5_FRACTAL_PERIOD, TRADE_SETUP_H1_FRACTAL_PERIOD, type TradeSetupParams } from "../../_shared/tradeSetup.ts";
export { DEFAULT_TRADE_SETUP_PARAMS, TRADE_SETUP_M5_FRACTAL_PERIOD, TRADE_SETUP_H1_FRACTAL_PERIOD };
export { TRADE_SETUP_DETECTOR_VERSION } from '../../_shared/tradeSetup.ts';
export { setup1Configuration, tradeSetupProvenance } from '../../_shared/tradeSetupProvenance.js';
export { markIgnored } from "../../_shared/ignoredCandles.ts";
export { strategyDistance, obMinimum } from "../../_shared/instrumentConfig.js";
export const M5_CANDLE_LIMIT = 300;
export const H1_LOOKBACK_CANDLES = 3000;
const H1_SEC = 3600;
const iso = (s: number) => new Date(s * 1000).toISOString();
interface Candle { time: number; open: number; high: number; low: number; close: number; volume: number; ignored?: boolean }
function verfeinereTouch(levels: LiquidityLevel[], richtung: "high" | "low", m5: Candle[], bisSec: number) {
  for (const lvl of levels) {
    if (lvl.touched && lvl.touchedTime != null && lvl.touchedTime <= bisSec) continue;
    for (const c of m5) {
      if (c.time <= lvl.pivotTime || c.time > bisSec) continue;
      if (richtung === "high" ? c.high >= lvl.price : c.low <= lvl.price) {
        lvl.touched = true;
        lvl.touchedTime = c.time;
        break;
      }
    }
  }
}

// Legacy-Backfill und Dateisatz teilen die rollierenden Fenster; Erkennungsregeln bleiben im Original.
export function replaySetup1({ instrument, m5Alle, h1Alle, startSec, endeSec,
  configuration = DEFAULT_TRADE_SETUP_PARAMS, minimum = null, alarmFenster = null,
  recognitionDelaySec = 300, onProgress,
}: { instrument: string; m5Alle: Candle[]; h1Alle: Candle[]; startSec: number; endeSec: number;
  configuration?: Omit<TradeSetupParams, 'nowTime'>; minimum?: number | null; alarmFenster?: TradingWindows | null;
  recognitionDelaySec?: number; onProgress?: (progress: { ticks: number; setups: number; time: number }) => void }) {
  const gefunden = new Map<string, Record<string, unknown>>();
  let ticks = 0;
  let h1Stunde = -1;
  let h1Highs: LiquidityLevel[] = [];
  let h1Lows: LiquidityLevel[] = [];

  for (let i = 0; i < m5Alle.length; i++) {
    const jetzt = m5Alle[i].time;
    if (jetzt < startSec || jetzt >= endeSec) continue;
    if (alarmFenster && !isWithinTradingWindows(jetzt, alarmFenster)) continue;
    const m5Fenster = m5Alle.slice(Math.max(0, i - M5_CANDLE_LIMIT + 1), i + 1);
    // Volles Fenster verlangen, kein angebrochenes: mit weniger Kerzen sehen die M5-Level weniger
    // Historie und gelten faelschlich als unberuehrt -- der Lauf fand dadurch am ersten Tag Setups,
    // die live nie entstanden sind.
    if (m5Fenster.length < M5_CANDLE_LIMIT) continue;
    ticks++;

    // 1H-Level nur bei Stundenwechsel neu erkennen — sie können sich innerhalb einer Stunde nicht
    // ändern, und detectLiquidityLevels über 3000 Kerzen bei jedem 5-Minuten-Tick wäre 12x Arbeit
    // für dasselbe Ergebnis. Der Touch wird trotzdem jeden Tick nachgezogen (siehe unten).
    const stunde = Math.floor((jetzt + recognitionDelaySec) / H1_SEC);
    if (stunde !== h1Stunde) {
      h1Stunde = stunde;
      // Der Dateisatz erkennt am M5-Schluss; dort ist eine gleichzeitig schließende H1 schon bekannt.
      const h1Fenster = h1Alle.filter((c) => c.time + H1_SEC <= jetzt + recognitionDelaySec).slice(-H1_LOOKBACK_CANDLES);
      const erkannt = detectLiquidityLevels(h1Fenster, TRADE_SETUP_H1_FRACTAL_PERIOD);
      h1Highs = erkannt.highs;
      h1Lows = erkannt.lows;
    }
    // verfeinereTouch und die Preis-Scans in detectTradeSetup kennen das Flag nicht — hier die
    // Kerzen also wirklich weglassen, damit ein Rollover-Docht keinen Touch/Bruch ausloest.
    const m5FensterOhneIgnorierte = m5Fenster.filter((c) => !c.ignored);
    verfeinereTouch(h1Highs, "high", m5FensterOhneIgnorierte, jetzt);
    verfeinereTouch(h1Lows, "low", m5FensterOhneIgnorierte, jetzt);

    const { highs: m5Highs, lows: m5Lows } = detectLiquidityLevels(m5Fenster, TRADE_SETUP_M5_FRACTAL_PERIOD);
    const setupObs = detectSetupObs(m5Fenster, minimum);
    const params = { ...configuration, nowTime: jetzt };

    for (const [dir, m5Lvl, h1Lvl] of [
      [1, m5Highs, h1Highs] as const,
      [-1, m5Lows, h1Lows] as const,
    ]) {
      const setup = detectTradeSetup(dir, m5Lvl, h1Lvl, m5Lvl, setupObs, params, m5FensterOhneIgnorierte);
      if (!setup) continue;
      const direction = setup.dir === 1 ? "short" : "long";
      const key = `${direction}_${setup.obStartTime}`;
      // Erster Fund gewinnt — dieselbe Semantik wie live: poi-watcher/index.ts überspringt einen
      // bereits alarmierten Schlüssel komplett, überschreibt die Zeile also nicht mehr. Gegenprobe
      // mit "letzter gewinnt" gerechnet: der Reichweiten-Median lief noch weiter von den
      // Live-Zeilen weg (16,6 statt 15,2 gegen 12,9).
      // Schlüssel ist der bestätigende OB, nicht fractal_pivot_time — derselbe Unique-Key wie live
      // (instrument,direction,ob_start_time). Mit fractal_pivot_time konnten zwei Ticks dieselbe
      // ob_start_time unter zwei Schlüsseln ablegen, was der Upsert-Batch nicht überlebt.
      if (gefunden.has(key)) continue;
      gefunden.set(key, {
        instrument,
        direction,
        fractal_price: setup.fractal.price,
        fractal_pivot_time: iso(setup.fractal.pivotTime),
        ls_price: setup.ls.price,
        ls_pivot_time: iso(setup.ls.pivotTime),
        ls_touched_time: iso(setup.ls.touchedTime!),
        ls_timeframe: setup.sweeps[0].timeframe,
        // Keine DB-Spalte, sondern die Kindtabellen-Zeilen dieses Setups — unten vor dem Upsert
        // abgetrennt und danach über die zurückgegebene id geschrieben.
        sweeps: setup.sweeps,
        ob_top: setup.obTop,
        ob_bottom: setup.obBottom,
        ob_start_time: iso(setup.obStartTime),
        ob_fvg: setup.obFvg,
        alert_price: m5Fenster[m5Fenster.length - 1].close,
        notified: false,
        notified_at: null,
        created_at: iso(jetzt + recognitionDelaySec),
      });
    }
    if (ticks % 5000 === 0) onProgress?.({ ticks, setups: gefunden.size, time: jetzt });
  }

  return { rows: [...gefunden.values()], ticks };
}
