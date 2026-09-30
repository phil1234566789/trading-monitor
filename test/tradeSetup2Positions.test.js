import {expect,it} from 'vitest';
import {tradeSetup2Positions} from '../src/tradeSetup2Positions.js';
const row={instrument:'GBPUSD',direction:'short',variant:'wide',entryId:'x',runId:'r',entryTime:60,entryPrice:2,
  exitTime:180,exitRecognizedAt:240,exitPrice:1,pnlUsd:500,status:'closed',t1Time:120,t1RecognizedAt:180,t1Price:1.5};
const view=asOf=>tradeSetup2Positions([row],{instrument:'GBPUSD',variant:'wide',asOf,candles:[{time:120,close:1.8}]});
it('does not show future exits, target touches or profit in replay',()=>{
  expect(view(59)).toEqual([]);
  expect(view(150)[0]).toMatchObject({isOpen:true,exitTime:120,exitPrice:1.8,t1Time:null,pnlUsd:null});
  expect(view(180)[0].t1Time).toBe(120);
  expect(view(240)[0]).toMatchObject({isOpen:false,exitPrice:1,pnlUsd:500});
});
it('limits each direction and filters instrument and alternative stop scenario',()=>{
  const rows=[row,{...row,entryId:'new',entryTime:80},{...row,entryId:'narrow',variant:'narrow'},{...row,instrument:'EURUSD'}];
  expect(tradeSetup2Positions(rows,{instrument:'GBPUSD',variant:'wide',asOf:240,historyCount:1})[0].snapshotId).toBe('new');
  expect(tradeSetup2Positions(rows,{instrument:'GBPUSD',variant:'wide',asOf:240,historyCount:0})).toEqual([]);
});
it('does not invent an exit or ongoing position after ambiguous outcomes',()=>{
  const uncertain={...row,status:'ambiguous',ambiguityRecognizedAt:180,exitTime:null,exitRecognizedAt:null};
  const options={instrument:'GBPUSD',variant:'wide',asOf:240,candles:[{time:180,close:1.7}]};
  expect(tradeSetup2Positions([uncertain],options)[0]).toMatchObject({status:'ambiguous',isOpen:false,exitTime:null,exitPrice:null,pnlUsd:null});
  expect(tradeSetup2Positions([{...row,status:'notExecutable'}],options)).toEqual([]);
});
