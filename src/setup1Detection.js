// Setup 1 als EINE Pipeline für Chart (usePriceChartTradeSetups), poi-watcher und get_data_snapshot.
// Deno importiert diese Datei direkt (wie dob-watcher seine Erkennung), deshalb nur Deno-sichere
// Imports mit Endung. Vorher hatte jede Laufzeit ihre Kopie: das Backend nahm seit dem 28.07. noch
// rohe H1-Fraktale (Periode 10) und nur das neueste Setup, der Chart die Marktstruktur-Pivots und
// alle Setups — Chart und Telegram meldeten monatelang Verschiedenes (test/setup1ParityGuard.test.js).
import { detectLiquidityLevels, detectOrderBlockLiquidityLevels } from './liquidityDetection.js';
import { detectSetupObs, detectTradeSetups } from './tradeSetup.js';
import { tradeSetupParameters } from './tradeSetupParameters.js';
import { obMinimum } from './instrumentConfig.js';
import { TRADE_SETUP_M5_FRACTAL_PERIOD, TRADE_SETUP_M5_CANDLE_COUNT, RANGES_CANDLE_BUFFER } from './priceChartConstants.js';
import { buildMarketStructureState, computeRangesPivots } from './marketStructureAnalysis.ts';
import { collectStructureLqLevels } from './structureLiquidityLevels.ts';

export { TRADE_SETUP_M5_FRACTAL_PERIOD, TRADE_SETUP_M5_CANDLE_COUNT };

// Struktur-Einstellung der Alarme (Start ab 1D-Pivot, sonst rollierend). Der Chart darf per localStorage
// abweichen; dann zeigt er den Hinweis aus structureDeviatesFromAlarm (Philip 21.11.2026: Übergangslösung).
export const SETUP1_H1_STRUCTURE = Object.freeze({ periodOuter: 5, periodInner: 2, lookbackHours: 7 * 24, startMode: 'pivot' });

// Dieselben Werte in den Namen der Dashboard-Einstellungen, für Vergleich und "zurück auf Standard".
export const SETUP1_STRUCTURE_SETTINGS = Object.freeze({
  rangesPeriod: SETUP1_H1_STRUCTURE.periodOuter, ranges2Period: SETUP1_H1_STRUCTURE.periodInner,
  rangesLookbackHours: SETUP1_H1_STRUCTURE.lookbackHours, ranges2LookbackHours: SETUP1_H1_STRUCTURE.lookbackHours,
  rangesStartMode: SETUP1_H1_STRUCTURE.startMode,
});

export function structureDeviatesFromAlarm(settings) {
  return Object.entries(SETUP1_STRUCTURE_SETTINGS).some(([key, value]) => settings[key] !== value);
}

// Wie fetchRangesCandles/computeRangesPivotsFor im Chart: ab Strukturstart (1D-Pivot) oder rollierend.
/** @param {number} nowSec @param {number | null} [structureStartSec] */
export function setup1StructureWindow(nowSec, structureStartSec = null) {
  const fixed = structureStartSec != null;
  const hours = fixed ? Math.max(1, Math.ceil((nowSec - structureStartSec) / 3600)) : SETUP1_H1_STRUCTURE.lookbackHours;
  return { cutoff: fixed ? structureStartSec : nowSec - SETUP1_H1_STRUCTURE.lookbackHours * 3600, count: hours + RANGES_CANDLE_BUFFER };
}

// h1Candles: markiert (ignored), älteste zuerst, nur bis nowSec.
/** @param {any[]} h1Candles @param {{ nowSec: number, structureStartSec?: number | null }} options */
export function setup1H1Structure(h1Candles, { nowSec, structureStartSec = null }) {
  const { cutoff, count } = setup1StructureWindow(nowSec, structureStartSec);
  const rows = h1Candles.slice(-count).filter((c) => !c.ignored);
  const { periodOuter, periodInner } = SETUP1_H1_STRUCTURE;
  return buildMarketStructureState(computeRangesPivots(rows, periodOuter, cutoff), computeRangesPivots(rows, periodInner, cutoff),
    periodOuter, periodInner, rows);
}

export function setup1H1Levels(structureState) {
  return { highs: collectStructureLqLevels(structureState, 1), lows: collectStructureLqLevels(structureState, -1) };
}

// m5Candles: markiert (ignored), älteste zuerst. Getrennt von detectSetup1, weil poi-watcher und das
// Snapshot dazwischen den Live-Preis-Touch auf die Level legen.
export function setup1Inputs(instrument, m5Candles, { sweepSourceProfile } = {}) {
  const params = { ...tradeSetupParameters(instrument, m5Candles[m5Candles.length - 1].time), ...(sweepSourceProfile ? { sweepSourceProfile } : {}) };
  const minGap = obMinimum(instrument, '5m');
  const { highs, lows } = detectLiquidityLevels(m5Candles, TRADE_SETUP_M5_FRACTAL_PERIOD);
  // Preis-Scans (Sweep-Bruch, Aufweiten aufs Extrem) lassen ignorierte Kerzen weg, die FVG-Erkennung nicht.
  return { params, minGap, m5Highs: highs, m5Lows: lows, setupObs: detectSetupObs(m5Candles, minGap),
    clean: m5Candles.filter((c) => !c.ignored), candles: m5Candles };
}

// OB-Kanten-Level mit denselben OBs und demselben Mindestabstand wie setup1Inputs, für den Chart-Toggle „OB Sweeps“.
// evaluatedAt wie in detectTradeSetups: Schluss der letzten Kerze.
export function setup1ObLiquidityLevels(instrument, m5Candles) {
  if (!m5Candles.length) return [];
  const obs = detectSetupObs(m5Candles, obMinimum(instrument, '5m')), evaluatedAt = m5Candles[m5Candles.length - 1].time + 300;
  return [1, -1].flatMap((dir) => detectOrderBlockLiquidityLevels(obs, m5Candles, dir, evaluatedAt));
}

export function detectSetup1(inputs, h1Highs, h1Lows) {
  const { m5Highs, m5Lows, setupObs, params, clean, candles } = inputs;
  return {
    shorts: detectTradeSetups(1, m5Highs, h1Highs, m5Highs, setupObs, params, clean, candles),
    longs: detectTradeSetups(-1, m5Lows, h1Lows, m5Lows, setupObs, params, clean, candles),
  };
}


// Alarmfähig ist nur, was höchstens maxLookbackSec alt ist; der Chart zeigt auch Älteres als Historie.
export function setup1AlarmCandidates({ shorts, longs }, params) {
  return [...shorts, ...longs].filter((s) => s.obStartTime >= params.nowTime - params.maxLookbackSec);
}
