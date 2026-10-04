import { markIgnoredCandles } from './sessionOccurrences.js';
import { berlinOffsetMinutes } from './berlinTime.js';
import { collectObsZones, filterHistorical } from './priceChartObZones.js';
import { computeRangesPivots,buildMarketStructureState } from './marketStructureAnalysis';
import { detectOrderBlocks } from './orderBlocks.js';
import { obMinimum } from './instrumentConfig.js';
import { buildSnapshotM5 } from './tradeSetup2SnapshotIndicators.js';

export function calculateSnapshotIndicators({ frames: rawFrames, source, config, at, props }) {
  const sessions = config.sessions.filter(s => s.instrument === source.instrument);
  const frames = Object.fromEntries(Object.entries(rawFrames).map(([bar, rows]) => [bar,
    markIgnoredCandles(rows, sessions, sec => berlinOffsetMinutes(sec * 1000))]));
  // HTF-OBs aus damaligen Kerzen statt aus heute fortgeschriebenen DB-Zonen.
  const dbObZones = ['1h', '4h'].flatMap(bar => (frames[bar] ? detectOrderBlocks(frames[bar], bar === '1h' ? '1H' : '4H', false,
    obMinimum(source.instrument, bar === '1h' ? '1H' : '4H')).map(z => ({ ...z, instrument: source.instrument, timeframe: bar === '1h' ? '1H' : '4H' })) : []));
  const zones = filterHistorical(collectObsZones({ ...props, m5Candles: frames['5m'] ?? [], dbObZones,
    symbol: source.instrument, replayUntil: at, price: null }), props.showHistoricalObs);
  const pivots = {};
  for (const bar of ['1h', '5m']) {
    if (!frames[bar]) continue;
    const candles = frames[bar].filter(c => !c.ignored);
    const outer = bar === '1h' ? config.rangesPeriod : config.m5StructurePeriod;
    const inner = bar === '1h' ? config.ranges2Period : config.m5Structure2Period;
    pivots[bar] = { pivotsOuter: computeRangesPivots(candles, outer ?? 5, -Infinity),
      pivotsInner: computeRangesPivots(candles, inner ?? 2, -Infinity) };
  }
  const m5 = props.showM5Structure && frames['5m'] ? buildSnapshotM5(frames['5m'], source, config, at) : null;
  const h1=props.showRanges&&frames['1h']?{state:buildMarketStructureState(pivots['1h'].pivotsOuter,
    pivots['1h'].pivotsInner,config.rangesPeriod??5,config.ranges2Period??2,frames['1h'].filter(c=>!c.ignored)),...pivots['1h']}:null;
  return { zones, pivots, m5,h1 };
}
