import {describe,expect,it} from 'vitest';
import {CHART_DEBUGGER_CASES,loadCaseFixture,evaluateCase,caseSteps} from '../src/chartDebuggerCases.js';
import {dobPairGraph,dobChangeTimes} from '../src/dobPairGraph.js';

const run=async(id,at)=>{
 const c=CHART_DEBUGGER_CASES.find(x=>x.id===id),fixture=await loadCaseFixture(c),evaluatedAt=at??caseSteps(c,fixture).through;
 const result=evaluateCase(c,fixture,evaluatedAt);
 return {result,graph:dobPairGraph({dir:c.dir,...result,evaluatedAt})};
};
const byNode=g=>Object.fromEntries(g.nodes.map(n=>[n.id,n]));

describe('DOB-Ebene des Chart-Debuggers',()=>{
 it('497/498: alle Gates bis auf den OB1-Hold bestehen, Ergebnis kein DOB',async()=>{
  const {graph}=await run('497'),n=byNode(graph);
  expect(Object.fromEntries(graph.nodes.map(x=>[x.id,x.status]))).toEqual({roles:'visited',ob1:'visited',ob2:'visited',geometry:'visited',
   gap:'visited',day:'visited',hold:'rejected',stop:'not-visited',routes:'not-visited',window:'not-visited',outcome:'not-visited',result:'rejected'});
  expect(n.ob1).toMatchObject({gate:'first',sub:'true · 07:58'});
  expect(n.ob2).toMatchObject({gate:'second',sub:'true · 09:15'});
  expect(n.geometry.sub).toBe('Oberkante und Unterkante tiefer: ja\nOB1-Reaktion 07:58 ≤ OB2-Kontakt 09:04');
  expect(n.hold.sub).toBe('gebrochen 08:00 @ 4.192,69');
  expect(n.result.sub).toBe('kein DOB · OB1-Hold: Retest-Extrem hält bis OB2-Reaktion?');
 });
 it('497 vor dem Bruch: Hold hält bisher, Ergebnis offen',async()=>{
  const n=byNode((await run('497',1791784800)).graph);
  expect(n.hold).toMatchObject({status:'unknown',sub:'hält bisher · wartet auf OB2-Reaktion'});
  expect(n.result.status).toBe('unknown');
 });
 it('P14: erkanntes Paar mit Entry a, SL am Retest-Extrem und 2R-Ziel',async()=>{
  const {result,graph}=await run('P14'),n=byNode(graph);
  expect(n.result).toMatchObject({status:'visited'});
  expect(n.stop.sub).toContain('Retest-Extrem');
  expect(n.routes.sub).toMatch(/^a: Entry \d\d:\d\d @ /);
  expect(n.window.status).toBe('visited');
  expect(n.outcome.sub).toMatch(/^a: Ziel \S+ · /);
  expect(dobChangeTimes(result)).toContain(result.pair.recognizedAt);
 });
 it('every two-OB debugger case builds a DOB graph',async()=>{
  for(const c of CHART_DEBUGGER_CASES.filter(x=>x.orderBlocks.length===2)){
   const {graph}=await run(c.id);
   expect(graph.nodes.at(-1).id,c.id).toBe('result');
  }
 });
});
