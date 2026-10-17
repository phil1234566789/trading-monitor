
import {describe,it,expect} from 'vitest';
import {evaluateJointLossRisk,JOINT_LOSS_RISK_VERSION} from '../src/dealingRangeRisk.js';
import {evaluateCountertrendLifecycle} from '../src/countertrendLifecycle.js';
import {evaluateDealingRange,dealingRangeLabel} from '../src/tradeSetup2DealingRange.js';
import {buildTradeSetup2CandidateSnapshot} from '../src/tradeSetup2Snapshot.js';
import {createChecklistHistoryRecorder} from '../src/tradeSetup2ChecklistHistory.js';

const pair=(id,entryTime,exitRecognizedAt,changes={})=>['wide','narrow'].map(variant=>({
  entryId:id,entryTime,variant,status:'closed',outcome:'slBeforeT1',pnlUsd:-100,
  exitTime:exitRecognizedAt-60,exitRecognizedAt,t1RecognizedAt:null,...changes}));
const first=pair('one',600,780),third=pair('three',900,1080);
const middle=changes=>pair('two',840,900,changes);

describe('T74 direkte chronologische Entryfolge',()=>{
 it.each([
   {status:'open',outcome:null,pnlUsd:null,exitRecognizedAt:null},
   {status:'ambiguous',outcome:null,pnlUsd:null,exitRecognizedAt:null},
   {status:'notExecutable',outcome:null,pnlUsd:null,exitRecognizedAt:null},
   {outcome:'t1Be',pnlUsd:0,netPnlUsd:-5},
   {outcome:'t1Be',pnlUsd:1,netPnlUsd:-4},
   {outcome:'t2',pnlUsd:100},
 ])('Loss–X–Loss unterbricht bei $status/$outcome',changes=>{
   expect(evaluateJointLossRisk([...first,...middle(changes),...third],1200)).toBeNull();
 });
 it.each(['wide','narrow'])('auch ein einzelner Nicht-Loss bei %s unterbricht',variant=>{
   const x=middle({});Object.assign(x.find(e=>e.variant===variant),{outcome:'t2',pnlUsd:100});
   expect(evaluateJointLossRisk([...first,...x,...third],1200)).toBeNull();
 });
 it('zwei unabhängige SL-Serien sind keine gemeinsame Serie',()=>{
   const two=middle({});two[0].outcome='t2';two[0].pnlUsd=100;
   const three=third.map(e=>({...e}));three[1].outcome='t2';three[1].pnlUsd=100;
   expect(evaluateJointLossRisk([...first,...two,...three],1200)).toBeNull();
 });
 it('verliert bei fehlender/nicht ausführbarer Variante keinen unterbrechenden Entry',()=>{
   expect(evaluateJointLossRisk([...first,middle({})[0],...third],1200)).toBeNull();
 });
 it('wartet bei umgekehrter Abschlussfolge auf beide vollständigen Entries',()=>{
   const one=pair('one',600,1200),two=pair('two',720,900);
   expect(evaluateJointLossRisk([...two,...one],1199)).toBeNull();
   expect(evaluateJointLossRisk([...two,...one],1200)).toEqual({
     version:JOINT_LOSS_RISK_VERSION,recognizedAt:1200,entryIds:['one','two']});
 });
 it('nimmt bei überlappenden Entries die erste kausal fertige Nachbarpaarung',()=>{
   const entries=[...pair('one',600,1800),...pair('two',720,960),...pair('three',840,1020)];
   expect(evaluateJointLossRisk(entries,1500)).toMatchObject({recognizedAt:1020,entryIds:['two','three']});
 });
 it('wartet auf den weiten Abschluss, nicht auf einen späteren engen Abschluss',()=>{
   const two=middle({});two[0].exitRecognizedAt=1140;two[1].exitRecognizedAt=1200;
   expect(evaluateJointLossRisk([...first,...two],1139)).toBeNull();
   expect(evaluateJointLossRisk([...first,...two],1140)).toMatchObject({recognizedAt:1140});
 });
 it('dedupliziert nicht zu zwei Verlusten und erfindet bei widersprüchlichen Varianten keinen Loss',()=>{
   expect(evaluateJointLossRisk([...first,...first],1200)).toBeNull();
   expect(evaluateJointLossRisk([...first,...third,{...third[0],pnlUsd:50}],1200)).toBeNull();
 });
 it('beendet die DR zur Risikokennung ohne spätere Preisereignisse rückwirkend vorzuziehen',()=>{
   const selection={status:'passed',direction:'short',selectedAt:600,target1:{price:1.1},target2:{price:1}};
   const rows=Array.from({length:12},(_,i)=>({time:600+i*60,high:i>=9?1.5:1.3,low:1.2}));
   const result=evaluateCountertrendLifecycle({selection,invalidation:1.4,entries:[...first,...third],
     m1Candles:rows,candles:[],evaluatedAt:1320});
   expect(result.main).toMatchObject({reason:'twoConsecutiveJointLosses',recognizedAt:1080});
   expect(result.target1.status).toBe('open');
 });
 it('behält ein früher bestätigtes Preisende unverändert',()=>{
   const result=evaluateCountertrendLifecycle({selection:{status:'passed',direction:'short',selectedAt:600,
     target1:{price:1.1}},invalidation:1.4,entries:[...first,...third],
     m1Candles:[{time:600,high:1.5,low:1.2}],candles:[],evaluatedAt:1200});
   expect(result.main).toMatchObject({reason:'invalidation',recognizedAt:660});
   expect(result.riskInvalidation).toBeUndefined();
 });
 it('speichert Risikoende und Historie ohne den Preis-Invalidierungslevel umzuschreiben',()=>{
   const risk={version:JOINT_LOSS_RISK_VERSION,recognizedAt:1080,entryIds:['one','three']};
   const checks={outerM5Trend:{status:'passed'},liquiditySweep:{status:'passed'},reaction:{status:'passed'},
     m5Trend:{status:'passed'},antiConfluences:{status:'clear'},confluences:{status:'passed'}};
   const candidate={id:'EURUSD:setup1:19982',knownAsOf:1080,recognizedAt:600,reactionRecognizedAt:600,
     setupType:'countertrend',direction:'short',checks,invalidation:1.4,
     targetSelection:{status:'passed',selectedAt:600,target1:{price:1.1,knownAt:600}},
     lifecycle:{main:{state:'ended',reason:'twoConsecutiveJointLosses',recognizedAt:1080,endedAt:1080},
       entrySearchAllowed:false,riskInvalidation:risk}};
   candidate.validity=candidate.lifecycle.main;
   const checklist={status:'ready',model:'countertrend',instrument:'EURUSD',ruleVersion:'countertrend-abcdef-v2',
     evaluatedAt:1080,direction:'short',checks,setup:{primary:candidate,candidates:[candidate]}};
   const dr=evaluateDealingRange(checklist);
   expect(dr).toMatchObject({status:'invalidated',reason:'twoConsecutiveJointLosses',riskInvalidation:risk});
   const snapshot=buildTradeSetup2CandidateSnapshot({checklist,candidate});
   expect(snapshot.rangeCourse).toMatchObject({version:'countertrend-joint-loss-risk-v4',invalidation:1.4,
     lifecycle:{riskInvalidation:risk}});
   expect(dealingRangeLabel(snapshot)).toBe('DR risiko-invalidiert · zwei Verlust-Entries in Folge');
   const recorder=createChecklistHistoryRecorder();recorder.record(checklist,candidate,'M1');
   const saved=recorder.complete([snapshot])[0].checklistHistory.entries[0];
   expect(saved.dealingRange.riskInvalidation).toEqual(risk);
   expect(saved.checklist.setup.primary.lifecycle.riskInvalidation).toEqual(risk);
   expect(candidate.invalidation).toBe(1.4);
 });
});
it('never erases an already known risk stop because the narrow variant wins later',()=>{
 const one=pair('one',600,780),two=pair('two',840,900);
 Object.assign(one[1],{outcome:'t2',pnlUsd:100,exitRecognizedAt:1200});
 Object.assign(two[1],{status:'open',outcome:null,pnlUsd:null,exitRecognizedAt:null});
 const rows=[...one,...two];
 expect(evaluateJointLossRisk(rows,900)).toMatchObject({recognizedAt:900});
 expect(evaluateJointLossRisk(rows,1200)).toEqual(evaluateJointLossRisk(rows,900));
 const before=structuredClone(rows);before[1].exitRecognizedAt=899;
 expect(evaluateJointLossRisk(before,1200)).toBeNull();
});
