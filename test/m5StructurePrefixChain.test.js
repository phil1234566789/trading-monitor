import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {createM5StructureContextResolver} from '../src/m5StructureContext.js';
import {createM5StructurePrefixChainResolver} from '../src/m5StructurePrefixChain.js';
import {lsReactionRowVerdicts} from '../src/lsReactionRows.js';

// Die inkrementelle Kette (LQ-Algo-Schleife) muss je Zeitpunkt dieselbe Kette liefern wie der volle Präfix-Kontext.
// Pivots tragen dort den Vollbestand-Touch statt des Präfix-Touchs (der Beleg kommt weiter aus dem vollen Kontext), deshalb ohne touched.
const read=p=>JSON.parse(readFileSync(new URL(`fixtures/${p}`,import.meta.url),'utf8'));
const candles=rows=>rows.map(([time,open,high,low,close])=>({time,open,high,low,close}));
const xau=sessions=>sessions.map(s=>({...s,instrument:'XAUUSD'}));
const perf=read('ls-owner-perf/xauusd-69401.json'),pins=read('ls-sweep-selection/xau-pins-634-641.json');
const cases=[['#69401',perf],...pins.cases.map(c=>[`Pin ${c.pin}`,{...c,sessions:pins.sessions}])].map(([name,c])=>[name,
 {instrument:'XAUUSD',m5Candles:candles(c.m5),h1Candles:candles(c.h1),d1Candles:candles(c.d1),sessionConfigs:xau(c.sessions)}]);
const norm=context=>context.status!=='ready'?context.reason:
 JSON.stringify([context.stateKnownAt,context.chain],(k,v)=>k==='touched'||k==='touchedAt'?undefined:v);

describe('inkrementelle M5-Strukturkette',()=>{
 it.each(cases)('%s: gleiche Kette wie der volle Kontext, vorwärts und rückwärts',(name,input)=>{
  const end=input.m5Candles.at(-1).time+300,ticks=[];
  for(let at=end-2*86400;at<=end;at+=300)ticks.push(at);
  // Jeder 5-min-Schritt läuft durch (kleine Fortschritte), verglichen wird alle 45 min (der volle Kontext kostet je Zeitpunkt).
  const checked=ticks.filter((_,i)=>i%9===0),full=createM5StructureContextResolver(input);
  const forward=createM5StructurePrefixChainResolver(input),backward=createM5StructurePrefixChainResolver(input);
  const seen=new Map(ticks.map(at=>[at,norm(forward(at))]));
  for(const at of checked)expect(seen.get(at),`${name} ${at}`).toBe(norm(full(at)));
  for(const at of [...checked].reverse())expect(norm(backward(at)),`${name} rückwärts ${at}`).toBe(norm(full(at)));
  expect(checked.some(at=>full(at).chain.length>1)).toBe(true);
 },60000);

 // Live-Fall: LS-Pivot 24.11., Sweep 27.11.; vorher ~10 s CPU (Edge-Limit ~2 s), Urteil unverändert unmet.
 it('#69401: LS-Reaktion-Urteil gleich, in Bruchteilen der alten Laufzeit',()=>{
  const t0=performance.now();
  const verdicts=lsReactionRowVerdicts({rows:perf.rows,instrument:'XAUUSD',m5Candles:candles(perf.m5),h1Candles:candles(perf.h1),
   d1Candles:candles(perf.d1),evaluatedAt:perf.evaluatedAt,sessionConfigs:perf.sessions});
  expect(verdicts.get(69401)).toEqual({status:'unmet',reason:'sourceRangeNotAssociated'});
  expect(performance.now()-t0).toBeLessThan(3000);
 },60000);
});
