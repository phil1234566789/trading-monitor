import { checklistStatisticsConfiguration, checklistConfigurationKey } from './tradeSetupChecklistStatistics.js';
import { SIMULATION_VERSION } from './tradeSetupSimulation.js';
import { SIMULATION_COST_VERSION } from './tradeSetupSimulationCosts.js';
import { berlinDateStrFor, berlinDayRangeUtcMs } from './berlinTime.js';

export const SETUP2_VERSION='entry-snapshot-p5-v1';
export function buildTradeSetup2Configuration({instrument,settings={},sessionConfigs=[],tradingWindows,news=[],newsLoadStatus}) {
  return {...checklistStatisticsConfiguration(settings,sessionConfigs,instrument),instrument,
    setupVersion:SETUP2_VERSION,simulationVersion:SIMULATION_VERSION,costVersion:SIMULATION_COST_VERSION,m1Period:5,
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
