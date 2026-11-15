import {barSecondsForTimeframeCi} from './timeframes.js';

// Lokale M-OBs werden nicht vom HTF-Watcher gepflegt; Pins brauchen Find-or-create und Snapshotstatus.
export function isChartOrderBlockTimeframe(timeframe) {
  const seconds=barSecondsForTimeframeCi(timeframe);
  return seconds===60||seconds===300;
}
