import {ref,watch} from 'vue';
import {fetchInitialCandles} from '../forexCandles.js';
import {fetchCandlesCached} from '../candleCache.js';
import {TRADE_SETUP_M5_CANDLE_COUNT} from '../priceChartConstants.js';
import {nextCandlePollDelay} from '../candlePolling.js';
import {formatDatedTime} from '../berlinTime.js';
import {markIgnored} from '../ignoredCandles.js';
import {sessions} from '../sessions.js';
import {collectDoubleOrderBlockPins} from '../doubleOrderBlockPin.js';
import {closedChecklistCandles} from '../tradeSetupChecklistTimeBasis.js';
import {renderDoubleOrderBlocks,hitDoubleOrderBlock,doubleOrderBlockDetails} from '../doubleOrderBlockRendering.js';

export function useDoubleOrderBlockChart(context) {
  const status=ref(''),details=ref('');
  let key=null,sequence=0,worker=null,disposed=false,items=[],series=null,pairs=[],timer=null,coverage=null,hoveredPairId=null;
  function schedule() {
    clearTimeout(timer);
    if(!disposed&&context().enabled&&context().replayUntil==null)timer=setTimeout(refresh,nextCandlePollDelay('1m'));
  }
  function clear() {
    if(series)items.forEach(({primitive})=>series.detachPrimitive(primitive));
    items=[];
    details.value='';
  }
  function draw() {
    const c=context();clear();series=c.series;
    const pins=c.pinnedSnapshots??[];
    const combined=[...new Map([...pins.map(p=>p.pair),...pairs,...(c.hoveredPin?[c.hoveredPin.pair]:[])].map(p=>[p.id,p])).values()];
    if(!disposed&&series&&(c.enabled||pins.length)&&!c.snapshot)items=renderDoubleOrderBlocks(series,combined,c.candles,c.evaluatedAt,
      {selectedPairId:c.hoveredPin?.pair.id??hoveredPairId,pinnedPairIds:new Set(pins.map(p=>p.pair.id)),pairEvaluatedAt:new Map(c.hoveredPin?[[c.hoveredPin.pair.id,Math.min(c.evaluatedAt,c.hoveredPin.evaluatedAt)]]:[])});
    if(c.hoveredPin)details.value='Pin-Snapshot · '+doubleOrderBlockDetails(c.hoveredPin.pair,Math.min(c.evaluatedAt,c.hoveredPin.evaluatedAt),c.visibleRange);
  }
  async function load(c,request) {
    status.value='DOB: Native M5-/M1-Daten laden …';
    try {
      // H4/D1-Chartvorlauf darf nicht Jahre an M1-Daten anfordern; das UI zeigt seine Abdeckung.
      const count=TRADE_SETUP_M5_CANDLE_COUNT;
      const m5=closedChecklistCandles(await fetchCandlesCached(fetchInitialCandles,c.symbol,'5m',count,c.evaluatedAt*1000),'5m',c.evaluatedAt);
      if(disposed||request!==sequence)return;
      if(!m5.length){status.value='DOB: M5-Daten fehlen.';key=null;return;}
      const m1Count=TRADE_SETUP_M5_CANDLE_COUNT*5+5;
      const m1=closedChecklistCandles(await fetchCandlesCached(fetchInitialCandles,c.symbol,'1m',m1Count,c.evaluatedAt*1000),'1m',c.evaluatedAt);
      if(disposed||request!==sequence)return;
      status.value='DOB: Auswertung …';
      const bounds=(rows,duration)=>({from:rows[0]?.time??null,through:rows.length?rows.at(-1).time+duration:null,count:rows.length});
      coverage={source:'native-fxcm-bid',m5:bounds(m5,300),m1:bounds(m1,60)};
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
      activeWorker.postMessage({m5Candles:markIgnored(m5,c.symbol),m1Candles:markIgnored(m1,c.symbol),instrument:c.symbol,evaluatedAt:c.evaluatedAt});
    } catch(error) {
      if(!disposed&&request===sequence){status.value=`DOB: ${error.message||'Daten konnten nicht geladen werden.'}`;key=null;}
    }
  }
  function refresh() {
    const c=context();
    if(disposed)return;
    if(c.snapshot||!c.series||!c.candles.length||!Number.isFinite(c.evaluatedAt)) {
      sequence++;worker?.terminate();worker=null;key=null;pairs=[];clear();clearTimeout(timer);timer=null;status.value='';return;
    }
    if(!c.enabled){sequence++;worker?.terminate();worker=null;key=null;pairs=[];clearTimeout(timer);timer=null;draw();status.value=c.pinnedSnapshots?.length?'DOB: eingefrorene Pin-Snapshots.':'';return;}
    const nextKey=JSON.stringify([c.symbol,Math.floor(c.evaluatedAt/60)]);
    if(nextKey!==key){key=nextKey;sequence++;worker?.terminate();worker=null;pairs=[];clear();void load(c,sequence);}
    else draw();
    schedule();
  }
  const stopSessions=watch(sessions,()=>{key=null;refresh();},{deep:true});
  const stopPins=watch(()=>[context().pinnedSnapshots,context().hoveredPin],()=>{draw();},{deep:true});
  function dispose(){disposed=true;sequence++;stopSessions();stopPins();clearTimeout(timer);worker?.terminate();worker=null;clear();series=null;}
  function hit(point){return point?hitDoubleOrderBlock(items,point.x,point.y):null;}
  function hover(point){
    const pair=hit(point),c=context();
    if(hoveredPairId!==(pair?.id??null)){hoveredPairId=pair?.id??null;draw();}
    details.value=doubleOrderBlockDetails(pair,c.evaluatedAt,c.visibleRange);
  }
  function pinCandidates(x,y,radius){const c=context();return collectDoubleOrderBlockPins(items,x,y,
    {...c,coverage:coverage??c.pinnedSnapshots?.[0]?.coverage},radius);}
  function hasPinCandidate(x,y,radius=40){return items.some(i=>i.primitive.distanceTo(x,y)<=radius);}
  return {status,details,refresh,dispose,hit,hover,pinCandidates,hasPinCandidate};
}
