import {expect,it} from 'vitest';
import {dobBlockStats,dobBlockKey,dobBlockStatsText} from '../src/dobBlockStats.js';
import {DOB_GUARDRAILS_DEFAULT} from '../src/dobGuardrails.js';
import {load,run} from './dobFixtures.js';

// Statistik je Konfig-Sperre (⛔-Alarm, Q23): Trades, die genau diese Sperre trifft, Winrate und ΣR bei 3R aus max_r/sl_hit.
const berlin=(day,hhmm)=>Date.parse(`${day}T${hhmm}:00+01:00`)/1000;
const row=(day,hhmm,maxR,slHit,extra={})=>({entry_time:berlin(day,hhmm),max_r:maxR,sl_hit:slHit,ambiguous_r:null,outcome:'loss',counter_dob_status:'none',
 poi_zone_age_seconds:null,features:{},...extra});
const cfg={...DOB_GUARDRAILS_DEFAULT,blockedMonths:[1],entryWindows:[{from:630,to:720,action:'block'},{from:840,to:1140,action:'tp',tpR:4}]};

it('zählt je Sperre: Fenster, Monat, Gegen-DOB; Win ab 3R, Loss mit SL vor 3R',()=>{
 const rows=[row('2026-11-03','10:45',3.5,true),row('2026-11-03','11:15',1,true),row('2026-11-04','11:00',0.5,true),
  row('2026-01-07','09:00',5,false),row('2026-01-08','15:00',0,true),row('2026-11-05','15:00',2,true,{counter_dob_status:'live'})];
 const s=dobBlockStats(cfg,rows);
 expect(s.byKey['window:630-720']).toEqual({n:3,wr3:33.3,sum3:1});
 expect(s.byKey['month:1']).toEqual({n:2,wr3:50,sum3:2});
 expect(s.byKey.counterDob).toEqual({n:1,wr3:0,sum3:-1});
 expect(s.years).toBe('2026');
 expect(dobBlockKey(cfg,'blockedEntryHour',berlin('2026-11-12','11:30'))).toBe('window:630-720');
 expect(dobBlockKey(cfg,'blockedMonth',berlin('2026-01-12','11:30'))).toBe('month:1');
 expect(dobBlockStatsText(s,'window:630-720')).toBe(' · dort WR3 33,3 %, +1R (2026)');
 expect(dobBlockStatsText(s,'blockedZoneAge')).toBe('');
});

it('gesperrter Monat: checkDobTradeSetup verwirft mit blockedMonth statt still nichts zu rechnen',()=>{
 const result=run(load('2026-11-12'),undefined,true,undefined,{guardrails:{...DOB_GUARDRAILS_DEFAULT,blockedMonths:[11]}});
 expect(result.setups).toEqual([]);
 expect(result.rejected.some(s=>s.reason==='blockedMonth'&&s.entryTime!=null)).toBe(true);
});
