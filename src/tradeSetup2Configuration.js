import { checklistStatisticsConfiguration, checklistConfigurationKey } from './tradeSetupChecklistStatistics.js';
import { SIMULATION_VERSION } from './tradeSetupSimulation.js';
import { SIMULATION_COST_VERSION } from './tradeSetupSimulationCosts.js';
import { ENTRY_SIZING_VERSION } from './tradeSetup2EntrySizing.js';
import { DEALING_RANGE_VERSION } from './tradeSetup2DealingRange.js';
import { berlinDateStrFor, berlinDayRangeUtcMs } from './berlinTime.js';

export const SETUP2_VERSION='entry-snapshot-causal-c-m5-choch-v5';
// Neue Scanner-Gates ändern keine Pivots oder OBs der gespeicherten Archivdarstellung.
export const supportsSnapshotIndicators = version => [SETUP2_VERSION, 'entry-snapshot-active-h1-trading-hours-v4', 'entry-snapshot-active-h1-p5-time-abc-v3', 'entry-snapshot-p5-time-abc-v2'].includes(version);
export function buildTradeSetup2Configuration({instrument,settings={},sessionConfigs=[],tradingWindows,news=[],newsLoadStatus}) {
  return {...checklistStatisticsConfiguration(settings,sessionConfigs,instrument),instrument,
    setupVersion:SETUP2_VERSION,dealingRangeVersion:DEALING_RANGE_VERSION,simulationVersion:SIMULATION_VERSION,entrySizingVersion:ENTRY_SIZING_VERSION,costVersion:SIMULATION_COST_VERSION,m1Period:5,
    m5StructurePeriod:settings.m5StructurePeriod ?? 5,m5Structure2Period:settings.m5Structure2Period ?? 2,
    sessions:sessionConfigs.filter(s=>s.instrument===instrument).map(s=>({...s})),
    tradingWindows:tradingWindows ?? null,news,newsLoadStatus:newsLoadStatus ?? 'unknown'};
}
export async function setup2DailyRun(configuration,evaluatedAt) {
  const date=berlinDateStrFor(evaluatedAt);
  const following=new Date(Date.parse(`${date}T12:00:00Z`)+86400000).toISOString().slice(0,10);
  const from=berlinDayRangeUtcMs(date).startUtcMs/1000;
  const to=berlinDayRangeUtcMs(following).startUtcMs/1000;
  const key=await checklistConfigurationKey(configuration);
  return {id:`chart:${configuration.instrument}:${date}:${key}`,version:SETUP2_VERSION,configuration,
    from,to,evaluatedAt,status:'running',progress:{},coverage:{},provenance:{source:'chart',feed:'fxcm-bid'}};
}
