import {expect,it} from 'vitest';
import {tradeSetup2HistoryItems} from '../src/tradeSetup2HistoryItems.js';

const candidate=(id,knownAt=300,primary={})=>({id,runId:'r',instrument:'GBPUSD',direction:'short',knownAt,
  snapshot:{id,knownAt,checklist:{setup:{primary:{invalidation:2,reactionRecognizedAt:300,
    targetSelection:{status:'passed',selectedAt:300,target1:{price:1}},...primary}}}}});
const entry={entryId:'e',snapshotId:'e',setupKey:'s',runId:'r',instrument:'GBPUSD',direction:'short',
  variant:'wide',entryTime:600,entryPrice:1.8,status:'open'};
const options={instrument:'GBPUSD',variant:'wide',asOf:900,historyCount:5};
it('keeps both SL alternatives of one entry instead of overwriting their history keys',()=>{
  const rows=tradeSetup2HistoryItems([entry,{...entry,variant:'narrow'}],[candidate('s')],{...options,variant:'',historyCount:1});
  expect(rows.map(r=>r.variant)).toEqual(['wide','narrow']);
  expect(new Set(rows.map(r=>r.id)).size).toBe(2);
});
it('keeps both entries when the history limit admits only their one DR',()=>{
  const second={...entry,entryId:'second',snapshotId:'second',entryTime:700};
  const rows=tradeSetup2HistoryItems([entry,second],[candidate('s'),candidate('old',100)],{...options,historyCount:1});
  expect(rows.map(r=>r.snapshotId)).toEqual(['second','e']);
});
it('shows candidates with only confirmed saved bounds and no invented position',()=>{
  const [item]=tradeSetup2HistoryItems([], [candidate('s')],options);
  expect(item).toMatchObject({kind:'candidate',snapshotId:'s',isOpen:false});
  expect(item.entryPrice).toBeUndefined();
  expect(item.bounds.map(b=>b.price)).toEqual([2,1]);
  expect(tradeSetup2HistoryItems([],[candidate('x',300,{targetSelection:{status:'pending',target1:{price:1}}})],options)[0].bounds).toHaveLength(1);
});
it('replaces a candidate only once its entry is known and restores it on rewind',()=>{
  expect(tradeSetup2HistoryItems([entry],[candidate('s')],options).map(p=>p.snapshotId)).toEqual(['e']);
  expect(tradeSetup2HistoryItems([entry],[candidate('s')],{...options,asOf:599}).map(p=>p.snapshotId)).toEqual(['s']);
  expect(tradeSetup2HistoryItems([entry],[candidate('s')],{...options,asOf:299})).toEqual([]);
});
it('applies one shared limit per direction after setup deduplication',()=>{
  const items=tradeSetup2HistoryItems([entry],[candidate('s'),candidate('new',700),candidate('old',100)],{...options,historyCount:2});
  expect(items.map(p=>p.snapshotId)).toEqual(['new','e']);
});
it('labels historical lifecycle without showing future invalidation',()=>{
  const c=candidate('s',300,{validity:{state:'ended',reason:'invalidation',recognizedAt:600}});
  expect(tradeSetup2HistoryItems([],[c],options)[0].candidateStatus).toContain('Invalidation vor T1');
  expect(tradeSetup2HistoryItems([],[c],{...options,asOf:599})[0].candidateStatus).not.toContain('Invalidation vor T1');
});
it('labels the saved sweep time separately from snapshot ordering and visibility',()=>{
  const c=candidate('s',600,{recognizedAt:120,sweep:{level:{price:1.23456}}});
  const [item]=tradeSetup2HistoryItems([],[c,candidate('older',300,{recognizedAt:240})],{...options,historyCount:1});
  expect(item).toMatchObject({snapshotId:'s',sortTime:600,labelTime:120,timeLabel:'Sweep',sweepPrice:1.23456});
  expect(tradeSetup2HistoryItems([],[c],{...options,asOf:599})).toEqual([]);
  expect(tradeSetup2HistoryItems([entry],[],options)[0]).toMatchObject({labelTime:600,timeLabel:'Entry'});
});
it('uses an explicit snapshot label when the sweep recognition time is missing or later than the snapshot',()=>{
  for(const recognizedAt of [null,undefined,NaN,601]) {
    const [item]=tradeSetup2HistoryItems([],[candidate('s',600,{recognizedAt})],options);
    expect(item).toMatchObject({labelTime:600,timeLabel:'Stand'});
  }
});
