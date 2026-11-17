import {describe,it,expect} from 'vitest';
import {dobPartialScore,dobRowConfigScore} from '../src/dobPartialProfit.js';
import {dobBreakevenFeatures} from '../src/dobTradeFeatures.js';
import {dobRouteStats} from '../src/dobTradeStatistics.js';
import {DOB_GUARDRAILS_DEFAULT,dobGuardrailsFromRow,dobGuardrailsToRow,dobPartialPlan} from '../src/dobGuardrails.js';

const plan={atR:3,pct:50,be:true};
const row=(maxR,slHit,be,extra={})=>({max_r:maxR,sl_hit:slHit,ambiguous_r:null,outcome:slHit?'loss':'success',route:'a',
 features:be?dobBreakevenFeatures(3,be):{},...extra});

describe('dobPartialScore (50 % bei 3R, Rest SL auf Entry bis TP)',()=>{
 it('TP erreicht: halbe 3R plus halbe TP',()=>{
  expect(dobPartialScore(row(5,false,{maxR:5,slHit:false,ambiguousR:null}),4,plan)).toMatchObject({outcome:'success',r:3.5,rest:'success',label:'3R ½'});
 });
 it('3R erreicht, Rest auf Entry: +1,5R mit BE im Label',()=>{
  expect(dobPartialScore(row(3.5,false,{maxR:3.5,slHit:true,ambiguousR:null}),4,plan)).toMatchObject({outcome:'success',r:1.5,rest:'breakeven',label:'3R ½ · BE'});
 });
 it('vor 3R ausgestoppt: −1R; TP ≤ 3R: alles beim TP',()=>{
  expect(dobPartialScore(row(2.5,true,{maxR:2.5,slHit:true,ambiguousR:null}),4,plan)).toMatchObject({outcome:'loss',r:-1});
  expect(dobPartialScore(row(3,false,null),2,plan)).toMatchObject({outcome:'success',r:2,label:null});
 });
 it('ohne SL auf Entry: Rest läuft mit Original-SL (aus max_r)',()=>{
  expect(dobPartialScore(row(3.5,true,null),4,{...plan,be:false})).toMatchObject({r:1,rest:'loss'});
 });
 it('3R erreicht, Rest weder TP noch BE: offen; ohne gespeicherten Rest-Verlauf unbekannt',()=>{
  expect(dobPartialScore(row(3.5,false,{maxR:3.5,slHit:false,ambiguousR:null}),4,plan)).toMatchObject({outcome:'open',r:null});
  expect(dobPartialScore(row(3.5,false,null),4,plan)).toMatchObject({outcome:'unknown',r:null});
 });
});

describe('Konfig und Statistik',()=>{
 it('Spalten partial_* runden über die DB-Form; Default aus',()=>{
  expect(DOB_GUARDRAILS_DEFAULT.partialAtR).toBeNull();
  const c=dobGuardrailsFromRow(dobGuardrailsToRow('XAUUSD',{...DOB_GUARDRAILS_DEFAULT,partialAtR:3,partialPct:50,partialBe:true}));
  expect(c).toMatchObject({partialAtR:3,partialPct:50,partialBe:true});
  expect(dobPartialPlan(c,4)).toEqual(plan);
  expect(dobPartialPlan(c,3)).toBeNull();
 });
 it('dobRouteStats zählt r des Ergebnisses (Winrate = Anteil mit r > 0)',()=>{
  const cfg={...DOB_GUARDRAILS_DEFAULT,defaultTpR:4,partialAtR:3,partialPct:50,partialBe:true};
  const rows=[row(5,false,{maxR:5,slHit:false,ambiguousR:null}),row(3.5,false,{maxR:3.5,slHit:true,ambiguousR:null}),row(1,true,{maxR:1,slHit:true,ambiguousR:null})]
   .map((r,i)=>({...r,entry_time:1_780_000_000+i*3600}));
  const s=dobRouteStats(rows,r=>dobRowConfigScore(cfg,r)).a;
  expect(s).toMatchObject({success:2,loss:1,sumR:4});
 });
});
