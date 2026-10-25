import {it,expect} from 'vitest';
import {createSSRApp} from 'vue';
import {renderToString} from 'vue/server-renderer';
import {runFunnel,rangeEntryCrossTable} from '../src/simulationRunComparison.js';
import {rangeEntryIds} from '../src/simulationRangeCoverage.js';
import SimulationRunQuality from '../src/components/SimulationRunQuality.vue';
const group=(id,stage,ids=[],outcome='unknown')=>({key:id,stage,wasValidated:stage==='validated',snapshot:{setupKey:id},outcome:{status:outcome},entries:ids.map(entry=>({id:entry,runId:'live',knownAt:1000,entry:{id:entry,confirmedAt:600}}))});
it('accounts for every DR and unique entry even without a saved stage or SL result',()=>{
 const groups=[group('a','validated',['a1'],'t2'),group('b','confirmed'),group('c','unknown',['c1','c2']),group('d','legacy',['d1'])],funnel=runFunnel(groups,[]);
 expect(funnel.entries).toBe(4);expect(funnel.withEntry).toBe(3);expect(funnel.unknown).toMatchObject({confirmed:2,validated:2,target1:2});
 for(const variant of ['wide','narrow']){
  const rows=rangeEntryCrossTable(groups,[],variant);
  expect(rows.reduce((sum,row)=>sum+row.total,0)).toBe(groups.length);
  expect(rows.reduce((sum,row)=>sum+row.entries,0)).toBe(rangeEntryIds(groups).size);
  for(const row of rows)expect(row.without+row.win+row.loss+row.pending).toBe(row.total);
  expect(rows.find(row=>row.key==='stageUnknown')).toMatchObject({total:2,entries:3,pending:2});
  expect(rows.find(row=>row.key==='notValidated')).toMatchObject({total:1,without:1});
 }
});
it('shows eleven stored entries across six unknown DRs without a false zero-only tree',async()=>{
 const groups=[2,2,2,2,2,1].map((count,i)=>group('dr'+i,'unknown',Array.from({length:count},(_,j)=>`entry${i}:${j}`))),data={groups,results:[]};
 const html=await renderToString(createSSRApp(SimulationRunQuality,{current:data,previous:{groups:[],results:[]},compare:false}));
 expect(runFunnel(groups,[])).toMatchObject({entries:11,withEntry:6,target2Unknown:6});
 expect(html).toContain('0 belegt · 6 unbekannt');expect(html).toContain('11 Entries');expect(html).toContain('DR-Stufe nicht gespeichert');
 expect(html).toMatch(/aria-label="Gewählter Lauf · DR-Stufe nicht gespeichert".*?>6 DRs<\/b>.*?11 Entries.*?unvollständig.*?>6 DRs<\/dd>/s);
 expect(html).toContain('6 DRs mit originalem Bestätigungszeitbeleg');
});
