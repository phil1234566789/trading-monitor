import {M1_FVG_RETEST_PATTERN_VERSION} from './m1FvgRetestSequence.js';
export const isEntryPattern2=version=>version===M1_FVG_RETEST_PATTERN_VERSION;
// Archivbelege ohne diese damals noch nicht geltenden Regeln behalten ihren gespeicherten Vertrag.
const orderBlockRules=(conditions,at)=>['orderBlockPlacement','orderBlockDepth'].map(key=>({key,required:true,
  passed:conditions?.[key]?.status==='passed'&&Number.isFinite(conditions[key].recognizedAt)&&conditions[key].recognizedAt<=at}));
const hasOrderBlockRules=conditions=>conditions?.orderBlockPlacement!==undefined||conditions?.orderBlockDepth!==undefined;
export function entryPattern2StructureReady(conditions,direction,at) {
  const {m1PivotBreak,retest}=conditions ?? {};
  return ['short','long'].includes(direction)&&Number.isFinite(at)
    &&conditions?.orderBlockInvalidated!==true&&(!hasOrderBlockRules(conditions)||orderBlockRules(conditions,at).every(rule=>rule.passed))
    &&m1PivotBreak?.type==='pivot-break'&&m1PivotBreak.direction===direction
    &&Number.isFinite(m1PivotBreak.recognizedAt)&&m1PivotBreak.recognizedAt<=at
    &&Number.isFinite(retest?.recognizedAt)&&retest.recognizedAt<=m1PivotBreak.recognizedAt
    &&retest.orderBlock?.dir===(direction==='short'?-1:1);
}
export function entryPattern2ConditionResults(conditions,direction,entryAt) {
  const {m1PivotBreak,retest,fvgRetest,retestedFvg,fvg}=conditions ?? {};
  const known=fact=>Number.isFinite(fact?.recognizedAt)&&fact.recognizedAt<=entryAt;
  const same=fact=>known(fact)&&fact.direction===direction;
  return [
    ...(hasOrderBlockRules(conditions)?orderBlockRules(conditions,entryAt):[]),
    {key:'retest',required:true,passed:['short','long'].includes(direction)&&Number.isFinite(entryAt)
      &&conditions?.orderBlockInvalidated!==true&&known(retest)&&retest.orderBlock?.dir===(direction==='short'?-1:1)},
    {key:'m1PivotBreak',required:true,passed:entryPattern2StructureReady(conditions,direction,entryAt)},
    {key:'retestedFvg',required:true,passed:same(retestedFvg)&&known(m1PivotBreak)&&retestedFvg.recognizedAt>=m1PivotBreak.recognizedAt},
    {key:'fvgRetest',required:true,passed:known(fvgRetest)&&known(retestedFvg)&&fvgRetest.candleTime>=retestedFvg.recognizedAt},
    {key:'fvg',required:true,passed:same(fvg)&&known(fvgRetest)&&fvg.recognizedAt>fvgRetest.recognizedAt},
  ];
}
export const entryPattern2ConditionsReady=(conditions,direction,entryAt)=>entryPattern2ConditionResults(conditions,direction,entryAt).every(rule=>rule.passed);
