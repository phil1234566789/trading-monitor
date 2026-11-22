import {describe,expect,it} from 'vitest';
import {renderDobTrade,dobTradeFrame} from '../src/dobTradeRendering.js';
import {OrderBlockPrimitive} from '../src/orderBlocks.js';
import {LiquidityLinePrimitive} from '../src/liquidity.js';

// LQ-Sweep-Trade aus dem Prod-Beispiel (dob-lq-sweep-v0 … 1794895200:1794901200:b), LS-Reaktion #47791.
const lsReaction={id:47791,direction:'short',ob_top:3878.62,ob_bottom:3873.07,ob_start_time:'2026-11-17T07:40:00Z',ls_price:3877.19,
 ls_pivot_time:'2026-11-17T06:30:00Z',ls_touched_time:'2026-11-17T07:00:00Z'};
const row={id:'x',instrument:'XAUUSD',direction:'short',entry_time:1794902000,entry_price:3870,stop_price:3879,target_price:3852,exit_time:1794905000,
 outcome:'success',first_ob_start:1794895200,poi_kind:'ts11',poi_zone_top:3878.62,poi_zone_bottom:3873.07,poi_zone_start:1794901200,
 features:{poi_trade_setup_id:47791,poi_match:'edge'},lsReaction};
const candles=Array.from({length:200},(_,i)=>({time:1794880000+i*300,open:3870,high:3880,low:3860,close:3870}));
const draw=r=>{const attached=[];renderDobTrade({attachPrimitive:p=>attached.push(p),detachPrimitive:()=>{}},r,[],candles,'5m');return attached;};

describe('DOB-Detail LQ-Sweep',()=>{
 // Gespeicherte bestandene LS-Reaktion-Quelle (Fill, features.poi_ls_*) schlägt die Primär-LS der trade_setups-Zeile.
 it('zeichnet das LS der bestandenen Quelle, wenn der Lauf es gespeichert hat',()=>{
  const withWitness={...row,features:{...row.features,poi_ls_price:3878.45,poi_ls_pivot_time:1794896400,poi_ls_touched_time:1794899700}};
  const lines=draw(withWitness).filter(p=>p instanceof LiquidityLinePrimitive);
  expect(lines.map(p=>p._options.label)).toEqual(expect.arrayContaining(['LS 3.878,45']));
  expect(lines.map(p=>p._options.label)).not.toContain('LS 3.877,19');
 });

 it('zeichnet LS-Reaktion-OB-Box und LS-Linie statt des goldenen POI-Kastens',()=>{
  const boxes=draw(row).filter(p=>p instanceof OrderBlockPrimitive);
  expect(boxes).toHaveLength(1);
  expect(boxes[0]._options.label).toBe('LS-Reaktion #47791 · Kante');
  expect(boxes[0]._zone).toMatchObject({top:3878.62,bottom:3873.07});
  const lines=draw(row).filter(p=>p instanceof LiquidityLinePrimitive).map(p=>p._options.label);
  expect(lines).toEqual(expect.arrayContaining(['LS 3.877,19',expect.stringMatching(/^Sweep \d\d:\d\d$/)]));
 });
 // Kausale LS-Auswahl (Lauf v2): alle LS der Sweep-Kerze als Linien, Box bleibt die LS-Reaktion der Geometrie.
 it('zeichnet beim kausalen LS alle LS der Sweep-Kerze, Label mit Zähler',()=>{
  const causal={...row,features:{...row.features,poi_ls_source:'causal',poi_ls_price:3878.45,poi_ls_pivot_time:1794896400,poi_ls_touched_time:1794899700,
   poi_ls_count:2,poi_ls_levels:[{price:3878.45,pivotTime:1794896400,sourceKind:'liquidity'},{price:3877.9,pivotTime:1794897000,sourceKind:'orderBlock'}]}};
  const lines=draw(causal).filter(p=>p instanceof LiquidityLinePrimitive).map(p=>p._options.label);
  expect(lines).toEqual(expect.arrayContaining(['LS 3.878,45','LS 3.877,9',expect.stringMatching(/^Sweep \d\d:\d\d$/)]));
  expect(lines).not.toContain('LS 3.877,19');
  expect(draw(causal).filter(p=>p instanceof OrderBlockPrimitive).map(b=>b._options.label)).toEqual(['LS-Reaktion #47791 · Kante · 2 LS']);
  expect(dobTradeFrame(causal).from).toBe(1794896400);
 });
 it('ohne kausalen Sweep keine LS-Linie statt der Primär-LS',()=>{
  const none={...row,features:{...row.features,poi_ls_source:'none',poi_ls_price:null,poi_ls_count:0,poi_ls_levels:[]}};
  expect(draw(none).filter(p=>p instanceof LiquidityLinePrimitive).map(p=>p._options.label).filter(l=>l.startsWith('LS'))).toEqual([]);
 });
 it('HTF-OB bleibt beim goldenen POI',()=>{
  const htf={...row,poi_kind:'ob_h1',lsReaction:undefined,features:{}};
  expect(draw(htf).filter(p=>p instanceof OrderBlockPrimitive).map(p=>p._options.label)[0]).toMatch(/^POI H1-OB/);
 });
 it('Ausschnitt beginnt am LS-Pivot',()=>{
  expect(dobTradeFrame(row).from).toBe(Date.parse(lsReaction.ls_pivot_time)/1000);
 });
});
