import {it,expect} from 'vitest';
import {entryPattern1RetestFvg} from '../src/countertrendEntryPattern1.js';
import {m1EntryFromFvg} from '../src/m1Entry.js';
import {ENTRY_PATTERN_1_VERSION} from '../src/entryPattern1Conditions.js';
import {evaluateOrderBlockMitigation} from '../src/orderBlockMitigation.js';

const rows=Array.from({length:12},(_,i)=>({time:i*60,open:1.3,close:1.3,
 high:i%4===1?1.311:i%4===2?1.307:1.301,low:i%4===1?1.309:i%4===2?1.305:1.299}));
const ob={dir:-1,startTime:0,recognizedAt:0,top:1.302,bottom:1.299};
it.each(['5m','1h','4h'])('OB timeframe %s does not change the M1 mitigation proof',timeframe=>{
 const orderBlock={...ob,timeframe};
 expect(evaluateOrderBlockMitigation({orderBlock,m1Candles:rows,fromTime:0,evaluatedAt:239}).fvg).toBeNull();
 expect(evaluateOrderBlockMitigation({orderBlock,m1Candles:rows,fromTime:0,evaluatedAt:240})).toMatchObject({
  retest:{candleTime:0,recognizedAt:60,orderBlock:{timeframe}},fvg:{direction:'short',recognizedAt:240}});
});
it('mirrors long mitigation, rejects missing/ignored proof, and recovers repaired history',()=>{
 const longOB={...ob,dir:1,top:3-ob.bottom,bottom:3-ob.top};
 const mirrored=rows.map(c=>({...c,high:3-c.low,low:3-c.high,close:3-c.close}));
 expect(evaluateOrderBlockMitigation({orderBlock:longOB,m1Candles:mirrored,fromTime:0,evaluatedAt:240}).fvg)
  .toMatchObject({direction:'long',recognizedAt:240});
 const progress={};
 expect(evaluateOrderBlockMitigation({orderBlock:ob,m1Candles:rows.filter(c=>c.time!==120),fromTime:0,evaluatedAt:240,progress}).status).toBe('unknown');
 expect(evaluateOrderBlockMitigation({orderBlock:ob,m1Candles:rows,fromTime:0,evaluatedAt:240,progress}).fvg.recognizedAt).toBe(240);
 expect(evaluateOrderBlockMitigation({orderBlock:ob,m1Candles:rows.map(c=>({...c,ignored:true})),fromTime:0,evaluatedAt:720}).retest).toBeNull();
});
it('uses only the first M1 FVG after one OB retest, including another touch',()=>{
 const first=entryPattern1RetestFvg(rows,[ob],0,'short',240);
 expect(first.fvg.recognizedAt).toBe(240);
 for(const at of [300,480,720])expect(entryPattern1RetestFvg(rows,[ob],0,'short',at).fvg).toEqual(first.fvg);
});
it('allows another opportunity only through a newly formed OB and its own retest',()=>{
 const next={...ob,startTime:300,recognizedAt:360};
 const before=entryPattern1RetestFvg(rows,[ob,next],0,'short',360);
 expect(before.fvg.recognizedAt).toBe(240);
 const after=entryPattern1RetestFvg(rows,[ob,next],0,'short',720);
 expect(after.fvg.recognizedAt).toBe(540);
 expect(after.retest.orderBlock.startTime).toBe(300);
});
it('cached jumps and rewind preserve the first FVG and discover a newly supplied OB',()=>{
 const progress={};
 for(const at of [60,240,720,120,720])expect(entryPattern1RetestFvg(rows,[ob],0,'short',at,progress))
  .toEqual(entryPattern1RetestFvg(rows,[ob],0,'short',at));
 const next={...ob,startTime:300,recognizedAt:360};
 expect(entryPattern1RetestFvg(rows,[ob,next],0,'short',720,progress))
  .toEqual(entryPattern1RetestFvg(rows,[ob,next],0,'short',720));
});
it.each(['short','long'])('wide stop belongs to the mitigated OB for %s; legacy stop stays frozen',direction=>{
 const context={entryPattern:ENTRY_PATTERN_1_VERSION,instrument:'GBPUSD',setupKey:'test',direction,
  primary:{reactionOB:{top:1.36,bottom:1.25},targetSelection:{status:'passed',selectedAt:0,target1:{price:direction==='short'?1.29:1.32}}}};
 const retest={candleTime:0,recognizedAt:60,orderBlock:ob};
 const fvg={candleTime:120,recognizedAt:240};
 const entry=m1EntryFromFvg(context,fvg,rows,240,retest);
 expect(entry.stops.wide.price).toBe(direction==='short'?ob.top:ob.bottom);
 expect(entry.stops.wide.sourceTime).toBe(ob.startTime);
 const old=m1EntryFromFvg({...context,entryPattern:'countertrend-entry-model-1-v2'},fvg,rows,240,retest);
 expect(old.stops.wide.price).toBe(direction==='short'?1.36:1.25);
});

