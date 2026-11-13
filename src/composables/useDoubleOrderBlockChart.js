import {ref} from 'vue';
import {fetchInitialCandles} from '../forexCandles.js';
import {fetchCandlesCached} from '../candleCache.js';
import {TRADE_SETUP_M5_CANDLE_COUNT} from '../priceChartConstants.js';
import {nextCandlePollDelay} from '../candlePolling.js';
import {formatDatedTime} from '../berlinTime.js';
import {renderDoubleOrderBlocks,hitDoubleOrderBlock} from '../doubleOrderBlockRendering.js';

export function useDoubleOrderBlockChart(context) {
  const status=ref('');
  let key=null,sequence=0,worker=null,disposed=false,items=[],series=null,pairs=[],timer=null;
  function schedule() {
    clearTimeout(timer);
    if(!disposed&&context().enabled&&context().replayUntil==null)timer=setTimeout(refresh,nextCandlePollDelay('1m'));
  }
  function clear() {
    if(series)items.forEach(({primitive})=>series.detachPrimitive(primitive));
    items=[];
  }
  function draw() {
    const c=context();clear();series=c.series;
    if(!disposed&&series&&c.enabled&&!c.snapshot)items=renderDoubleOrderBlocks(series,pairs,c.candles,c.evaluatedAt);
  }
  async function load(c,request) {
    status.value='DOB: Native M5-/M1-Daten laden …';
    try {
      // H4/D1-Chartvorlauf darf nicht Jahre an M1-Daten anfordern; das UI zeigt seine Abdeckung.
      const count=TRADE_SETUP_M5_CANDLE_COUNT;
      const m5=await fetchCandlesCached(fetchInitialCandles,c.symbol,'5m',count,c.evaluatedAt*1000);
      if(disposed||request!==sequence)return;
      if(!m5.length){status.value='DOB: M5-Daten fehlen.';key=null;return;}
      const m1Count=TRADE_SETUP_M5_CANDLE_COUNT*5+5;
      const m1=await fetchCandlesCached(fetchInitialCandles,c.symbol,'1m',m1Count,c.evaluatedAt*1000);
      if(disposed||request!==sequence)return;
      status.value='DOB: Auswertung …';
      // Die gemeinsame Erkennung läuft abseits des Chart-Threads, auch bei langem M1-Vorlauf.
      const activeWorker=new Worker(new URL('../doubleOrderBlockChartWorker.js',import.meta.url),{type:'module'});
      worker=activeWorker;
      activeWorker.onmessage=({data})=>{
        activeWorker.terminate();
        if(disposed||request!==sequence)return;
        worker=null;
        if(data.error){status.value=`DOB: ${data.error}`;key=null;return;}
        pairs=data.result.pairs??[];
        const coverage=`M5 ab ${formatDatedTime(m5[0].time)} · M1 ${m1.length?'ab '+formatDatedTime(m1[0].time):'fehlt'}`;
        status.value=(data.result.status==='unknown'?'DOB: Daten unvollständig.':`DOB: ${pairs.length} bestätigt im Ausschnitt.`)+' '+coverage;
        draw();
      };
      activeWorker.onerror=()=>{
        activeWorker.terminate();
        if(!disposed&&request===sequence){worker=null;status.value='DOB-Auswertung fehlgeschlagen. Erneut laden.';key=null;}
      };
      activeWorker.postMessage({m5Candles:m5,m1Candles:m1,instrument:c.symbol,evaluatedAt:c.evaluatedAt});
    } catch(error) {
      if(!disposed&&request===sequence){status.value=`DOB: ${error.message||'Daten konnten nicht geladen werden.'}`;key=null;}
    }
  }
  function refresh() {
    const c=context();
    if(disposed)return;
    if(!c.enabled||c.snapshot||!c.series||!c.candles.length||!Number.isFinite(c.evaluatedAt)) {
      sequence++;worker?.terminate();worker=null;key=null;pairs=[];clear();clearTimeout(timer);timer=null;status.value='';return;
    }
    const nextKey=JSON.stringify([c.symbol,Math.floor(c.evaluatedAt/60)]);
    if(nextKey!==key){key=nextKey;sequence++;worker?.terminate();worker=null;pairs=[];clear();void load(c,sequence);}
    else draw();
    schedule();
  }
  function dispose(){disposed=true;sequence++;clearTimeout(timer);worker?.terminate();worker=null;clear();series=null;}
  function hit(point){return point?hitDoubleOrderBlock(items,point.x,point.y):null;}
  return {status,refresh,dispose,hit};
}
