import {expect,it} from 'vitest';
import {dobWatcherCandidates} from '../src/dobWatcherCandidates.js';
import {DOB_GUARDRAILS_DEFAULT} from '../src/dobGuardrails.js';

// Kandidaten fürs DOB-Watcher-Panel: Status je Phase, eine Zeile je POI-Art und Paar, frühe Phasen und Vortage fehlen.
const at=Date.parse('2026-11-18T10:00:00Z')/1000;
const chart={firstOrderBlockStart:at-7200,secondOrderBlockStart:at-3600,firstOrderBlock:{top:20,bottom:18},secondOrderBlock:{top:19,bottom:17}};
const poi={timeframe:'H1',zone:{top:3890,bottom:3885},distanceAtr:0.8};
// Jedes Paar bekommt sein eigenes OB2 (die Zeile gruppiert je OB2), außer der Test teilt es bewusst.
const s=(pairId,phase,extra={})=>({pairId,id:`${pairId}:a`,route:'a',direction:'short',phase,phaseSince:at-600,entryTime:null,poi,
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
 expect(entry.head).toBe('Entry a @ 3.880,00 um 10:55 · SL 3.890,00 · TP 3R 3.850,00');
});

it('Sperre mit Grund, verworfen nur ohne tragende POI-Art, weiteste Phase gewinnt',()=>{
 const rows=dobWatcherCandidates([
  run([s('p1','ob2Retest'),s('p1','entry',{entryTime:at-300,entryPrice:3880,stopPrice:3890})],[s('p2','entry',{entryTime:at-300,entryPrice:3880,stopPrice:3890,reason:'counterDob'}),s('p3','ob2Retest',{reason:'noPoi'})]),
  run([],[s('p1','ob2Retest',{reason:'noPoi',poi:null}),s('p3','ob2Retest',{reason:'noPoi',poi:null})],'lq_sweep'),
 ],at,'XAUUSD');
 expect(rows.map(r=>`${r.poiType}:${r.pairId}:${r.status}`).sort()).toEqual(['htf_ob:p1:entry','htf_ob:p2:blocked','htf_ob:p3:dropped']);
 expect(rows.find(r=>r.pairId==='p2')).toMatchObject({blockLabel:'Gegen-DOB'});
 expect(rows.find(r=>r.pairId==='p3').detail).toBe('verworfen, weil: nächste H1-Zone 0,8 ATR weg, erlaubt ≤ 1,5 ATR');
});

it('OB1-Partner mit gleichem OB2 ergeben eine Zeile',()=>{
 const rows=dobWatcherCandidates([run([],[s('p1','ob2Retest',{reason:'noPoi',ob2:at-3600}),s('p2','ob2Retest',{reason:'noPoi',ob2:at-3600})])],at,'XAUUSD');
 expect(rows).toHaveLength(1);
});

it('verworfen nennt den konkreten Grund: HTF ohne Retest, LQ-Sweep mit nächstem LS-Reaktion',()=>{
 const rows=dobWatcherCandidates([
  run([],[s('p1','ob2Retest',{reason:'noPoi',poi:null})]),
  run([],[s('p2','ob2Retest',{reason:'noPoi',poi:{kind:'ts11',tradeSetupId:42,match:'adjacent',gapUsd:0.00012}})],'lq_sweep'),
 ],at,'GBPUSD');
 expect(rows.find(r=>r.pairId==='p1').detail).toBe('verworfen, weil: keine retestete H1/H4-Zone (Zone nicht retestet)');
 expect(rows.find(r=>r.pairId==='p2').detail).toBe('verworfen, weil: kein LS-Reaktion-OB mit gleicher Kante · nächstes LS-Reaktion #42 · 1,2 Pips daneben');
 const gbp=dobWatcherCandidates([run([],[s('p3','ob2Retest',{reason:'noPoi',poi:{...poi,distanceAtr:5.7}})])],at,'GBPUSD');
 expect(gbp[0].detail).toBe('verworfen, weil: nächste H1-Zone 5,7 ATR weg, erlaubt ≤ 1,0 ATR');
});

