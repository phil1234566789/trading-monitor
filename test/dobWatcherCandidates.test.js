import {expect,it} from 'vitest';
import {dobWatcherCandidates} from '../src/dobWatcherCandidates.js';
import {DOB_GUARDRAILS_DEFAULT} from '../src/dobGuardrails.js';

// Kandidaten fürs DOB-Watcher-Panel: Status je Phase, eine Zeile je POI-Art und Paar, frühe Phasen und Vortage fehlen.
const at=Date.parse('2026-11-18T10:00:00Z')/1000;
const chart={firstOrderBlockStart:at-7200,secondOrderBlockStart:at-3600,firstOrderBlock:{top:20,bottom:18},secondOrderBlock:{top:19,bottom:17}};
const poi={timeframe:'H1',zone:{top:3890,bottom:3885},distanceAtr:0.8};
// Jedes Paar bekommt sein eigenes OB2 (die Zeile gruppiert je OB2), außer der Test teilt es bewusst.
const s=(pairId,phase,extra={})=>({pairId,id:`${pairId}:a`,direction:'short',phase,phaseSince:at-600,entryTime:null,poi,
 chart:{...chart,secondOrderBlockStart:extra.ob2??at-3600-Number(pairId.slice(1))*300},...extra});
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
 expect(rows.find(r=>r.pairId==='p3').detail).toBe('nächste H1-Zone 0,8 ATR weg, erlaubt ≤ 1,5 ATR');
});

it('OB1-Partner mit gleichem OB2 ergeben eine Zeile',()=>{
 const rows=dobWatcherCandidates([run([],[s('p1','ob2Retest',{reason:'noPoi',ob2:at-3600}),s('p2','ob2Retest',{reason:'noPoi',ob2:at-3600})])],at,'XAUUSD');
 expect(rows).toHaveLength(1);
});

it('verworfen nennt den konkreten Grund: HTF ohne Retest, LQ-Sweep mit nächstem TS1.1',()=>{
 const rows=dobWatcherCandidates([
  run([],[s('p1','ob2Retest',{reason:'noPoi',poi:null})]),
  run([],[s('p2','ob2Retest',{reason:'noPoi',poi:{kind:'ts11',tradeSetupId:42,match:'adjacent',gapUsd:0.00012}})],'lq_sweep'),
 ],at,'GBPUSD');
 expect(rows.find(r=>r.pairId==='p1').detail).toBe('keine retestete H1/H4-Zone (Zone nicht retestet)');
 expect(rows.find(r=>r.pairId==='p2').detail).toBe('kein TS1.1-OB mit gleicher Kante · nächstes TS1.1 #42 · 1,2 Pips daneben');
 const gbp=dobWatcherCandidates([run([],[s('p3','ob2Retest',{reason:'noPoi',poi:{...poi,distanceAtr:5.7}})])],at,'GBPUSD');
 expect(gbp[0].detail).toBe('nächste H1-Zone 5,7 ATR weg, erlaubt ≤ 1,0 ATR');
});
