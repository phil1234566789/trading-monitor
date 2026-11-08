import {entryPattern1M5Bos,entryPattern1CountertrendState} from './entryPattern1M5Bos.js';
import {p2PreliminaryM5Bos,P2_PRELIMINARY_M5_BOS_VERSION} from './p2PreliminaryM5Bos.js';
import {detectLiquidityLevels} from './liquidityDetection.js';
import {computeRangesPivots,buildMarketStructureState} from './marketStructureAnalysis';
import {ENTRY_PATTERN_1_VERSION} from './entryPattern1Conditions.js';

const m5ConfirmationDependencies={detectLiquidityLevels,computeRangesPivots,buildMarketStructureState,entryPattern1CountertrendState};
export const m5BosRuleVersionFor=(instrument,entryPattern=ENTRY_PATTERN_1_VERSION)=>instrument==='XAUUSD'&&entryPattern===ENTRY_PATTERN_1_VERSION?P2_PRELIMINARY_M5_BOS_VERSION:undefined;

export function entryPattern1M5Confirmation({instrument,reaction,entryPattern=ENTRY_PATTERN_1_VERSION,deps=m5ConfirmationDependencies,...input}){
 const bos=entryPattern1M5Bos(reaction,input.countertrend,input.direction,input.evaluatedAt);
 if(bos||!m5BosRuleVersionFor(instrument,entryPattern)||input.periodInner!==2)return bos;
 return p2PreliminaryM5Bos({...input,deps});
}

export function entryPattern1M5ConfirmationLabel(instrument,bos,version){
 return bos?.evidenceType==='P2-preliminary-close-break'?'M5-P2-Vorstufe':
  m5BosRuleVersionFor(instrument,version)?'M5-BOS oder P2-Vorstufe':'M5-BOS in Setup-Richtung';
}
