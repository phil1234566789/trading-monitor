import {ref,computed,onMounted,onUnmounted} from 'vue';
import {supabase} from '../supabaseClient.js';
import {dobWatcherStatus} from '../dobWatcherStatus.js';

// Herzschlag und heutige Kandidaten des dob-watchers für Navigation und Panel; der Watcher rechnet, die Seite liest nur.
// ponytail: Polling alle 30 s statt Realtime; reicht bei einem Lauf pro Minute.
const INSTRUMENTS=['XAUUSD','GBPUSD','EURUSD'];
const POLL_MS=30_000;

export function useDobWatcher(){
 const states=ref([]),pins=ref({}),now=ref(Math.floor(Date.now()/1000)),error=ref('');
 let timer=null;
 async function load(){
  const {data,error:e}=await supabase.from('dob_watcher_state').select('instrument,last_run_at,skipped,error,last_m1_time,candidates')
   .in('instrument',INSTRUMENTS).order('instrument').limit(10);
  now.value=Math.floor(Date.now()/1000);
  if(e){error.value=e.message;return;}
  error.value='';states.value=data;
  // Pin je DOB-Paar (Auto-Pin beim ersten Alarm, dob_pin_key = Paar-ID).
  const keys=[...new Set(data.flatMap(s=>(s.candidates??[]).map(c=>c.pairId)))];
  if(!keys.length){pins.value={};return;}
  const {data:pinRows}=await supabase.from('pin_context').select('id,dob_pin_key').in('dob_pin_key',keys).limit(500);
  pins.value=Object.fromEntries((pinRows??[]).map(p=>[p.dob_pin_key,p.id]));
 }
 onMounted(()=>{void load();timer=setInterval(load,POLL_MS);});
 onUnmounted(()=>clearInterval(timer));
 const status=computed(()=>error.value?{tone:'down',text:'nicht lesbar'}:dobWatcherStatus(states.value,now.value));
 const candidates=computed(()=>states.value.flatMap(s=>s.candidates??[]).map(c=>({...c,pinId:pins.value[c.pairId]??null}))
  .sort((a,b)=>b.time-a.time));
 return {status,candidates,refresh:load};
}
