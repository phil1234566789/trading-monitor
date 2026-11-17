import {expect,it} from 'vitest';
import {dobPoiTypeAlarmRuns} from '../src/dobAlarm.js';
import {DOB_GUARDRAILS_DEFAULT} from '../src/dobGuardrails.js';

// Watcher je Setup-Familie: eigene Konfig je Durchlauf, HTF-OB behält die alten Alarm-IDs, LS bekommt eigene, ein gesperrter
// Monat sperrt nur seine Familie.
const at=1794560400;
const retest={id:'dob:XAUUSD:-1:1000:2000:retest',pairId:'dob:XAUUSD:-1:1000:2000',instrument:'XAUUSD',direction:'short',phase:'ob2Retest',phaseSince:at,
 chart:{firstOrderBlockStart:1000,secondOrderBlockStart:2000,firstOrderBlock:{top:20,bottom:18},secondOrderBlock:{top:19,bottom:17}},poi:null};
const check=input=>({setups:[{...retest,seenWith:input.guardrails}],rejected:[],pairs:new Map()});
const poiTypes=[{poiType:'htf_ob',guardrails:{...DOB_GUARDRAILS_DEFAULT,defaultTpR:4}},{poiType:'lq_sweep',guardrails:DOB_GUARDRAILS_DEFAULT}];

it('rechnet jede Familie mit ihrer Konfig und eigenen Alarm-IDs',()=>{
 const seen=[];
 const runs=dobPoiTypeAlarmRuns({poiTypes,input:{},evaluatedAt:at,check:i=>(seen.push([i.poiType,i.guardrails.defaultTpR]),check(i))});
 expect(seen).toEqual([['htf_ob',4],['lq_sweep',2]]);
 const [htf,lq]=runs.map(r=>r.events[0]);
 expect(htf).toMatchObject({id:'dob:retest:XAUUSD:short:2000',poiType:'htf_ob'});
 expect(lq).toMatchObject({id:'dob:lq_sweep:retest:XAUUSD:short:2000',poiType:'lq_sweep'});
 // Kopfzeile ohne POI-Art (Philip); die Art steht in der POI-Zeile.
 expect(htf.text).toMatch(/^🟡 DOB XAUUSD Short · OB2-Retest/);
 expect(lq.text).toMatch(/^🟡 DOB XAUUSD Short · OB2-Retest/);
 expect(htf.text.split('\n')[1]).toBe('POI: –');
 expect(lq.text.split('\n')[1]).toBe('POI: LQ-Sweep');
});

it('gesperrter Monat einer Familie lässt die andere laufen',()=>{
 const month=new Date(at*1000).getUTCMonth()+1;
 const runs=dobPoiTypeAlarmRuns({poiTypes:[{...poiTypes[0],guardrails:{...poiTypes[0].guardrails,blockedMonths:[month]}},poiTypes[1]],input:{},evaluatedAt:at,check});
 expect(runs.map(r=>r.poiType)).toEqual(['lq_sweep']);
});
