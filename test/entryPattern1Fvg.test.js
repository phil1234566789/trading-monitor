import { it, expect } from 'vitest';
import { entryPattern1FvgAt } from '../src/entryPattern1Progress.js';
import { detectOrderBlocks } from '../src/orderBlockDetection.js';

const rows=[
  {time:0,high:1.3485,low:1.3483,close:1.3484},
  {time:60,high:1.3484,low:1.34828,close:1.34832},
  {time:120,high:1.34836,low:1.34814,close:1.34815},
  {time:180,high:1.34820,low:1.34806,close:1.34815},
];
it('accepts a sub-pip entry FVG without changing the general OB minimum',()=>{
  expect(entryPattern1FvgAt(rows,'short')).toMatchObject({candleTime:120,recognizedAt:240});
  expect(entryPattern1FvgAt(rows,'short').gap).toBeCloseTo(0.00008,10);
  expect(detectOrderBlocks(rows,'1m')).toEqual([]);
  expect(entryPattern1FvgAt(rows.slice(0,3),'short')).toBeNull();
});
it('rejects zero gaps, ignored candles and gaps in time; mirrors long',()=>{
  expect(entryPattern1FvgAt(rows.map((c,i)=>i===3?{...c,high:1.34828}:c),'short')).toBeNull();
  expect(entryPattern1FvgAt(rows.map((c,i)=>i===1?{...c,ignored:true}:c),'short')).toBeNull();
  expect(entryPattern1FvgAt(rows.map((c,i)=>i===3?{...c,time:240}:c),'short')).toBeNull();
  const mirrored=rows.map(c=>({...c,high:3-c.low,low:3-c.high,close:3-c.close}));
  expect(entryPattern1FvgAt(mirrored,'long')).toMatchObject({direction:'long',recognizedAt:240});
});
