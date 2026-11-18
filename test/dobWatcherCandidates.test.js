import {expect,it} from 'vitest';
import {dobWatcherCandidates} from '../src/dobWatcherCandidates.js';
import {DOB_GUARDRAILS_DEFAULT} from '../src/dobGuardrails.js';

// Kandidaten fürs DOB-Watcher-Panel: Status je Phase, eine Zeile je POI-Art und Paar, frühe Phasen und Vortage fehlen.
const at=Date.parse('2026-11-18T10:00:00Z')/1000;
const chart={firstOrderBlockStart:at-7200,secondOrderBlockStart:at-3600,firstOrderBlock:{top:20,bottom:18},secondOrderBlock:{top:19,bottom:17}};
const poi={timeframe:'H1',zone:{top:3890,bottom:3885},distanceAtr:0.8};
const s=(pairId,phase,extra={})=>({pairId,id:`${pairId}:a`,direction:'short',phase,phaseSince:at-600,entryTime:null,chart,poi,...extra});
const run=(setups,rejected=[],poiType='htf_ob')=>({poiType,result:{setups,rejected},guardrails:{...DOB_GUARDRAILS_DEFAULT,defaultTpR:3},blockStats:null});

it('mappt Phasen auf Status, unklar als läuft, frühe Phasen und Vortage fehlen',()=>{
 const rows=dobWatcherCandidates([run([
  s('p1','ob2Retest'),
  s('p2','entry',{entryTime:at-300,entryPrice:3880,stopPrice:3890}),
  s('p3','entry',{entryTime:at-3600,entryPrice:3880,stopPrice:3890}),
  s('p4','ambiguous',{entryTime:at-3600,entryPrice:3880,stopPrice:3890}),
  s('p5','win',{entryTime:at-5400,entryPrice:3880,stopPrice:3890,phaseSince:at-1200}),
  s('p6','ob1Hold'),
  s('p7','ob2Retest',{phaseSince:at-86400}),
 ])],at,'XAUUSD');
 expect(Object.fromEntries(rows.map(r=>[r.pairId,r.status]))).toEqual({p1:'retest',p2:'entry',p3:'running',p4:'running',p5:'win'});
 const entry=rows.find(r=>r.pairId==='p2');
 expect(entry).toMatchObject({instrument:'XAUUSD',poi:'H1-OB',direction:'short',time:at-300,chartAt:at-240});
 expect(entry.detail).toContain('TP 3R @ 3.850,00');
});

it('Sperre mit Grund, verworfen nur ohne tragende POI-Art, weiteste Phase gewinnt',()=>{
 const rows=dobWatcherCandidates([
  run([s('p1','ob2Retest'),s('p1','entry',{entryTime:at-300,entryPrice:3880,stopPrice:3890})],[s('p2','entry',{entryTime:at-300,entryPrice:3880,stopPrice:3890,reason:'counterDob'}),s('p3','ob2Retest',{reason:'noPoi'})]),
  run([],[s('p1','ob2Retest',{reason:'noPoi',poi:null}),s('p3','ob2Retest',{reason:'noPoi',poi:null})],'lq_sweep'),
 ],at,'XAUUSD');
 expect(rows.map(r=>`${r.poiType}:${r.pairId}:${r.status}`).sort()).toEqual(['htf_ob:p1:entry','htf_ob:p2:blocked','htf_ob:p3:dropped']);
 expect(rows.find(r=>r.pairId==='p2')).toMatchObject({blockLabel:'Gegen-DOB'});
 expect(rows.find(r=>r.pairId==='p3').detail).toContain('kein POI in Reichweite');
});
