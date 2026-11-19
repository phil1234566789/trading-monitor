import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {prepareTradeSetup11Context} from '../src/tradeSetup11Context.js';

// Pin 483 (05.10. 16:55): Live-TS1.1 zählt ab dem D1-Anker; der Chart-Debugger darf den Start simulieren.
const f=JSON.parse(readFileSync(new URL('./fixtures/ts11-native/context.json',import.meta.url),'utf8'));
const input={instrument:'XAUUSD',m5Candles:f.candles.m5,h1Candles:f.candles.h1,d1Candles:f.candles.d1,
 settings:f.settings,sessionConfigs:f.sessionConfigs,evaluatedAt:1791212100};

it('ohne Strukturstart bleibt der Kontext exakt beim D1-Anker',()=>{
 const live=prepareTradeSetup11Context(input);
 expect(prepareTradeSetup11Context({...input,structureStartTime:undefined})).toEqual(live);
 expect(live.anchor.structureStartTime).toBe(1790604000);
 expect(live.anchor).not.toHaveProperty('manual');
 expect(live.chain.map(s=>s.trend)).toEqual(['uptrend']);
});

it('ein manueller Strukturstart rechnet die Kette ab diesem Zeitpunkt',()=>{
 const sim=prepareTradeSetup11Context({...input,structureStartTime:1791165900});
 expect(sim.status).toBe('ready');
 expect(sim.anchor).toMatchObject({structureStartTime:1791165900,manual:true});
 const inner=sim.chain.at(-1);
 expect(inner.trend).toBe('downtrend');
 expect([inner.currRange.high.pivotTime,inner.currRange.low.pivotTime]).toEqual([1791188100,1791207900]);
});
