import {expect,it} from 'vitest';
import {dobBlockStats,dobTpKey,dobTpWinrateText} from '../src/dobBlockStats.js';
import {dobAlarmEvents} from '../src/dobAlarm.js';
import {DOB_GUARDRAILS_DEFAULT} from '../src/dobGuardrails.js';

// WR zum empfohlenen TP im Entry-Alarm: derselbe TP-Fall wie dobConfigTpR (Default, Zeitfenster-TP, toter Gegen-DOB), dieselbe
// Win-Zählung wie die Konfig-Spalte der Statistikseite, ohne belastbare Zahl keine Angabe.
const at=Date.parse('2026-11-18T13:19:00Z')/1000; // 14:19 Berlin
const minute=14*60+19;
const cfg={...DOB_GUARDRAILS_DEFAULT,defaultTpR:2,counterDobMode:'live_block_dead_5r',entryWindows:[{from:minute-19,to:minute+41,action:'tp',tpR:3}]};
const row=(entry_time,max_r,extra={})=>({run_id:'gbp-lq-sweep',entry_time,max_r,sl_hit:max_r<5,outcome:max_r>=2?'success':'loss',ambiguous_r:null,...extra});
const day=86400;

it('wählt den TP-Fall wie dobConfigTpR',()=>{
 expect(dobTpKey(cfg,at)).toBe(`tp:window:${minute-19}-${minute+41}`);
 expect(dobTpKey(cfg,at+3*3600)).toBe('tp:default');
 expect(dobTpKey(cfg,at,'dead')).toBe('tp:dead');
 expect(dobTpKey({...cfg,counterDobMode:'off'},at,'dead')).toBe(`tp:window:${minute-19}-${minute+41}`);
});

it('rechnet je Fall die WR der erlaubten Trades und formatiert sie mit n und Zeitraum',()=>{
 // Fenster (TP 3R): 6 Trades, 4 erreichen 3R. Default (TP 2R): 5 Trades, 2 Wins. Toter Gegen-DOB (5R): 3 Trades, zu wenig.
 const rows=[...[3,4,5,3.5,1,2].map((r,i)=>row(at-(i+1)*day,r)),...[2,2.5,1,0.5,1].map((r,i)=>row(at+3*3600-(i+1)*day,r)),
  ...[5,1,1].map((r,i)=>row(at+3*3600-(i+10)*day,r,{counter_dob_status:'dead'}))];
 const stats=dobBlockStats(cfg,rows);
 expect(stats.tp[`tp:window:${minute-19}-${minute+41}`]).toEqual({n:6,wr:66.7});
 expect(dobTpWinrateText(stats,cfg,at)).toBe(' · WR 66,7 % (14:00–15:00, n=6, 2026)');
 expect(dobTpWinrateText(stats,cfg,at+3*3600)).toBe(' · WR 40 % (n=5, 2026)');
 expect(dobTpWinrateText(stats,cfg,at,'dead')).toBe('');
 expect(dobTpWinrateText(null,cfg,at)).toBe('');
});

it('Entry-Alarm trägt die WR an der TP-Zeile, Teilprofit sagt worauf sie sich bezieht',()=>{
 const stats={years:'2025–2026',tp:{'tp:default':{n:46,wr:54.3}}};
 const s={id:'x',pairId:'p',instrument:'GBPUSD',direction:'long',phase:'entry',route:'b',entryTime:at+3*3600,entryPrice:1.31,stopPrice:1.30951,
  chart:{firstOrderBlockStart:1,secondOrderBlockStart:2,firstOrderBlock:{top:1,bottom:0},secondOrderBlock:{top:1,bottom:0}},poi:null};
 const tpLine=g=>dobAlarmEvents({setups:[s],rejected:[]},at+3*3600,{guardrails:g,blockStats:stats}).find(e=>e.phase==='entry').text.split('\n').find(l=>l.startsWith('TP'));
 expect(tpLine(cfg)).toBe('TP 2R @ 1,31098 · WR 54,3 % (n=46, 2025–2026)');
 const partial={...cfg,defaultTpR:5,partialAtR:3,partialPct:50,partialBe:true};
 expect(tpLine(partial)).toMatch(/· TP2 5R @ 1,31245 · WR \(TP1\) 54,3 % \(n=46, 2025–2026\)$/);
});
