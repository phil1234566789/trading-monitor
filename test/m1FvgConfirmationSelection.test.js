import {expect,it} from 'vitest';
import native from './fixtures/xau27OctM1ObBreakSelection.json';
import {createM1FvgEntryProjection} from '../src/m1FvgEntryProjection.js';
import {createM1FvgChartSelection} from '../src/m1FvgChartSelection.js';
import {m1FvgEntrySequence,advanceM1FvgEntrySequence,m1FvgSequenceResult} from '../src/m1FvgEntrySequence.js';
const at=clock=>Date.parse(`2026-10-27T${clock}:00+01:00`)/1000;
it('retains the native valid confirmation but rejects OB breaks before both later false confirmations',()=>{
 for(const direction of ['short','long']){
  const candles=direction==='short'?native:native.map(c=>({...c,open:9000-c.open,close:9000-c.close,high:9000-c.low,low:9000-c.high}));
  const input={candles,evaluatedAt:at('10:16'),direction,variant:'retestReaction'};
  const p=createM1FvgEntryProjection()(input);
  expect(p.confirmations).toContain(at('08:34'));
  expect(p.confirmations).not.toContain(at('08:46'));expect(p.confirmations).not.toContain(at('10:09'));
  for(const impulse of ['08:39','08:40','09:33'])expect(p.results.get(at(impulse)).status).toBe('invalid');
 }
});
it('selects pink confirmations in both modes, gives them priority over overlapping gold, and hits only the candle wick',()=>{
 const input={candles:native,bar:'1m',replayUntil:at('08:34'),nowSec:at('11:00'),selection:{cardKey:'position:153',draftToken:1,direction:'short',variant:'retestReaction'}};
 const picker=createM1FvgChartSelection(()=>input);
 expect(picker.select(at('08:34'),4004.83)).toMatchObject({status:'ready',entryTime:at('08:35'),entryPrice:4004.83,target:input.selection});
 expect(picker.select(at('08:34'),5000)).toBe(null);expect(picker.select(at('08:35'),4004.83)).toBe(null);
 input.replayUntil=at('08:33');expect(picker.select(at('08:34'),4004.83)).toBe(null);
 input.selection.variant='immediate';input.replayUntil=at('08:26');
 expect(picker.select(at('08:26'),native.find(c=>c.time===at('08:26')).close)).toMatchObject({entryTime:at('08:27'),entryPrice:4005.43});
});
it('allows an exact OB edge but rejects even a wick break on retest or confirming candle, mirrored for long',()=>{
 for(const direction of ['short','long'])for(const stage of ['retest','confirmation'])for(const broken of [false,true]){
  const short={direction:'short',recognizedAt:180,candleTime:60,top:110,bottom:102,orderBlock:{dir:-1,top:113,bottom:110}};
  const fvg=direction==='short'?short:{...short,direction:'long',top:138,bottom:130,orderBlock:{dir:1,top:130,bottom:127}};
  let rows=[{time:180,open:109,high:stage==='retest'&&broken?113.01:113,low:108,close:111},{time:240,open:111,high:stage==='confirmation'&&broken?113.01:113,low:109,close:110}];
  if(direction==='long')rows=rows.map(c=>({...c,open:240-c.open,close:240-c.close,high:240-c.low,low:240-c.high}));
  const s=m1FvgEntrySequence(fvg,'retestReaction');for(const c of rows)advanceM1FvgEntrySequence(s,c);
  expect(m1FvgSequenceResult(s).status).toBe(broken?'invalid':'ready');
 }
});
it('resolves multiple origins for one confirmation deterministically without duplicating the entry',()=>{
 const p=createM1FvgEntryProjection()({candles:native,evaluatedAt:at('10:16'),direction:'short',variant:'retestReaction'});
 const groups=new Map();for(const result of p.results.values())if(result.status==='ready'){
  const key=result.confirmationCandleTime;groups.set(key,[...(groups.get(key)??[]),result]);
 }
 const shared=[...groups.entries()].filter(([,rows])=>rows.length>1);expect(shared.length).toBeGreaterThan(0);
 for(const [time,rows]of shared){expect(p.confirmationResults.get(time)).toBe(rows[0]);expect(new Set(rows.map(r=>`${r.entryTime}|${r.entryPrice}`)).size).toBe(1);}
});
