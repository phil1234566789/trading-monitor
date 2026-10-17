import {it,expect,vi} from 'vitest';
import {scanTradeSetup2Window} from '../src/tradeSetup2Scan.js';
import * as checklistModule from '../src/countertrendChecklist.js';
import * as structureModule from '../src/m1Structure.js';
import * as m1Module from '../src/m1Checklist.js';
import * as simulation from '../src/tradeSetupSimulation.js';
import original from './fixtures/gbpusd-2970-wide-loss.json';

it('preserves the first risk stop across memo, full and resumed scans when a narrow win becomes known later',async()=>{
 const base=Date.parse('2026-08-18T10:00:00+02:00')/1000,key='GBPUSD:setup1:1';
 const entry=(id,t)=>({...original.entries[2].entry,id,setupKey:key,recognizedAt:base+t});
 const existing=[{setupKey:key,entry:entry('one',600)},{setupKey:key,entry:entry('two',840)}],late=entry('late',1260);
 const checks={outerM5Trend:{status:'passed'},liquiditySweep:{status:'passed'},reaction:{status:'passed'},m5Trend:{status:'passed'},antiConfluences:{status:'clear',rules:[]},confluences:{status:'clear',rules:[]}};
 const source={tradeSetupId:1,instrument:'GBPUSD',createdAt:base+600,obStartTime:base+300};
 const setup=vi.spyOn(checklistModule,'evaluateCountertrendChecklist').mockImplementation(({evaluatedAt})=>{
  const candidate={id:key,tradeSetupId:1,setupType:'countertrend',direction:'long',recognizedAt:base+600,reactionRecognizedAt:base+600,knownAsOf:evaluatedAt,checks,invalidation:1,
   targetSelection:{status:'passed',direction:'long',selectedAt:base+600,target1:{price:1.4,knownAt:base+600},target2:{price:1.5,knownAt:base+600}},sweep:{level:{touchedTime:base+300,price:1.1}}};
  return {status:'ready',model:'countertrend',ruleVersion:'countertrend-abcdef-v2',entryPattern:late.entryPattern,instrument:'GBPUSD',evaluatedAt,direction:'long',checks,setup:{primary:candidate,candidates:[candidate],classifications:[]},context:{}};
 });
 const structure=vi.spyOn(structureModule,'buildM1Structure').mockReturnValue({status:'ready'});
 const model=vi.spyOn(m1Module,'evaluateM1Checklist').mockImplementation(({evaluatedAt})=>({evaluatedAt,entryPattern:late.entryPattern,conditions:late.conditions,entry:evaluatedAt===late.recognizedAt?late:null}));
 // Isoliert die zeitliche Outcome-Auflösung; Original-Preisausgänge sind im nativen DR2970-Test abgesichert.
 const price=vi.spyOn(simulation,'evaluateSimulation').mockImplementation(({entry,variant,evaluatedAt})=>{
  const close=base+(entry.id==='one'?780:900),win=variant==='narrow'&&entry.id==='one';
  const done=win?evaluatedAt>=base+1200:variant==='wide'&&evaluatedAt>=close;
  return {entryId:entry.id,entryTime:entry.recognizedAt,variant,status:done?'closed':'open',outcome:done?(win?'t2':'slBeforeT1'):null,pnlUsd:done?(win?100:-100):null,exitRecognizedAt:done?(win?base+1200:close):null,t1RecognizedAt:null};
 });
 const m1=Array.from({length:13},(_,i)=>({time:base+600+i*60,open:1.2,high:1.3,low:1.1,close:1.2}));
 const input={instrument:'GBPUSD',tradeSetups:[source],h1Candles:[],dailyAnchors:[],m1Candles:m1,m5Candles:m1.filter(c=>c.time%300===0),fromTime:base+600,toTime:base+1320,existingEntries:existing,
  tradingWindows:{weekday:[[0,1440]],saturday:[],sunday:[]},sessionConfigs:[],news:[],newsLoadStatus:'ready',onMinuteCheck:()=>{},yieldControl:()=>Promise.resolve()};
 try{
  for(const options of [{useMemo:true},{useMemo:false},{useMemo:true,fromTime:base+1200},{useMemo:false,fromTime:base+1200}]){
   const rows=await scanTradeSetup2Window({...input,...options});
   expect(rows.filter(s=>s.entry)).toHaveLength(0);
   expect(rows.at(-1).dealingRange).toMatchObject({status:'invalidated',riskInvalidation:{recognizedAt:base+900,entryIds:['one','two']}});
  }
 }finally{setup.mockRestore();structure.mockRestore();model.mockRestore();price.mockRestore();}
});
