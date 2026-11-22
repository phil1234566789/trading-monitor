import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {prepareM5StructureContext} from '../src/m5StructureContext.js';

// Pin 483 (05.10. 16:55): Live-LS-Reaktion zählt ab dem D1-Anker; der Chart-Debugger darf den Start simulieren.
const f=JSON.parse(readFileSync(new URL('./fixtures/ls-reaction-native/context.json',import.meta.url),'utf8'));
const input={instrument:'XAUUSD',m5Candles:f.candles.m5,h1Candles:f.candles.h1,d1Candles:f.candles.d1,
 settings:f.settings,sessionConfigs:f.sessionConfigs,evaluatedAt:1791212100};

it('ohne Strukturstart bleibt der Kontext exakt beim D1-Anker',()=>{
 const live=prepareM5StructureContext(input);
 expect(prepareM5StructureContext({...input,structureStartTime:undefined})).toEqual(live);
 expect(live.anchor.structureStartTime).toBe(1790604000);
 expect(live.anchor).not.toHaveProperty('manual');
 expect(live.chain.map(s=>s.trend)).toEqual(['uptrend']);
});

it('ein manueller Strukturstart rechnet die Kette ab diesem Zeitpunkt',()=>{
 const sim=prepareM5StructureContext({...input,structureStartTime:1791165900});
 expect(sim.status).toBe('ready');
 expect(sim.anchor).toMatchObject({structureStartTime:1791165900,manual:true});
 const inner=sim.chain.at(-1);
 expect(inner.trend).toBe('downtrend');
 expect([inner.currRange.high.pivotTime,inner.currRange.low.pivotTime]).toEqual([1791188100,1791207900]);
});
