import {fetchInitialCandles} from './forexCandles.js';
import {fetchCandlesCached} from './candleCache.js';
import {TRADE_SETUP_M5_CANDLE_COUNT} from './priceChartConstants.js';
import {closedChecklistCandles} from './tradeSetupChecklistTimeBasis.js';
import {doubleOrderBlockInput} from './doubleOrderBlockInput.js';

// Chart und Journal-Entry c) laden denselben Vorlauf, sonst sähe der Vorschlag andere Paare als der Chart.
// H4/D1-Chartvorlauf darf nicht Jahre an M1-Daten anfordern.
export async function loadDoubleOrderBlockCandles(symbol,evaluatedAt) {
  const m5=closedChecklistCandles(await fetchCandlesCached(fetchInitialCandles,symbol,'5m',TRADE_SETUP_M5_CANDLE_COUNT,evaluatedAt*1000),'5m',evaluatedAt);
  if(!m5.length)return {m5,m1:[]};
  const m1=closedChecklistCandles(await fetchCandlesCached(fetchInitialCandles,symbol,'1m',TRADE_SETUP_M5_CANDLE_COUNT*5+5,evaluatedAt*1000),'1m',evaluatedAt);
  return {m5,m1};
}

// Die Erkennung läuft abseits des UI-Threads, auch bei langem M1-Vorlauf. Callbacks statt Promise:
// der Chart setzt seinen Status im selben Tick wie die Worker-Antwort.
export function runDoubleOrderBlockWorker({m5,m1,symbol,evaluatedAt},{onResult,onError}) {
  const worker=new Worker(new URL('./doubleOrderBlockChartWorker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{worker.terminate();data.error?onError(data.error):onResult(data.result);};
  worker.onerror=()=>{worker.terminate();onError(null);};
  worker.postMessage(doubleOrderBlockInput({m5,m1,symbol,evaluatedAt}));
  return worker;
}
