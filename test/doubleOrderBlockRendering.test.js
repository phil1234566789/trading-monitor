import {beforeEach,expect,it,vi} from 'vitest';
import {renderDoubleOrderBlocks,hitDoubleOrderBlock,doubleOrderBlockDetails} from '../src/doubleOrderBlockRendering.js';
vi.mock('../src/chartColors.js',()=>({cssColor:key=>key,cssColorScaled:(key,alpha)=>`${key}:${alpha}`}));
vi.mock('../src/orderBlocks.js',()=>({obZoneNaturalKey:(tf,dir,time)=>`${tf}|${dir}|${time}`,OrderBlockPrimitive:class {constructor(zone,options){this.zone=zone;this.options=options;this.distance=Infinity;}distanceTo(){return this.distance;}}}));
const pair={id:'pair',instrument:'XAUUSD',direction:'long',recognizedAt:1000,firstOrderBlock:{dir:1,startTime:100,top:12,bottom:10},secondOrderBlock:{dir:1,startTime:400,top:14,bottom:12},
  entries:{a:{status:'ready',entryTime:1000,outcome:{status:'loss',recognizedAt:1500}},b:{status:'ready',entryTime:1100,outcome:{status:'success',recognizedAt:1600}}}};
let series;
beforeEach(()=>{series={attachPrimitive:vi.fn()};});
it('uses the detector display contract without leaking future loss or hiding separate a/b outcomes',()=>{
  expect(renderDoubleOrderBlocks(series,[pair],[],999)).toEqual([]);
  const atEntry=renderDoubleOrderBlocks(series,[pair],[],1000);
  expect(atEntry).toHaveLength(2);expect(atEntry.map(i=>i.primitive.options.label)).toEqual(['DOB1 L','DOB2 L']);
  expect(doubleOrderBlockDetails(pair,1000)).toContain('a: offen · b: wartet');
  const after=renderDoubleOrderBlocks(series,[pair],[],1700);
  expect(after[0].primitive.options.borderColor).toBe('dobConfirmed');
  expect(doubleOrderBlockDetails(pair,1700)).toContain('a: Loss · b: 2R');
});
it('draws shared OB zones once without repeating a/b text on the candles',()=>{
  const another={...pair,id:'other',firstOrderBlock:{dir:1,startTime:200,top:13,bottom:11}};
  const items=renderDoubleOrderBlocks(series,[pair,another],[],1700);
  expect(items).toHaveLength(3);expect(items.map(i=>i.primitive.options.label)).toEqual(['DOB1 L','DOB2 L','DOB1 L']);
  expect(series.attachPrimitive).toHaveBeenCalledTimes(3);
});
it('renders red only according to the shared detector and hits either of the two actual boxes',()=>{
  const lost={...pair,entries:{a:pair.entries.a,b:{status:'pending'}}};
  const items=renderDoubleOrderBlocks(series,[lost],[],1500);
  expect(items[0].primitive.options.borderColor).toBe('dobLoss');
  expect(hitDoubleOrderBlock(items,1,1)).toBe(null);
  items[0].primitive.distance=0;expect(hitDoubleOrderBlock(items,1,1)).toBe(lost);
  items[0].primitive.distance=Infinity;items[1].primitive.distance=0;expect(hitDoubleOrderBlock(items,1,1)).toBe(lost);
});

it('shows both shared-zone roles by default and the exact selected pair role on hover',()=>{
 const next={...pair,id:'next',firstOrderBlock:pair.secondOrderBlock,secondOrderBlock:{dir:1,startTime:700,top:16,bottom:14}};
 const labels=options=>renderDoubleOrderBlocks(series,[pair,next],[],1700,options).map(i=>i.primitive.options.label);
 expect(labels({})).toEqual(['DOB1 L','DOB1/2 L','DOB2 L']);
 expect(labels({selectedPairId:pair.id})).toEqual(['DOB1 L','DOB2 L','DOB2 L']);
 expect(labels({selectedPairId:next.id})).toEqual(['DOB1 L','DOB1 L','DOB2 L']);
});

it('uses independent DOB tokens for fill, outline, labels, pair hover and pins',()=>{
 const items=renderDoubleOrderBlocks(series,[pair],[],1700,{selectedPairId:pair.id,pinnedPairIds:new Set([pair.id])});
 for(const {primitive} of items)expect(primitive.options).toMatchObject({fillColor:'dobConfirmed:0.12',borderColor:'dobConfirmed',textColor:'dobConfirmed',hoverColor:'dobHover',pinColor:'dobPin',isSelectedPin:true,inPinContext:true});
});
