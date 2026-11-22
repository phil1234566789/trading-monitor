import { computeRangesPivots } from './marketStructureAnalysis';
import { buildStructureWithPhases } from './trendPhases.js';
import { withoutIgnored } from './ignoredCandles.js';
import { barSecondsFor } from './timeframes.js';
import { fmtDateTime } from './format.js';
import { M1_STRUCTURE_PERIOD } from './m1StructureSettings.js';

// Debug-Ansicht „Struktur“ der Chart-Debugger-Sektion DOB-Entry M1 (LS-Reaktion zeigt ihren eigenen Kontext, lsReactionStructureOverlay.js): dieselben Bausteine wie Dashboard-M5 (chartStructureCalculation.js,
// P5/P2 mit Schlusskurs-Auswertung) bzw. Dashboard-M1 (buildM1Structure: nur P5, P2 lieferte auf M1 Fehlsignale).
// Anker = Beginn des Sichtfensters statt 1h-Struktur/Setup-Sweep, weil die Sektion keine Erkennung mitbringt.
const M5_PERIODS = [5, 2];
export function dobEntryM1Structure(candles, timeframe, anchor, symbol) {
  const m1 = timeframe === '1m', rows = withoutIgnored(candles, symbol);
  const [outer, inner] = m1 ? [M1_STRUCTURE_PERIOD, M1_STRUCTURE_PERIOD] : M5_PERIODS;
  const pivotsOuter = computeRangesPivots(rows, outer, anchor, fmtDateTime);
  const pivotsInner = m1 ? [] : computeRangesPivots(rows, inner, anchor, fmtDateTime);
  return { ...buildStructureWithPhases(pivotsOuter, pivotsInner, outer, inner, rows, barSecondsFor(timeframe), { closeEvaluation: !m1 }),
    pivotsOuter, pivotsInner };
}
