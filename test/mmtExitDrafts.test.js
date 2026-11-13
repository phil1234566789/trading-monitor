import {afterEach,describe,it,expect} from 'vitest';
import {setTargetDraft,removeTargetDraft,useTargetDraft,splitTargetDraft,changeTargetShare,moveTargetDraft,selectTargetDraft,targetDraftLines,stopEntryDraftLines,addStopDraft} from '../src/mmtTargetDrafts.js';

afterEach(()=>{removeTargetDraft('exit');removeTargetDraft('other');});
const position=()=>({symbol:'XAUUSD',entryPrice:2000,initialSl:null,basisSl:null,positionVolume:1,direction:'long',digits:2,
 targets:[{price:2020,volume:1}],stops:[],dirty:false,stopsDirty:false,selectedKind:null,selectedIndex:null,needsStop:true,canAddStop:true,
 stopPreviews:{risky:{price:1997.75,budget:{requested:250,available:225,cost_buffer:25}},full:{price:1995.75,budget:{requested:450,available:425,cost_buffer:25}}},
 quote:{minimum_volume:.01,volume_step:.01,loss_per_unit_long:1,profit_per_unit_long:1},currency:'USD',swap:0,
 costs:{entry_costs:-5,entry_volume:1,estimated_exit_costs_per_lot:0}});

describe('joint TP and SL drafts',()=>{
 it('adds the risk preview as an unsaved whole-position SL without changing targets or historical risk',()=>{
  setTargetDraft('exit',position());
  expect(stopEntryDraftLines('XAUUSD')).toHaveLength(1);
  expect(addStopDraft('exit','risky')).toBe(true);
  expect(useTargetDraft('exit').value).toMatchObject({stops:[{price:1997.75,percent:100,volume:''}],riskMode:'risky',stopsDirty:true,dirty:true,initialSl:null,basisSl:null,selectedKind:'stop',selectedIndex:0});
  expect(useTargetDraft('exit').value.targets).toEqual([{price:2020,volume:1}]);
  expect(stopEntryDraftLines('XAUUSD')).toEqual([]);
 });
 it('does not overwrite an existing stop or use an unavailable preview',()=>{
  setTargetDraft('exit',{...position(),canAddStop:false});expect(addStopDraft('exit','risky')).toBe(false);
  setTargetDraft('exit',{...position(),stopPreviews:{risky:{error:'risk_budget_exhausted'}}});expect(addStopDraft('exit','risky')).toBe(false);
  setTargetDraft('exit',position());expect(addStopDraft('exit','other')).toBe(false);
  expect(addStopDraft('exit','full')).toBe(true);expect(addStopDraft('exit','risky')).toBe(false);
  expect(useTargetDraft('exit').value.stops[0].price).toBe(1995.75);
 });
 it('splits and edits SL shares independently of TP shares, with one selected leg',()=>{
  setTargetDraft('exit',position());addStopDraft('exit','risky');
  expect(splitTargetDraft('exit',0,'stop')).toBe(1);
  expect(useTargetDraft('exit').value.stops.map(s=>s.percent)).toEqual([50,50]);
  expect(changeTargetShare('exit',0,75,'stop')).toBe(true);
  expect(useTargetDraft('exit').value.stops.map(s=>s.percent)).toEqual([75,25]);
  moveTargetDraft('exit',1,1996.123,'stop');
  expect(useTargetDraft('exit').value.stops[1].price).toBe(1996.12);
  selectTargetDraft('exit',0,'target');
  expect(targetDraftLines('XAUUSD').filter(l=>l.selected).map(l=>l.kind)).toEqual(['target']);
  expect(useTargetDraft('exit').value.targets).toEqual([{price:2020,volume:1}]);
 });
 it('keeps a separate five-line cap per leg and prevents cross-account selection',()=>{
  setTargetDraft('exit',position());setTargetDraft('other',position());addStopDraft('exit','risky');
  for(let n=0;n<10;n++)splitTargetDraft('exit',0,'stop');
  expect(useTargetDraft('exit').value.stops).toHaveLength(5);
  expect(useTargetDraft('exit').value.targets).toHaveLength(1);
  expect(useTargetDraft('other').value.stops).toHaveLength(0);
 });
 it('shows native net forecasts for rounded shares, using a provisional plan R without persisting it',()=>{
  setTargetDraft('exit',position());addStopDraft('exit','risky');splitTargetDraft('exit',0,'stop');
  const lines=targetDraftLines('XAUUSD'),stops=lines.filter(l=>l.kind==='stop');
  expect(stops.map(s=>s.forecast.estimatedNet)).toEqual([-115,-115]);
  expect(stops.map(s=>s.forecast.rr)).toEqual([-1,-1]);
  expect(lines.find(l=>l.kind==='target').forecast.rr).toBeCloseTo(20/2.25);
  expect(useTargetDraft('exit').value.basisSl).toBeNull();
 });
 it('retains a saved risk basis when stops move and never treats missing costs as zero',()=>{
  setTargetDraft('exit',{...position(),basisSl:1995,stops:[{price:1998,volume:1}],costs:null});
  moveTargetDraft('exit',0,1997,'stop');
  const stop=targetDraftLines('XAUUSD').find(l=>l.kind==='stop');
  expect(stop.forecast.rr).toBeCloseTo(-.6);expect(stop.forecast.estimatedNet).toBeNull();
  expect(useTargetDraft('exit').value.basisSl).toBe(1995);
 });
 it('assigns odd-lot SL dust visibly and blocks a split below native minimum volume',()=>{
  setTargetDraft('exit',{...position(),positionVolume:.03});addStopDraft('exit','risky');splitTargetDraft('exit',0,'stop');
  const stops=targetDraftLines('XAUUSD').filter(l=>l.kind==='stop');
  expect(stops.map(l=>Math.round(l.actualPercent*3)/100)).toEqual([1,2]);expect(stops.every(l=>l.roundedShare)).toBe(true);
  setTargetDraft('exit',{...position(),positionVolume:.01});addStopDraft('exit','risky');
  expect(splitTargetDraft('exit',0,'stop')).toBeNull();expect(useTargetDraft('exit').value.stops).toHaveLength(1);
 });
 it('does not invent initial loss risk from a break-even or profit-lock stop',()=>{
  setTargetDraft('exit',position());addStopDraft('exit','risky');
  moveTargetDraft('exit',0,2000,'stop');expect(targetDraftLines('XAUUSD').find(l=>l.kind==='stop').forecast.rr).toBeNull();
  moveTargetDraft('exit',0,2001,'stop');expect(targetDraftLines('XAUUSD').find(l=>l.kind==='stop').forecast.rr).toBeNull();
  moveTargetDraft('exit',0,1999,'stop');expect(targetDraftLines('XAUUSD').find(l=>l.kind==='stop').forecast.rr).toBe(-1);
 });
});


