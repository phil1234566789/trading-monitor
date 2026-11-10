import {expect,it} from 'vitest';
import native from './fixtures/xau27OctM1FvgSelection.json';
import dr128 from './fixtures/dr128M1FvgSelection.json';
import {m1FvgEntryPrefill} from '../src/m1FvgEntrySelection.js';
import {createM1FvgEntryProjection} from '../src/m1FvgEntryProjection.js';
import {createM1FvgChartSelection} from '../src/m1FvgChartSelection.js';
const at=clock=>Date.parse(`2026-10-27T${clock}:00+01:00`)/1000;
it('shows all native b confirmations without selecting a FVG and keeps simultaneous impulses gold with a pink border',()=>{
 const input={candles:native,bar:'1m',replayUntil:at('08:34'),nowSec:at('09:00'),selection:{direction:'short',variant:'retestReaction'}};
 const picker=createM1FvgChartSelection(()=>input),painted=picker.paint(native,'gold','pink');
 expect(painted.find(c=>c.time===at('08:34'))).toMatchObject({color:'pink',borderColor:'pink'});
 expect(painted.find(c=>c.time===at('08:25')).color).toBe('gold');
 input.replayUntil=at('08:33');
 expect(picker.paint(native.filter(c=>c.time<=at('08:33')),'gold','pink').some(c=>c.time===at('08:34'))).toBe(false);
 input.selection=null;expect(picker.paint(native,'gold','pink')).toBe(native);
});
it('shows every a confirmation on its third closed candle without any selection click',()=>{
 const picker=createM1FvgChartSelection(()=>({candles:native,bar:'1m',replayUntil:at('08:26'),nowSec:at('09:00'),selection:{direction:'short',variant:'immediate'}}));
 expect(picker.paint(native,'gold','pink').find(c=>c.time===at('08:26'))).toMatchObject({color:'pink',borderColor:'pink'});
});
it('is identical to the selected-FVG prefill for both variants/directions including gaps and ignored candles',()=>{
 for(const original of [native,dr128])for(const rows of [original,original.filter((_,i)=>i!==8),original.map((c,i)=>i===8?{...c,ignored:true}:c)]){
  const evaluatedAt=rows.at(-1).time+60;
  for(const direction of ['short','long'])for(const variant of ['immediate','retestReaction']){
   const projected=createM1FvgEntryProjection()({candles:rows,evaluatedAt,direction,variant});
   for(const fvg of projected.candidates)expect(projected.results.get(fvg.candleTime))
    .toEqual(m1FvgEntryPrefill({candles:rows,fvg,evaluatedAt,variant}));
  }
 }
});
it('reuses immutable projections across fresh arrays, repeated interactions and mode/color switches; corrections and rewind invalidate them',()=>{
 const project=createM1FvgEntryProjection(),input={candles:native,evaluatedAt:at('08:35'),direction:'short',variant:'retestReaction'};
 const first=project(input),visits=first.stateVisits;
 for(let i=0;i<100;i++)expect(project({...input,candles:native.map(c=>({...c}))})).toBe(first);
 expect(first.stateVisits).toBe(visits);
 project({...input,variant:'immediate'});expect(project(input)).toBe(first);
 expect(project({...input,candles:native.map((c,i)=>i===20?{...c,high:c.high+100}:c)})).toBe(first);
 const corrected=project({...input,candles:native.map((c,i)=>i===18?{...c,high:c.high+.01}:c)});expect(corrected).not.toBe(first);
 const rewound=project({...input,evaluatedAt:at('08:34')});expect(rewound.confirmations).not.toContain(at('08:34'));
});
