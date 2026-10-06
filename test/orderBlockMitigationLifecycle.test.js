import {it,expect} from 'vitest';
import {evaluateOrderBlockMitigation} from '../src/orderBlockMitigation.js';
import cases from './fixtures/gbpusd-ob-mitigation-pins.json';

const ob={dir:-1,startTime:-600,recognizedAt:0,top:1.312,bottom:1.299};
const rows=Array.from({length:12},(_,i)=>({time:i*60,open:1.3,close:1.3,
 high:i%4===1?1.311:i%4===2?1.307:1.301,low:i%4===1?1.309:i%4===2?1.305:1.299}));
const evaluate=(orderBlock,m1Candles,fromTime=0,evaluatedAt=720,progress)=>
 evaluateOrderBlockMitigation({orderBlock,m1Candles,fromTime,evaluatedAt,progress});
const mirror=c=>({...c,open:3-c.open,close:3-c.close,high:3-c.low,low:3-c.high});
it.each(['short','long'])('%s cannot survive piercing before/on a retest or before its FVG',direction=>{
 const zone=direction==='short'?ob:{...ob,dir:1,top:3-ob.bottom,bottom:3-ob.top};
 for(const time of [0,60,120]) {
  const pierced=rows.map(c=>c.time===time?{...c,high:ob.top+0.00001}:c);
  const result=evaluate(zone,direction==='short'?pierced:pierced.map(mirror));
  expect(result.fvg).toBeNull();expect(result.retest).toBeNull();
 }
});
it('does not revive an OB already mitigated before the evaluated window',()=>{
 expect(evaluate(ob,rows,300).fvg).toBeNull();
 expect(evaluate(ob,rows,300).retest).toBeNull();
});
it('requires history from OB knownAt, but never from its forming candles or before a new OB',()=>{
 expect(evaluate(ob,rows.filter(c=>c.time>=300),300).status).toBe('unknown');
 expect(evaluate({...ob,startTime:180,recognizedAt:300},rows.filter(c=>c.time>=300),0).fvg?.recognizedAt).toBe(540);
 expect(evaluate({...ob,recognizedAt:780},rows).retest).toBeNull();
});
it('preserves a valid frozen first FVG across later piercing, jumps, and rewind',()=>{
 const later=rows.map(c=>c.time===300?{...c,high:ob.top+0.00001}:c),progress={};
 for(const at of [60,240,720,120,720])expect(evaluate(ob,later,0,at,progress)).toEqual(evaluate(ob,later,0,at));
 expect(evaluate(ob,later).fvg?.recognizedAt).toBe(240);
});
it.each(cases)('original pin $pin proves OB validity independently of the BOS gate',c=>{
 const result=evaluate(c.orderBlock,c.candles,Math.max(c.fromTime,c.orderBlock.recognizedAt),c.entryAt);
 if([392,393].includes(c.pin)){expect(result.fvg).toBeNull();expect(result.retest).toBeNull();}
 else {expect(result.retest?.candleTime).toBe(c.originalRetest);expect(result.fvg?.recognizedAt).toBe(c.entryAt);}
});

it('rewinding a pierced candidate restores only the causal prefix and repairs missing warmup',()=>{
 const pierced=rows.map(c=>c.time===120?{...c,high:ob.top+0.00001}:c),progress={};
 for(const at of [120,720,120,720])expect(evaluate(ob,pierced,0,at,progress)).toEqual(evaluate(ob,pierced,0,at));
 expect(evaluate(ob,rows.filter(c=>c.time>=300),300,720,progress).status).toBe('unknown');
 expect(evaluate(ob,rows,300,720,progress)).toMatchObject({status:'ready',retest:null,fvg:null});
});
it('exact far-boundary touch remains valid; forming candles cannot invalidate a known OB',()=>{
 const boundary=rows.map(c=>c.time===120?{...c,high:ob.top}:c);
 expect(evaluate(ob,[{...rows[0],time:-60,high:ob.top+1},...boundary]).fvg?.recognizedAt).toBe(240);
});

it.each(['short','long'])('a gap beyond the OB before first contact also invalidates %s',direction=>{
 const gap={...rows[0],open:1.32,close:1.32,low:1.32,high:1.321};
 const history=[gap,...rows.slice(1)],zone=direction==='short'?ob:{...ob,dir:1,top:3-ob.bottom,bottom:3-ob.top};
 expect(evaluate(zone,direction==='short'?history:history.map(mirror))).toMatchObject({retest:null,fvg:null});
});
