import { describe, it, expect, vi } from 'vitest';
import { createSimulationRepository, simulationAsOf } from '../src/tradeSetupSimulationRepository.js';
import {encodeSnapshotStructures} from '../src/tradeSetupSnapshotStorage.js';

describe('simulation history repository', () => {
  it('reads sibling entries in one bounded request scoped to the run and DR',async()=>{
    const query={select:()=>query,eq:vi.fn(()=>query),order:vi.fn(()=>query),limit:vi.fn(async()=>({data:[
      {id:'a',snapshot:{id:'a',setupKey:'dr'},outcomes:[{variant:'wide'}]},
      {id:'b',snapshot:{id:'b',setupKey:'dr'},outcomes:[{variant:'wide'}]}]}))};
    const rows=await createSimulationRepository({from:()=>query}).getRangeEntries('r','dr');
    expect(query.eq.mock.calls).toEqual([['run_id','r'],['snapshot->>setupKey','dr']]);
    expect(query.limit).toHaveBeenCalledExactlyOnceWith(1000);
    expect(rows.map(r=>r.snapshot.id)).toEqual(['a','b']);
  });
  it('loads all outcome pages without a run filter and preserves identical entry IDs from separate runs', async () => {
    const filters = [], offsets = [];
    const data = ['first', 'second'].map(run_id => ({ id: 'same-entry', run_id, instrument: 'GBPUSD', direction: 'short', outcomes: [{ variant: 'wide', entryTime: 300 }] }));
    const query = { select: () => query, order: () => query, eq: (k,v) => { filters.push([k,v]); return query; },
      range: async offset => { offsets.push(offset); return { data: offset < data.length ? [data[offset]] : [] }; } };
    const rows = await createSimulationRepository({ from: () => query }).listResults({ instrument: 'GBPUSD' });
    expect(rows.map(row => row.runId)).toEqual(['first', 'second']);
    expect(offsets).toEqual([0,1,2]);
    expect(filters).toEqual([['instrument','GBPUSD'],['instrument','GBPUSD'],['instrument','GBPUSD']]);
  });
  it('reads all runs when the review filter is empty and retains their origin', async () => {
    const eq = vi.fn();
    const db = { from: table => {
      const query = { select: () => query, order: () => query, eq,
        range: async offset => ({ data: offset ? [] : [{ id: 'same', run_id: table }] }) };
      return query;
    } };
    const rows = await createSimulationRepository(db).listReviewSnapshots('');
    expect(eq).not.toHaveBeenCalled();
    expect(new Set(rows.map(row => row.runId)).size).toBe(2);
  });
  it('paginates review evidence without directly requesting duplicate chart trees', async () => {
    const calls = [];
    const db = { from: table => {
      const query = { select: fields => { expect(fields).not.toContain('checklist->structure'); expect(fields).not.toContain('->structureState'); expect(fields).toContain('rangeCourse:snapshot->rangeCourse'); return query; },
        eq: (key, value) => { expect([key, value]).toEqual(['run_id', 'selected']); return query; }, order: () => query,
        range: async offset => { calls.push([table, offset]); return { data: offset < 2 ? [{ id: `${table}:${offset}`, knownAt: 300,
          checklistStatus: 'ready', evaluatedAt: 300, reaction: { status: 'pending' }, antiConfluences:{status:'passed'},
          confluences:{status:'passed',rules:[{id:'observation',status:'found',invalidates:false,evidence:[{recognizedAt:300}]}]},
          rangeCourse: { validatedAt: 300, lifecycle: { evaluatedAt: 1800 } } }] : [] }; } };
      return query;
    } };
    const rows = await createSimulationRepository(db).listReviewSnapshots('selected');
    expect(rows).toHaveLength(4);
    expect(rows[0].checklist.checks.reaction.status).toBe('pending');
    expect(rows[0].checklist.checks.antiConfluences).toMatchObject({status:'clear',rules:[{invalidates:true,status:'clear'}]});
    expect(rows[0].checklist.checks.confluences.rules).toEqual([{id:'observation',status:'found',invalidates:false,evidence:[{recognizedAt:300}]}]);
    expect(rows[0].rangeCourse).toEqual({ validatedAt: 300, lifecycle: { evaluatedAt: 1800 } });
    for (const table of ['trade_setup_simulation_setups', 'trade_setup_simulation_entries'])
      expect(calls.filter(call => call[0] === table).map(call => call[1])).toEqual([0, 1, 2]);
  });
  it('reads exactly one linked entry with its uncut outcomes and snapshot', async () => {
    const query={select:vi.fn(()=>query),eq:vi.fn(()=>query),maybeSingle:vi.fn(async()=>({data:{id:'entry',
      instrument:'GBPUSD',direction:'short',snapshot:{id:'entry',setupKey:'setup'},
      outcomes:[{variant:'wide',exitRecognizedAt:600,status:'closed'}]}}))};
    const result=await createSimulationRepository({from:()=>query}).getEntry('run','entry');
    expect(query.eq.mock.calls).toEqual([['run_id','run'],['id','entry']]);
    expect(query.maybeSingle).toHaveBeenCalledTimes(1);
    expect(result.results[0]).toMatchObject({runId:'run',snapshotId:'entry',setupKey:'setup',status:'closed',exitRecognizedAt:600});
  });
  it('keeps the setup identity when reading entry outcomes for candidate deduplication', async () => {
    const query={select:()=>query,eq:()=>query,order:()=>query,
      range:async from=>({data:from?[]:[{id:'entry',setupKey:'candidate',instrument:'GBPUSD',direction:'short',
        outcomes:[{entryId:'entry',entryTime:300,variant:'wide',status:'open'}]}]})};
    const rows=await createSimulationRepository({from:()=>query}).listResults({runId:'run'});
    expect(rows[0]).toMatchObject({snapshotId:'entry',setupKey:'candidate',runId:'run'});
  });
  it('hides later exit and T1 facts from historical views', () => {
    const row = { entryTime: 120, evaluatedAt: 600, status: 'closed', outcome: 't2',
      t1Time: 180, t1RecognizedAt: 240, t1PnlUsd: 400, exitTime: 300, exitRecognizedAt: 360,
      pnlUsd: 1200, realizedPnlUsd: 1200, rMultiple: 2.5 };
    expect(simulationAsOf(row, 119)).toBeNull();
    expect(simulationAsOf(row, 180)).toMatchObject({ status: 'open', t1Time: null, t1PnlUsd: 0, realizedPnlUsd: 0, pnlUsd: null });
    expect(simulationAsOf(row, 240)).toMatchObject({ status: 'open', realizedPnlUsd: 400, pnlUsd: null });
    expect(simulationAsOf(row, 360)).toMatchObject({ status: 'closed', pnlUsd: 1200 });
  });
  it('dates ambiguity at its first evidence, independently of the run horizon', () => {
    const row = { entryTime: 120, evaluatedAt: 600, status: 'ambiguous', reason: 'sameCandle', ambiguityRecognizedAt: 240 };
    expect(simulationAsOf(row, 239)).toMatchObject({ status: 'open', reason: null, ambiguityRecognizedAt: null });
    expect(simulationAsOf(row, 240)).toMatchObject({ status: 'ambiguous', reason: 'sameCandle', ambiguityRecognizedAt: 240 });
    expect(simulationAsOf(row, 300).status).toBe('ambiguous');
  });
  it('continues pagination after a short server-capped page', async () => {
    const offsets = [];
    const query = { select: () => query, order: () => query,
      range: async start => { offsets.push(start); return { data: start < 4 ? [{ run: { id: start } }, { run: { id: start + 1 } }] : [], error: null }; } };
    const rows = await createSimulationRepository({ from: () => query }).listRuns();
    expect(rows.map(r => r.id)).toEqual([0, 1, 2, 3]);
    expect(offsets).toEqual([0, 2, 4]);
  });
  it('batches writes and propagates a failure', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: new Error('failed') });
    await expect(createSimulationRepository({ rpc }).saveEntries('run', Array.from({ length: 101 }, () => ({})))).rejects.toThrow('failed');
    expect(rpc.mock.calls[0][1].records).toHaveLength(100);
    expect(rpc.mock.calls[1][1].records).toHaveLength(1);
  });
  it('roundtrips compact structures through candidate and entry persistence',async()=>{
    const state={trend:'uptrend',history:Array.from({length:500},(_,i)=>({time:i,price:1.35}))};
    const original={id:'entry',checklist:{structure:state,checks:{m5Trend:{structureState:state}}}};
    let stored;
    const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:{snapshot:stored,outcomes:[],id:'entry'}})};
    const repository=createSimulationRepository({rpc:async(name,args)=>{stored=args.records[0].snapshot??args.records[0];return {error:null};},from:()=>query},{compactStructures:true});
    await repository.saveSetups('run',[original]);
    expect(JSON.stringify(stored).length).toBeLessThan(JSON.stringify(original).length*.6);
    expect(await repository.getSetupSnapshot('run','entry')).toEqual(original);
    await repository.saveEntries('run',[{snapshot:original,outcomes:[]}]);
    expect(await repository.getSnapshot('run','entry')).toEqual(original);
    expect((await repository.getEntry('run','entry')).snapshot).toEqual(original);
  });
  it('restores shared structures in the projected review primary',async()=>{
    const state={trend:'downtrend',history:Array.from({length:500},(_,i)=>({time:i,price:1.35}))};
    const source={checklist:{structure:state,setup:{primary:{checks:{m5Trend:{structureState:state}}}}}};
    const stored=encodeSnapshotStructures(source);
    const db={from:()=>{const query={select:()=>query,eq:()=>query,order:()=>query,range:async from=>({data:from?[]:[{primary:stored.checklist.setup.primary,structureStorage:stored.structureStorage}]})};return query;}};
    const rows=await createSimulationRepository(db).listReviewSnapshots('run');
    expect(rows[0].checklist.setup.primary).toEqual(source.checklist.setup.primary);
  });
  it('keeps raw snapshot writes unchanged unless compact storage is explicitly selected',async()=>{
    const state={history:Array.from({length:500},(_,i)=>({time:i,price:1.35}))};
    const source={checklist:{structure:state,checks:{m5Trend:{structureState:state}}}};
    const rpc=vi.fn(async()=>({error:null}));
    const repository=createSimulationRepository({rpc});
    await repository.saveSetups('legacy',[source]);
    await repository.saveEntries('legacy',[{snapshot:source,outcomes:[]}]);
    expect(rpc.mock.calls[0][1].records[0]).toBe(source);
    expect(rpc.mock.calls[1][1].records[0].snapshot).toBe(source);
  });
  it('loads all historical review evidence when large JSON pages exceed the server time budget',async()=>{
    const data=Array.from({length:13},(_,id)=>({id:`setup:${id}`,knownAt:id}));
    const db={from:()=>{const query={select:()=>query,eq:()=>query,order:()=>query,range:async(from,to)=>
      to-from+1>10?{error:new Error('canceling statement due to statement timeout')}:{data:data.slice(from,Math.min(to+1,from+3))}};return query;}};
    const rows=await createSimulationRepository(db).listReviewSnapshots('historical');
    expect(rows).toHaveLength(26);
    expect(rows.slice(0,13).map(row=>row.id)).toEqual(data.map(row=>row.id));
  });
  it('retains the countertrend model and C/D observations for the review checklist',async()=>{
    const row={model:'countertrend',entryModel:'countertrend-entry-model-1-v1',ruleVersion:'countertrend-abcdef-v1',
      m5Trend:{status:'passed',trend:'uptrend',m1Anchor:{recognizedAt:300}},outerM5Trend:{status:'passed',trend:'downtrend'}};
    const db={from:()=>{const query={select:()=>query,order:()=>query,eq:()=>query,range:async offset=>({data:offset?[]:[row]})};return query;}};
    const snapshots=await createSimulationRepository(db).listReviewSnapshots('countertrend');
    expect(snapshots[0].checklist).toMatchObject({model:row.model,entryModel:row.entryModel,ruleVersion:row.ruleVersion,
      checks:{m5Trend:row.m5Trend,outerM5Trend:row.outerM5Trend}});
  });
});
