import {it,expect} from 'vitest';
import {mmtEquityPlot} from '../src/mmtEquityPlot.js';
const accounts=[{id:'b',name:'Konto B'},{id:'a',name:'Konto A'}];
const trade=(id,account_id,closed_at,net,commission=-2)=>({id,account_id,closed_at,net,commission});
it('accumulates each account independently on one shared time and value scale',()=>{
 const rows=[trade('3','a',3000,-5),trade('2','b',2000,30),trade('1','a',1000,10)];
 const plot=mmtEquityPlot(rows,accounts,600);
 expect(plot.series.map(s=>[s.id,s.name,s.colorIndex])).toEqual([['b','Konto B',0],['a','Konto A',1]]);
 expect(plot.series[0].values).toEqual([{x:0,y:0,c:0},{x:2000,y:30,c:-2},{x:3000,y:30,c:-2}]);
 expect(plot.series[1].values.at(-1)).toEqual({x:3000,y:5,c:-4});
 expect(plot.series.every(s=>s.path.startsWith('M65.00,')&&!s.path.includes('NaN'))).toBe(true);
 expect(rows.map(t=>t.id)).toEqual(['3','2','1']);
});
it('keeps account identity and color when filtering to one account, including CSV rows and tied closes',()=>{
 const plot=mmtEquityPlot([trade('csv:x','a',1000,0),trade('native:y','a',1000,-12)],accounts,320);
 expect(plot.series).toHaveLength(1);expect(plot.series[0]).toMatchObject({id:'a',colorIndex:1});
 expect(plot.series[0].values.at(-1)).toEqual({x:1000,y:-12,c:-4});
 expect(plot.xs).toHaveLength(2);expect(plot.series[0].path).not.toMatch(/NaN|Infinity/);
 expect(mmtEquityPlot([],accounts,320)).toBeNull();
});
