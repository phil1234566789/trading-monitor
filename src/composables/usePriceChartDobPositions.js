import {ref,onMounted} from 'vue';
import {supabase} from '../supabaseClient.js';
import {fetchAllRows} from '../dbReadPaging.js';
import {DOB_GUARDRAILS_DEFAULT,dobGuardrailsFromRow,dobGuardrailsQuery} from '../dobGuardrails.js';
import {dobPoiTypeLabel} from '../dobPoiType.js';
import {dobChartPosition,DOB_RAW_CONFIG} from '../dobChartPositions.js';
import {addDobPosition} from '../dobTradeRendering.js';
import {barSecondsFor} from '../timeframes.js';

// Spalten, die Position, Ausgang nach Konfig und Sperrgründe brauchen; der Rest der Zeile (POI, Zonen) gehört nicht ins Bild.
const COLUMNS='id,instrument,direction,entry_time,entry_price,stop_price,exit_time,outcome,max_r,sl_hit,ambiguous_r,poi_zone_age_seconds,counter_dob_status,features';

// Läufe für das Dropdown im Trades-Menü.
export function useDobRunOptions(){
 const runs=ref([]);
 onMounted(async()=>{
  const {data,error}=await supabase.from('dob_trade_setup_runs').select('id,label,poi_type').order('sort').order('id').limit(200);
  // POI-Art im Namen, damit HTF-OB- und LQ-Sweep-Läufe im Menü nicht verwechselt werden.
  if(!error)runs.value=data.map(r=>({...r,label:`${dobPoiTypeLabel(r.poi_type)} · ${r.label}`}));
 });
 return runs;
}

// Alle Trades eines DOB-Laufs als Positionen im Hauptchart. Lauf + Instrument werden einmal geladen (Paging, PostgREST-Deckel)
// samt gespeicherter Sperr-Konfig; gezeichnet wird nur, was in den geladenen Kerzen liegt.
// context(): {series, candles, enabled, run, symbol, currentBar, showBlocked, withConfig}
export function usePriceChartDobPositions(context){
 const status=ref('');
 let primitives=[],series=null,key=null,data=null,request=0;
 function clear(){
  if(series)primitives.forEach(p=>series.detachPrimitive(p));
  primitives=[];
 }
 function draw(){
  const c=context();clear();series=c.series;
  if(!series||!data||!c.candles.length)return;
  const add=p=>{series.attachPrimitive(p);primitives.push(p);};
  const eventBarSeconds=barSecondsFor(c.currentBar);
  const config=c.withConfig===false?DOB_RAW_CONFIG:data.config;
  let shown=0;
  for(const row of data.rows){
   const p=dobChartPosition(row,config,c.candles,c.showBlocked);
   if(!p)continue;
   shown++;
   addDobPosition(add,{...p,targetLabel:`TP ${p.k.toLocaleString('de-DE')}R`},c.candles,eventBarSeconds,{muted:p.blocked});
  }
  status.value=`DOB-Positionen: ${shown} im Ausschnitt (${data.rows.length} im Lauf)`;
 }
 async function load(c,k){
  const current=++request;
  status.value='DOB-Positionen: Lauf laden …';
  // Konfig der POI-Art des Laufs, nie die einer anderen POI-Art.
  const runRow=await supabase.from('dob_trade_setup_runs').select('poi_type').eq('id',c.run).maybeSingle();
  const [trades,guardrails]=await Promise.all([
   fetchAllRows((from,to)=>supabase.from('dob_trade_setups').select(COLUMNS).eq('instrument',c.symbol).eq('run_id',c.run)
    .order('entry_time').order('id').range(from,to)),
   runRow.data?dobGuardrailsQuery(supabase,c.symbol,runRow.data.poi_type):{error:runRow.error??new Error('Lauf fehlt')}]);
  if(current!==request)return;
  if(trades.error){status.value=`DOB-Positionen: ${trades.error.message}`;key=null;return;}
  // Ohne lesbare Konfig gilt „nichts gesperrt, TP 2R“, wie auf /dob-statistik.
  data={rows:trades.data,config:guardrails.error?DOB_GUARDRAILS_DEFAULT:dobGuardrailsFromRow(guardrails.data)};
  key=k;
  draw();
 }
 function refresh(){
  const c=context();
  if(!c.enabled||!c.run){request++;key=null;data=null;clear();status.value='';return;}
  const k=`${c.run}:${c.symbol}`;
  if(k===key&&data){draw();return;}
  if(k!==key){key=k;data=null;clear();void load(c,k);}
 }
 return {status,refresh,dispose:()=>{request++;clear();}};
}
