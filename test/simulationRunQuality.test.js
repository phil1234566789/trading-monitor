import { it, expect } from 'vitest';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import SimulationRunQuality from '../src/components/SimulationRunQuality.vue';
import { rangeEntryCrossTable, filterReviewGroups, groupResults } from '../src/simulationRunComparison.js';

const group=(id,status='t2',entry=false)=>({key:id,stage:'validated',wasValidated:true,
  snapshot:{setupKey:id},outcome:{status,target2:3},entries:entry?[{id,runId:'new'}]:[]});
const groups=Array.from({length:12},(_,i)=>group(`dr${i}`,'t2',i<3));
const results=groups.flatMap((g,i)=>g.entries.flatMap(e=>['wide','narrow'].map(variant=>({
  runId:e.runId,snapshotId:e.id,variant,status:'closed',outcome:'t2',
  netPnlUsd:variant==='narrow' && i===2?-100:100,pnlUsd:100,rMultiple:1
}))));
const render=(current,previous={groups:[],results:[]},compare=false)=>renderToString(createSSRApp(SimulationRunQuality,{current,previous,compare}));
const branch=(html,label)=>html.match(new RegExp(`<article[^>]*aria-label="${label}"[^>]*>(.*?)</article>`,'s'))?.[1];

it('integrates the twelve T2 DRs once, with both stop branches and no cross-tables',async()=>{
  const html=await render({groups,results});
  const t2=branch(html,'Gewählter Lauf · T1 vor Invalidation, dann T2');
  expect(t2).toContain('>12</b>');
  expect(t2.match(/Ohne Entry/g)).toHaveLength(1);
  expect(t2).toContain('>9</b>');
  expect(t2).toMatch(/aria-label="Weiter SL".*?Mind. ein Gewinn.*?>3<\/dd>.*?Nur Verluste.*?>0<\/dd>/s);
  expect(t2).toMatch(/aria-label="Enger SL".*?Mind. ein Gewinn.*?>2<\/dd>.*?Nur Verluste.*?>1<\/dd>/s);
  expect(html).not.toContain('<table');
  for(const variant of ['wide','narrow']) for(const row of rangeEntryCrossTable(groups,results,variant))
    expect(row.without+row.win+row.loss+row.pending).toBe(row.total);
});

it('keeps filtered sums, incomplete outcomes and old-run comparison separate',async()=>{
  const currentGroups=[...groups,group('unknown','unknown'),group('pending','open',true)];
  const filtered=filterReviewGroups(currentGroups,{outcome:'t2'});
  expect(rangeEntryCrossTable(filtered,groupResults(filtered,results),'wide')[0].total).toBe(12);
  const html=await render({groups:currentGroups,results},{groups:[group('old','unknown')],results:[]},true);
  expect(branch(html,'Alt · DR-Ausgang nicht belegt')).toMatch(/>1<\/b>.*?Ohne Entry.*?>1<\/b>/s);
  expect(branch(html,'Neu · Offen oder uneindeutig')).toMatch(/Offen \/ uneindeutig \/ unvollständig.*?>1<\/dd>/s);
  expect(branch(html,'Neu · T1 vor Invalidation, dann T2')).toContain('>12</b>');
});
