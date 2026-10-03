import { beforeEach, afterEach, vi } from 'vitest';
import * as structure from '../../src/marketStructureAnalysis';
import * as entryGate from '../../src/tradeSetup2EntrySizing.js';

// DR114 stammt aus der früheren Outer-Regel. Tests anderer Regeln setzen A
// ausdrücklich voraus; die echte aktive H1-Auswahl wird separat ohne Mock geprüft.
export function assumeFixtureH1Direction(trend = 'downtrend', approvedM5Entry = false) {
  beforeEach(() => {
    // Speicher-/Zeit-/Cachetests setzen das neue Entry-Gate voraus. Seine
    // echten Long-/Short-Grenzen werden in tradeSetup2EntrySizing geprüft.
    if(approvedM5Entry)vi.spyOn(entryGate,'entryAgainstM5Allowed').mockReturnValue(true);
    const build = structure.buildMarketStructureState, derive = structure.deriveTrendReaction;
    const h1States = new WeakSet();
    vi.spyOn(structure, 'buildMarketStructureState').mockImplementation((...args) => {
      const state = build(...args), candles = args[4];
      if (candles?.length > 1 && candles[1].time - candles[0].time >= 3600) h1States.add(state);
      return state;
    });
    vi.spyOn(structure, 'deriveTrendReaction').mockImplementation(state => {
      const actual = derive(state);
      return h1States.has(state) && actual.trend !== 'unknown' ? { ...actual, trend } : actual;
    });
  });
  afterEach(() => vi.restoreAllMocks());
}
