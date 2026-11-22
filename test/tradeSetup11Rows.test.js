import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {tradeSetup11RowVerdicts,tradeSetup11M5Start,oldestPassedSource} from '../src/tradeSetup11Rows.js';

// DOB-POI LQ-Sweep nimmt nur TS1.1, die auch der Chart zeigt (gleiche Trend-Policy). Fixtures: Zeile + native Kerzen bis evaluatedAt.
const fixture=id=>JSON.parse(readFileSync(new URL(`fixtures/ts11-rows/${id}.json`,import.meta.url),'utf8'));
const candles=rows=>rows.map(([time,open,high,low,close])=>({time,open,high,low,close}));
const verdict=(id,m5From=-Infinity)=>{
 const f=fixture(id);
 return tradeSetup11RowVerdicts({rows:[f.row],instrument:f.row.instrument,m5Candles:candles(f.m5).filter(c=>c.time>=m5From),h1Candles:candles(f.h1),
  d1Candles:candles(f.d1),evaluatedAt:f.evaluatedAt,sessionConfigs:f.sessionConfigs}).get(id);
};

it('GBPUSD Long #50728 (Verlust-Alarm 18.11. 03:52) ist kein TS1.1: Trend-Policy verwirft die Quelle',()=>{
 expect(verdict(50728)).toEqual({status:'unmet',reason:'sourceRangeNotAssociated'});
});

it.each([[49404,'#143 Long'],[50294,'#141 Short']])('Mustertrade-TS1.1 %i (%s) bleibt TS1.1',id=>{
 expect(verdict(id).status).toBe('passed');
});

it.each([50728,49404,50294])('Watcher lädt M5 erst ab tradeSetup11M5Start: gleiches Urteil (%i)',id=>{
 const f=fixture(id),from=tradeSetup11M5Start({rows:[f.row],h1Candles:candles(f.h1),d1Candles:candles(f.d1)});
 expect(from).toBeLessThan(Date.parse(f.row.ob_start_time)/1000);
 expect(verdict(id,from)).toEqual(verdict(id));
});

// Der DOB zeigt die TS1.1-Quelle, die bestanden hat, nicht die Primär-LS der Zeile (Diagnose ls-nach-range-low).
// XAU Short 08.10.2026 #46127: Primär-LS 4130,02 (Pivot 09:20 Berlin) liegt nach dem Range-Low 08:35 und fällt durch;
// TS1.1 besteht über die OB-Kante 4131,38 (OB 07:50 Berlin, Sweep 10:25).
it('#46127: Urteil trägt die bestandene Quelle, nicht die Primär-LS',()=>{
 expect(verdict(46127)).toMatchObject({status:'passed',witness:{price:4131.38,pivotTime:1791438600,touchedTime:1791447900,
  timeframe:'5M',sourceKind:'orderBlock'}});
});

it('mehrere bestandene Quellen: der älteste Strukturpunkt gilt (Philip 22.11.)',()=>{
 const level=(price,pivotTime)=>({price,pivotTime,touchedTime:pivotTime+3600});
 expect(oldestPassedSource([{timeframe:'5M',level:level(2,200)},{timeframe:'1H',level:level(1,100)},{timeframe:'5M',level:level(3,300)}]))
  .toEqual({price:1,pivotTime:100,touchedTime:3700,timeframe:'1H',sourceKind:'liquidity'});
 expect(oldestPassedSource([])).toBeNull();
});
