import {describe,expect,it} from 'vitest';
import {dobTs11FromRow,lqSweepPoi} from '../src/dobLqSweepPoi.js';

// Ein TS1.1 zählt erst, wenn es bekannt ist (OB-Start + 10 min), nicht schon ab OB-Start: sonst zählt der Lauf Alarme, die live zu spät kämen.
const ob=Date.parse('2026-11-18T01:25:00Z')/1000;
const ts=dobTs11FromRow({id:1,direction:'long',ob_top:2000.5,ob_bottom:2000,ob_start_time:new Date(ob*1000).toISOString(),
 ls_price:1999,ls_touched_time:new Date((ob-300)*1000).toISOString(),ls_timeframe:'5M',ob_zones:null});
const pair=recognizedAt=>({direction:'long',recognizedAt,firstOrderBlock:{startTime:ob,top:2000.5,bottom:1999.8},secondOrderBlock:{top:2003,bottom:2002}});
const poi=recognizedAt=>lqSweepPoi({instrument:'XAUUSD',poiOptions:{match:'edge'},tradeSetups:[ts]})(pair(recognizedAt));

it('knownAt = OB-Start + 600',()=>expect(ts.knownAt).toBe(ob+600));
it.each([ob,ob+300,ob+599])('DOB erkannt vor Bekanntwerden (%i) → kein POI',at=>{
 expect(poi(at)).toEqual({poi:null,reason:'noPoi'});
});
it.each([ob+600,ob+3600])('DOB erkannt ab Bekanntwerden (%i) → POI',at=>{
 expect(poi(at).poi).toMatchObject({kind:'ts11',tradeSetupId:1,match:'edge'});
});

describe('LS des LQ-Sweep-POI = bestandene TS1.1-Quelle',()=>{
 const row={id:46127,direction:'short',ob_top:4133.12,ob_bottom:4125.12,ob_start_time:'2026-10-08T08:35:00Z',ls_price:4130.02,
  ls_pivot_time:'2026-10-08T07:20:00Z',ls_touched_time:'2026-10-08T08:15:00Z',ls_timeframe:null};
 it('übernimmt den Witness des Urteils',()=>{
  const witness={price:4131.38,pivotTime:1791438600,touchedTime:1791447900,timeframe:'5M',sourceKind:'orderBlock'};
  expect(dobTs11FromRow(row,{status:'passed',witness})).toMatchObject({lsPrice:4131.38,lsPivotTime:1791438600,lsTouchedTime:1791447900,
   lsTimeframe:'5M',lsSourceKind:'orderBlock'});
 });
 it('ohne Witness (Array.map-Index, altes Urteil) bleibt die Primär-LS',()=>{
  expect(dobTs11FromRow(row,0)).toMatchObject({lsPrice:4130.02,lsTouchedTime:Date.parse(row.ls_touched_time)/1000});
 });
});