it('Detail-Rahmen: OB1, OB2 und das LS-Reaktion-OB, wenn es nicht exakt OB1/OB2 ist',()=>{
 const ts={kind:'ts11',tradeSetupId:50740,zone:{top:21,bottom:19.5},zoneStartTime:at-7500,matchedEdge:'top',match:'edge',gapUsd:0,lsPrice:20.5};
 const [row]=dobWatcherCandidates([run([s('p1','ob2Retest',{poi:ts})],[],'lq_sweep')],at,'XAUUSD');
 expect(row.frames.map(f=>f.label)).toEqual(['OB1 · bärische M5 OB (09:00)','OB2 · bärische M5 OB (09:55)','LS-Reaktion-OB #50740 · LS 20,50 · bärische M5 OB (08:55)']);
 expect(row.frames[0].ob).toEqual({dir:-1,top:20,bottom:18,startTime:at-7200});
 const [same]=dobWatcherCandidates([run([s('p1','ob2Retest',{poi:{...ts,matchedEdge:'both'}})],[],'lq_sweep')],at,'XAUUSD');
 expect(same.frames).toHaveLength(2);
 expect(row.head).toBe('OB2 berührt um 10:50, Entry noch offen');
 expect(row.poiText).toBe('POI LQ-Sweep 20,50 · LS-Reaktion #50740 · Kante');
});

// Status-Satz vorn (Philip): jeder Status mit Grund, Preise im Instrument-Format, Zeiten in Berlin.
it('Status-Satz: läuft, Loss, Win, Win mit Teilprofit, gesperrt mit Statistik',()=>{
 const fx={entryTime:at-3600,entryPrice:1.32041,stopPrice:1.32057};
 const one=(setup,extra={})=>dobWatcherCandidates([{...run([setup]),...extra}],at,'GBPUSD')[0].head;
 expect(one(s('p1','entry',fx))).toBe('läuft seit 10:00 · SL 1,32057 · TP 3R 1,31993');
 expect(one(s('p1','loss',{...fx,outcome:{exitPrice:1.32057,recognizedAt:at-1800}}))).toBe('Loss: SL getroffen @ 1,32057 um 10:30');
 expect(one(s('p1','win',{...fx,tpRule:{tpR:2},outcome:{exitPrice:1.32009,recognizedAt:at-1200}}))).toBe('Win: TP 2R getroffen @ 1,32009 um 10:40');
 const partialOutcome={atR:3,tpR:5,tp1:{price:1.31993,at:at-2400},rest:{status:'breakeven',price:1.32041,at:at-1200}};
 expect(one(s('p1','loss',{...fx,partialOutcome}))).toBe('Win: TP1 3R @ 1,31993 um 10:20, Rest SL auf Entry um 10:40');
 const key='window:570-720';
 const blocked=dobWatcherCandidates([{...run([],[s('p1','entry',{...fx,reason:'blockedEntryHour'})]),
  guardrails:{...DOB_GUARDRAILS_DEFAULT,entryWindows:[{from:570,to:720,action:'block'}]},blockStats:{years:'2026',byKey:{[key]:{n:40,wr3:12.8,sum3:-9}}}}],at,'GBPUSD');
 expect(blocked[0].head).toBe('gesperrt, weil: Sperrzeit 09:30–12:00 (dort WR3 12,8 %, −9R, 2026)');
});

it('HTF-OB: POI-Zone als erster Rahmen, auch bei verworfen, ältere Zone mit Datum',()=>{
 const far={timeframe:'H4',zone:{top:3910,bottom:3900},zoneStartTime:Date.parse('2026-11-14T08:00:00Z')/1000,distanceAtr:27.2};
 const [row]=dobWatcherCandidates([run([],[s('p1','ob2Retest',{reason:'noPoi',poi:far})])],at,'XAUUSD');
 expect(row.frames[0]).toMatchObject({label:'POI · H4-OB (14.11. 09:00)',ob:{dir:-1,top:3910,bottom:3900}});
 expect(row.frames.map(f=>f.label.split(' ·')[0])).toEqual(['POI','OB1','OB2']);
});
