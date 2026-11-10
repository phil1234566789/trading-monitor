import { JOINT_LOSS_RISK_VERSION } from './dealingRangeRisk.js';
import { ENTRY_CATEGORY_VERSION } from './entryCategory.js';
import { checklistStatisticsConfiguration, checklistConfigurationKey } from './tradeSetupChecklistStatistics.js';
import { SIMULATION_VERSION } from './tradeSetupSimulation.js';
import { SIMULATION_COST_VERSION } from './tradeSetupSimulationCosts.js';
import { ENTRY_PATTERN_1_SIZING_VERSION } from './tradeSetup2EntrySizing.js';
import { COUNTERTREND_STAGE_VERSION } from './tradeSetup2DealingRange.js';
import { berlinDateStrFor, berlinDayRangeUtcMs } from './berlinTime.js';
import { H1_COUNTER_DIVERGENCE_RULE, OBSERVATION_RULE_VERSION } from './checklistObservationRules.js';
import { ENTRY_PATTERN_1_VERSION } from './entryPattern1Conditions.js';
import {m5BosRuleVersionFor} from './entryPattern1M5Confirmation.js';
import {M1_FVG_RETEST_PATTERN_VERSION} from './m1FvgRetestSequence.js';
import {M1_STRUCTURE_PERIOD,M1_FVG_RETEST_STRUCTURE_PERIOD} from './m1StructureSettings.js';
import {RELATIVE_M5_SWEEP_RANGE_VERSION} from './relativeM5SweepRanges.js';
import {SOURCE_FAMILY_VERSION} from './setupSourceFamily.js';
import {SOURCE_IDEA_BINDING_VERSION} from './setupSourceIdeaBindings.js';
import {SOURCE_IDEA_EXIT_POLICY} from './setupSourceIdeaIdentity.js';
import {ENTRY_PATTERN_2_OB_RULE} from './entryPattern2OrderBlock.js';
export {SOURCE_FAMILY_VERSION} from './setupSourceFamily.js';
export {SOURCE_IDEA_BINDING_VERSION} from './setupSourceIdeaBindings.js';
export {SOURCE_IDEA_EXIT_POLICY} from './setupSourceIdeaIdentity.js';
export {RELATIVE_M5_SWEEP_RANGE_VERSION} from './relativeM5SweepRanges.js';

export const SETUP2_VERSION='ls-entry-patterns-ob-depth-v27';
export const CURRENT_ENTRY_PATTERNS=[ENTRY_PATTERN_1_VERSION,M1_FVG_RETEST_PATTERN_VERSION];
export const CURRENT_M1_PERIODS={[ENTRY_PATTERN_1_VERSION]:M1_STRUCTURE_PERIOD,[M1_FVG_RETEST_PATTERN_VERSION]:M1_FVG_RETEST_STRUCTURE_PERIOD};
// Alte Snapshots behalten ihren gespeicherten Entry Pattern-Pfad im Archivreader.
export const supportsSnapshotIndicators = version => [SETUP2_VERSION, 'ls-entry-patterns-causal-alias-v26', 'countertrend-entry-model-1-v30', 'xau-v30-both-frozen-recognition-v1', 'xau-v30-both-entry-patterns-causal-alias-v2', 'ls-entry-patterns-v25', 'countertrend-entry-model-1-v24', 'countertrend-entry-model-1-v23', 'countertrend-entry-model-1-v22', 'countertrend-entry-model-1-v21', 'countertrend-entry-model-1-v20', 'countertrend-entry-model-1-v19', 'countertrend-entry-model-1-v18', 'countertrend-entry-model-1-v17', 'countertrend-entry-model-1-v15', 'countertrend-entry-model-1-v14', 'countertrend-entry-model-1-v13', 'countertrend-entry-model-1-v12', 'countertrend-entry-model-1-v11', 'countertrend-entry-model-1-v10', 'countertrend-entry-model-1-v9', 'countertrend-lifecycle-v8', 'countertrend-abcdef-v7', 'countertrend-abcd-v6', 'entry-snapshot-causal-c-m5-choch-v5', 'entry-snapshot-active-h1-trading-hours-v4', 'entry-snapshot-active-h1-p5-time-abc-v3', 'entry-snapshot-p5-time-abc-v2'].includes(version);
export function buildTradeSetup2Configuration({instrument,settings={},sessionConfigs=[],tradingWindows,news=[],newsLoadStatus}) {
  const m5BosRuleVersion=m5BosRuleVersionFor(instrument);
  return {...checklistStatisticsConfiguration(settings,sessionConfigs,instrument),instrument,
    ...(m5BosRuleVersion?{m5BosRuleVersion}:{}),
    entryPattern:ENTRY_PATTERN_1_VERSION,entryPatterns:[...CURRENT_ENTRY_PATTERNS],
    entryPattern2OrderBlockRule:{...ENTRY_PATTERN_2_OB_RULE},
    includeSweepRetestSources:true,m1Periods:{...CURRENT_M1_PERIODS},entryCategoryVersion:ENTRY_CATEGORY_VERSION,
    relativeM5SweepRangeVersion:RELATIVE_M5_SWEEP_RANGE_VERSION,
    sourceFamilyVersion:SOURCE_FAMILY_VERSION,sourceIdeaBindingVersion:SOURCE_IDEA_BINDING_VERSION,exitPolicy:SOURCE_IDEA_EXIT_POLICY,
    observationRuleVersion:OBSERVATION_RULE_VERSION,antiConfluenceRules:[{...H1_COUNTER_DIVERGENCE_RULE}],
    setupVersion:SETUP2_VERSION,drRiskVersion:JOINT_LOSS_RISK_VERSION,dealingRangeVersion:COUNTERTREND_STAGE_VERSION,setupModel:'countertrend',outerM5Required:true,simulationVersion:SIMULATION_VERSION,entrySizingVersion:ENTRY_PATTERN_1_SIZING_VERSION,costVersion:SIMULATION_COST_VERSION,m1Period:5,
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
