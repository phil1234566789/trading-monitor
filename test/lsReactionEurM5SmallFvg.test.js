// EURUSD 20.11.2026: Short-OB 10:50 Berlin mit 0,4-Pip-FVG nach Sweep der Oberkante des bärischen M5-OB 09:40 (1,09767).
// Die 0,5-Pip-Mindestgröße für Forex-M5 verschluckte den OB, damit fehlte das Setup (Pin 604).
// Nur TS1: LS-Reaktion lehnt bewusst ab (orderBlockSourceRangeNotAssociated). Übergeordnet Abwärtstrend 19.11. 11:30 bis 20.11. 03:05,
// der Anstieg bis 07:45 ist nur dessen Korrektur (dreht am Break & Retest ~0,5 Fib); der Algo hält ihn für einen Aufwärtstrend.
// Bekannte Lücke „Korrektur vs. Trendwechsel“, hier nicht gelöst.
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {detectTradeSetups,detectSetupObs,TRADE_SETUP_OB_SWEEP_PROFILE} from '../src/tradeSetup.js';
import {detectLiquidityLevels} from '../src/liquidityDetection.js';
import {tradeSetupParameters} from '../src/tradeSetupParameters.js';
import {markIgnoredCandles} from '../src/sessionOccurrences.js';
import {berlinOffsetMinutes} from '../src/berlinTime.js';
import {closedChecklistCandles} from '../src/tradeSetupChecklistTimeBasis.js';
import {obMinimum} from '../src/instrumentConfig.js';
import {TRADE_SETUP_M5_CANDLE_COUNT} from '../src/priceChartConstants.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/ls-reaction-ls-ob/eur-2026-11-20.json',import.meta.url),'utf8'));
const sec=iso=>Date.parse(iso)/1000;

it('EURUSD 20.11. 10:50: 0,4-Pip-FVG bildet den Short-OB, Sweep-Quelle ist die Oberkante des M5-OB 09:40',()=>{
 const evaluatedAt=sec('2026-11-20T10:00:00Z'),sessions=fixture.sessionConfigs;
 const window=closedChecklistCandles(fixture.candles.m5,'5m',evaluatedAt).slice(-TRADE_SETUP_M5_CANDLE_COUNT);
 const rows=markIgnoredCandles(window,sessions,s=>berlinOffsetMinutes(s*1000)),levels=detectLiquidityLevels(rows,5);
 const params={...tradeSetupParameters('EURUSD',rows.at(-1).time),sweepSourceProfile:TRADE_SETUP_OB_SWEEP_PROFILE};
 const setup=detectTradeSetups(1,levels.highs,[],levels.highs,detectSetupObs(rows,obMinimum('EURUSD','5m')),params,
  rows.filter(c=>!c.ignored),rows).map(s=>({...s,instrument:'EURUSD'})).find(s=>s.obStartTime===sec('2026-11-20T09:50:00Z'));
 expect(setup).toBeDefined();
 expect([setup.obBottom,setup.obTop]).toEqual([1.09738,1.09776]);
 expect(setup.ls).toMatchObject({sourceKind:'orderBlock',price:1.09767,sourceStartTime:sec('2026-11-20T08:40:00Z'),touchedTime:sec('2026-11-20T09:45:00Z')});
});
