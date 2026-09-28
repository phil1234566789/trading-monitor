import { collectStructureLqLevels } from './marketStructureRendering';
import { firstTouchAfter } from './structurePivotTime';
import { closedChecklistCandles } from './tradeSetupChecklistTimeBasis.js';

// Die H1-Struktur bleibt geschlossen. Ein dort bereits bekanntes Level kann trotzdem
// innerhalb der laufenden Stunde durch eine abgeschlossene M5-Kerze gesweept werden.
export function collectChecklistH1Sweeps(context) {
  const h1 = closedChecklistCandles(context.h1Candles, '1h', context.evaluatedAt);
  const m5 = closedChecklistCandles(context.m5Candles, '5m', context.evaluatedAt).filter(c => !c.ignored);
  const frontier = h1.at(-1)?.time + 3600;
  const levels = [1, -1].flatMap(dir => collectStructureLqLevels(context.h1State, dir, true));
  return levels.flatMap(level => {
    const from = level.touched ? level.touchedTime : frontier;
    if (!Number.isFinite(from)) return [];
    const window = m5.filter(c => c.time >= from && (!level.touched || c.time < from + 3600));
    const fineTouch = firstTouchAfter(window, level, 3600, level.dir === -1);
    if (fineTouch == null) {
      // Historische H1-Touches bleiben bei fehlendem M5-Präfix nur am H1-Schluss belegt.
      return level.touched ? [{ ...level, recognizedAt: from + 3600 }] : [];
    }
    // Die H1-Open-Time bleibt die Ereignis-ID der bestehenden Setup-Erkennung;
    // der feinere M5-Touch liefert separat den frühestmöglichen Wissenszeitpunkt.
    const touchedTime = level.touched ? from : Math.floor(fineTouch / 3600) * 3600;
    return [{ ...level, touched: true, touchedTime, endTime: touchedTime,
      fineTouchedTime: fineTouch, recognizedAt: fineTouch + 300 }];
  });
}
