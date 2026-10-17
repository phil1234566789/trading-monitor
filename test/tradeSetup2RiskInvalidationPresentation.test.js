import {expect,it} from 'vitest';
import {setupEntryConditions} from '../src/tradeSetup2Review.js';
import {tradeSetup2HistoryItems} from '../src/tradeSetup2HistoryItems.js';
import {JOINT_LOSS_RISK_VERSION,JOINT_LOSS_INVALIDATION_DETAIL} from '../src/dealingRangeRisk.js';
import {DEALING_RANGE_VERSION} from '../src/tradeSetup2DealingRange.js';
const reason='twoConsecutiveJointLosses',label='DR risiko-invalidiert · zwei Verlust-Entries in Folge';
function snapshot(at=600){return {id:'saved-risk',runId:'run',setupKey:'GBPUSD:setup1:1',instrument:'GBPUSD',direction:'short',knownAt:at,
 dealingRange:{version:DEALING_RANGE_VERSION,status:'invalidated',reason,details:[JOINT_LOSS_INVALIDATION_DETAIL]},
 checklist:{status:'ready',evaluatedAt:at,model:'countertrend',checks:{},setup:{primary:{invalidation:1.4,reactionRecognizedAt:300,
  validity:{state:'ended',reason,recognizedAt:600},lifecycle:{main:{state:'ended',reason,recognizedAt:600,endedAt:540},entrySearchAllowed:false,
   riskInvalidation:{version:JOINT_LOSS_RISK_VERSION,recognizedAt:600,entryIds:['one','two']}}}}}};}
const options={instrument:'GBPUSD',variant:'wide',asOf:900,historyCount:5};
it('explains the saved risk end without changing the price invalidation bound',()=>{
 const saved=snapshot(),before=JSON.stringify(saved),active=setupEntryConditions(saved).rows.find(row=>row.key==='active');
 expect(active.status).toBe('unmet');expect(active.details[0]).toBe(label);expect(active.details.join(' ')).toContain('weite SL-Variante');
 const [item]=tradeSetup2HistoryItems([],[{...saved,snapshot:saved}],options);expect(item.candidateStatus).toBe('ohne Entry · '+label);
 expect(item.bounds).toEqual([{price:1.4,label:'Invalidierung',styleKey:'tradeLoss'}]);expect(JSON.stringify(saved)).toBe(before);
});
it('does not expose a risk end before its saved recognition time',()=>{
 const saved=snapshot(540);saved.dealingRange={version:DEALING_RANGE_VERSION,status:'validated'};
 expect(setupEntryConditions(saved).rows.find(row=>row.key==='active').details.join(' ')).not.toContain(label);
 expect(tradeSetup2HistoryItems([],[{...saved,snapshot:saved}],{...options,asOf:599})[0].candidateStatus).not.toContain(label);
});
it('preserves the existing price-end wording for older snapshots',()=>{
 const saved=snapshot();saved.dealingRange={version:DEALING_RANGE_VERSION,status:'invalidated',reason:'priceInvalidation'};
 saved.checklist.setup.primary.lifecycle={main:{state:'ended',reason:'invalidation',recognizedAt:600}};saved.checklist.setup.primary.validity={state:'ended',reason:'invalidation',recognizedAt:600};
 expect(setupEntryConditions(saved).rows.find(row=>row.key==='active').details.join(' ')).toContain('Invalidation vor T1');
 expect(tradeSetup2HistoryItems([],[{...saved,snapshot:saved}],options)[0].candidateStatus).toContain('Marktidee Invalidation vor T1');
});

it('does not reinterpret an unversioned historical reason as a new risk invalidation',()=>{
 const saved=snapshot();delete saved.checklist.setup.primary.lifecycle.riskInvalidation;saved.dealingRange={version:DEALING_RANGE_VERSION,status:'validated'};
 expect(setupEntryConditions(saved).rows.find(row=>row.key==='active').details.join(' ')).not.toContain(label);
 expect(tradeSetup2HistoryItems([],[{...saved,snapshot:saved}],options)[0].candidateStatus).not.toContain(label);
});

it('retains the stored v1 joint-loss explanation without interpreting it as the new wide-loss rule',()=>{
 const saved=snapshot();saved.checklist.setup.primary.lifecycle.riskInvalidation.version='joint-sl-loss-streak-v1';
 saved.dealingRange.details=['Beide SL-Varianten der zwei aufeinanderfolgenden Entries haben verloren.'];
 const before=JSON.stringify(saved),details=setupEntryConditions(saved).rows.find(r=>r.key==='active').details.join(' ');
 expect(details).toContain('Beide SL-Varianten');expect(JSON.stringify(saved)).toBe(before);
});
