import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {tradeSetup11RowVerdicts,tradeSetup11M5Start} from '../src/tradeSetup11Rows.js';

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
