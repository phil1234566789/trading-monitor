<script setup>
import {computed,ref,watch,nextTick,onMounted,onUnmounted} from 'vue';
import {useLocalStorageRef} from '../composables/useLocalStorageRef.js';
import {useRoute,useRouter} from 'vue-router';
import {supabase} from '../supabaseClient.js';
import {fetchAllRows} from '../dbReadPaging.js';
import {dobRouteStats,dobGroups,dobTradeMonth,dobTradeSessions,dobChartLink,dobSourceLabel,dobTradePinKey,dobReturnTracker,dobMaxRBucket,dobMaxRLabel,dobMaxRShares,DOB_MAX_R_FILTERS,DOB_OUTCOME_LABELS,DOB_STAT_TARGETS,dobBreakEven,dobPct,dobWinTone,dobSignedR,dobTimeSlotGroups,dobZoneAgeBucket,DOB_ZONE_AGE_BUCKETS,dobTotalStats,DOB_RETEST_KINDS,DOB_WEEKDAYS,DOB_HALVES,dobTradeWeekday,dobTradeHalf,dobHasWideVariant,dobAsWide,dobMedian,dobTradesPerWeek} from '../dobTradeStatistics.js';
import DobStatsTable from '../components/DobStatsTable.vue';
import DobStatCell from '../components/DobStatCell.vue';
import DobAccountTile from '../components/DobAccountTile.vue';
import DobGuardrailsPanel from '../components/DobGuardrailsPanel.vue';
import {DOB_GUARDRAILS_DEFAULT,dobGuardrailsFromRow,dobRowGuardrailReason,dobGuardrailsSummary} from '../dobGuardrails.js';
import {dobRowConfigScore} from '../dobPartialProfit.js';
import {useDobTradePins} from '../composables/useDobTradePins.js';
import SimulationPinMenu from '../components/SimulationPinMenu.vue';
import SimulationPinFlag from '../components/SimulationPinFlag.vue';
import {formatDatedTime} from '../berlinTime.js';
import {fmtR,pnlClass} from '../format.js';
import {cssColor} from '../chartColors.js';

// Die Seite rechnet nichts nach, sie liest nur die vorberechneten Trades (scripts/dobTradeSetupsFill.mjs) und zählt sie.
const INSTRUMENTS=['XAUUSD'],ROUTES=['a','b'],PAGE=200;
const route=useRoute(),router=useRouter();
const instrument=ref(INSTRUMENTS.includes(route.query.instrument)?route.query.instrument:'XAUUSD');
const year=ref(String(route.query.year??new Date().getFullYear()));
const run=ref(typeof route.query.run==='string'?route.query.run:'');
const runs=ref([]),rows=ref([]),sessions=ref([]),loading=ref(false),error=ref(''),shown=ref(PAGE);
const selectedRun=computed(()=>runs.value.find(r=>r.id===run.value));

// Läufe wie auf /statistik per Dropdown und ?run=; ohne gültige Auswahl der erste nach sort.
async function loadRuns(){
 const {data,error:e}=await supabase.from('dob_trade_setup_runs').select('*').order('sort').order('id').limit(200);
 if(e){error.value=e.message;return false;}
 runs.value=data;
 if(!data.some(r=>r.id===run.value))run.value=data[0]?.id??'';
 return true;
}
async function load(){
 if(!run.value)return;
 loading.value=true;error.value='';
 const [trades,sessionRows,guardrailRow]=await Promise.all([
  fetchAllRows((from,to)=>supabase.from('dob_trade_setups').select('*').eq('instrument',instrument.value).eq('run_id',run.value)
   .order('entry_time',{ascending:false}).order('id').range(from,to)),
  supabase.from('sessions').select('label,from_minutes,to_minutes,days').eq('instrument',instrument.value).order('from_minutes').limit(200),
  supabase.from('dob_guardrails').select('*').eq('instrument',instrument.value).maybeSingle()]);
 loading.value=false;
 if(trades.error||sessionRows.error){error.value=(trades.error??sessionRows.error).message;return;}
 rows.value=trades.data;sessions.value=sessionRows.data;
 // Fehlt die Sperr-Konfig (Tabelle noch leer oder nicht lesbar), gilt „nichts gesperrt“.
 guardrails.value=dobGuardrailsFromRow(guardrailRow.error?null:guardrailRow.data);
}
// Setzt loadRuns den Lauf erst, lädt der watch; sonst hier, damit „Aktualisieren“ auch ohne Wechsel neu liest.
async function refresh(){const before=run.value;if(await loadRuns()&&run.value===before)await load();}
refresh();
watch([instrument,run],load);
// Links mit anderem ?run= bei schon offener Seite (gleiche Route, keine Neuinitialisierung).
watch(()=>route.query.run,value=>{if(typeof value==='string'&&value&&value!==run.value)run.value=value;});

const onlyPinned=ref(false);
const {pins,pinTarget,pinSaving,pinError,pinOf,openPin,savePin,removePin}=useDobTradePins(instrument,rows);
// Sichtungsstand je Trade (laufunabhängig wie die Pins): „Im Chart“ öffnet einen neuen Tab, beim Zurückkommen soll Philip sehen,
// welcher Trade zuletzt offen war und wie weit er ist. Nur Browser-Komfort, deshalb localStorage statt DB.
const seen=useLocalStorageRef('dobStatsSeen',[]),lastOpened=useLocalStorageRef('dobStatsLastOpened',null);
const seenKeys=computed(()=>new Set(seen.value));
const isLast=t=>dobTradePinKey(t)===lastOpened.value;
const chartReturn=dobReturnTracker();
function openChart(t){
 const key=dobTradePinKey(t);
 chartReturn.arm();
 lastOpened.value=key;
 if(!seenKeys.value.has(key))seen.value=[...seen.value,key];
 window.open(router.resolve(dobChartLink(t)).href,'_blank','noopener');
}
function resetSeen(){seen.value=[];lastOpened.value=null;}
// Nur bei der Rückkehr aus dem über „Im Chart“ geöffneten Tab, einmalig, zur zuletzt geöffneten Zeile, falls sie außer Sicht ist
// (auch hinter „Weitere anzeigen“). Früher hing das auch an `focus` und jedem Tabwechsel und riss die Seite bei Klicks nach unten.
async function revealLast(){
 if(!chartReturn.visibility(document.hidden)||!lastOpened.value)return;
 const index=listed.value.findIndex(isLast);
 if(index<0)return;
 if(index>=shown.value)shown.value=index+1;
 await nextTick();
 const el=document.querySelector('tr.last-opened'),box=el?.getBoundingClientRect();
 if(box&&(box.top<0||box.bottom>window.innerHeight))el.scrollIntoView({block:'center'});
}
onMounted(()=>document.addEventListener('visibilitychange',revealLast));
onUnmounted(()=>document.removeEventListener('visibilitychange',revealLast));
// Feste R-Ziele 2R/3R/4R/5R nebeneinander statt Auswahl; alte Links mit ?rA=&rB= laden weiter, die Parameter fallen weg.
const targets=computed(()=>DOB_STAT_TARGETS.map(k=>({name:String(k),k})));
watch([instrument,year,run],([i,y,r])=>{shown.value=PAGE;router.replace({query:{run:r,instrument:i,year:y}});},{immediate:true});

const years=computed(()=>[...new Set([year.value,...rows.value.map(r=>dobTradeMonth(r).slice(0,4))])].sort().reverse());
const yearRows=computed(()=>rows.value.filter(r=>dobTradeMonth(r).startsWith(year.value)));
// Sperr-Konfig (dob_guardrails, gleiche Funktion wie der Watcher): gesperrte Trades fallen aus Liste, Kacheln und Tabellen.
// Ansicht: der Entwurf aus dem Panel wirkt sofort (Vorschau), gespeichert und damit im Watcher ist nur `guardrails`.
// „Sperren anwenden“ schaltet nur die Ansicht und bleibt im Browser gemerkt.
const guardrails=ref(DOB_GUARDRAILS_DEFAULT),guardrailDraft=ref(DOB_GUARDRAILS_DEFAULT);
const guardrailsOpen=useLocalStorageRef('dobStatsGuardrailsOpen',false),applyGuardrails=useLocalStorageRef('dobStatsApplyGuardrails',true);
watch(guardrails,g=>{guardrailDraft.value=g;});
const draftUnsaved=computed(()=>JSON.stringify(guardrailDraft.value)!==JSON.stringify(guardrails.value));
const blockedOf=r=>dobRowGuardrailReason(guardrailDraft.value,r);
const inYear=computed(()=>applyGuardrails.value?yearRows.value.filter(r=>!blockedOf(r)):yearRows.value);
// „Nach Konfig“: jeder Trade mit dem TP seines Entry-Fensters (sonst Default-TP). Vergleich gegen alle Trades ohne Sperren mit dem
// Default-TP, also gegen „gar keine Konfig“ bei derselben Grund-TP.
// Ergebnis je Trade inkl. Teilprofit (dobRowConfigScore), dobRouteStats zählt dessen r.
const configTp=r=>dobRowConfigScore(guardrailDraft.value,r);
// Simulationskonto in R ganz oben: „Standard“ = alle Trades des Jahres mit TP 2R, ohne Sperren und Regeln, Route a+b zusammen;
// „Mit Konfig“ = Entwurf, wenn „Sperren anwenden“ an ist, sonst die gespeicherte Konfig. Gleiche Rechnung wie überall (dobRouteStats).
const accountConfig=computed(()=>applyGuardrails.value?guardrailDraft.value:guardrails.value);
const accountColumn=(label,list,k)=>({label,stats:dobTotalStats(list,k),perWeek:dobTradesPerWeek(list)});
const accountColumns=(list,k)=>[...DOB_HALVES.map(h=>accountColumn(h,list.filter(r=>dobTradeHalf(r)===h),k)),
 {...accountColumn('Gesamt',list,k),total:true}];
const accountStandard=computed(()=>accountColumns(yearRows.value,2));
const accountWithConfig=computed(()=>{
 const cfg=accountConfig.value;
 const list=yearRows.value.filter(r=>!dobRowGuardrailReason(cfg,r));
 return accountColumns(list,r=>dobRowConfigScore(cfg,r)).map((c,i)=>{const base=accountStandard.value[i].stats;
  return {...c,delta:{sumR:c.stats.sumR-base.sumR,winratePp:c.stats.winrate==null||base.winrate==null?null:(c.stats.winrate-base.winrate)*100}};});
});
const accountConfigLabel=computed(()=>dobGuardrailsSummary(accountConfig.value)+(applyGuardrails.value&&draftUnsaved.value?' · Entwurf':'')
 +(applyGuardrails.value?'':' · gespeicherter Stand'));
const configTotals=computed(()=>dobRouteStats(inYear.value,configTp));
const configBaseline=computed(()=>dobRouteStats(yearRows.value,guardrailDraft.value.defaultTpR));
const configDelta=r=>deltaOf(configTotals.value[r],configBaseline.value[r]);
// Delta der gefilterten zur ungefilterten Ansicht je Route und Ziel (Winrate in Prozentpunkten, ΣR), nur bei aktiven Sperren.
const unfiltered=computed(()=>Object.fromEntries(targets.value.map(t=>[t.name,dobRouteStats(yearRows.value,t.k)])));
const showDelta=computed(()=>applyGuardrails.value&&inYear.value.length<yearRows.value.length);
function deltaText(name,r){return deltaOf(totals.value[name][r],unfiltered.value[name][r]);}
function deltaOf(now,all){
 const pp=now.winrate==null||all.winrate==null?null:(now.winrate-all.winrate)*100;
 return `${pp==null?'–':`${pp>0?'+':pp<0?'−':'±'}${Math.abs(pp).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1})} Pkt`} · ${dobSignedR(now.sumR-all.sumR)} R`;
}
// Max-R-Filter (genaue Stufen, ODER) und Sortierung; ohne gespeichertes max_r (älterer Lauf-Stand) bleibt beides aus.
const maxRFilter=ref([]),maxRSort=ref(''),retestFilter=ref([]);
const hasRetest=computed(()=>inYear.value.some(r=>r.source_retest_kind));
const hasMaxR=computed(()=>inYear.value.some(r=>r.max_r!=null));
const maxRShares=computed(()=>dobMaxRShares(inYear.value));
const cycleMaxRSort=()=>{maxRSort.value={'':'desc',desc:'asc',asc:''}[maxRSort.value];};
const listed=computed(()=>{
 let list=onlyPinned.value?inYear.value.filter(pinOf):inYear.value;
 if(maxRFilter.value.length)list=list.filter(r=>maxRFilter.value.includes(dobMaxRBucket(r)));
 if(retestFilter.value.length)list=list.filter(r=>retestFilter.value.includes(r.source_retest_kind));
 if(!maxRSort.value)return list;
 const dir=maxRSort.value==='desc'?-1:1;
 return [...list].sort((a,b)=>(a.max_r??-1)===(b.max_r??-1)?b.entry_time-a.entry_time:dir*((a.max_r??-1)-(b.max_r??-1)));
});
watch([maxRFilter,maxRSort,retestFilter],()=>{shown.value=PAGE;});
const totals=computed(()=>Object.fromEntries(targets.value.map(t=>[t.name,dobRouteStats(inYear.value,t.k)])));
// Tabellen zeigen zusätzlich „Konfig“ (TP je Entry-Fenster), solange die Sperren angewendet werden; die Kacheln haben dafür ihre eigene.
const tableTargets=computed(()=>applyGuardrails.value?[...targets.value,{name:'config',label:'Konfig',k:configTp}]:targets.value);
const statsOf=list=>Object.fromEntries(tableTargets.value.map(t=>[t.name,dobRouteStats(list,t.k)]));
const sessionsOf=r=>{const s=dobTradeSessions(r,sessions.value);return s.length?s:['ohne Session'];};
// Winrate je Retest-Art der Kraftquelle (nur v2 befüllt), alle Routen zusammen, beide R-Ziele.
const retestTiles=computed(()=>Object.entries(DOB_RETEST_KINDS).map(([kind,label])=>{
 const list=inYear.value.filter(r=>r.source_retest_kind===kind);
 return {kind,label,n:list.length,targets:targets.value.map(t=>({...t,s:dobTotalStats(list,t.k)}))};
}).filter(t=>t.n));
// „Je …“-Tabellen, je ein-/ausklappbar (Zustand im Browser). Tageszeit statt Session-Liste: wann die Liquidität kommt, hängt an den
// Börsenöffnungen, deshalb Stunden unter ihren Sessions bzw. unter der Uhrzeit der Lücke dazwischen.
const tablesOpen=useLocalStorageRef('dobStatsTablesOpen',{});
const zoneTimeframe=ref('');
// SL-Vergleich in „Je Session und Stunde“: nur Trades mit Extrem-SL, eng (heute) gegen weit (ferne OB2-Kante), alle Routen zusammen,
// 3R und 5R vorn. n und Median-Risiko (eng/weit, USD) stehen in der Zeile, weil die Gruppen klein sind.
const slCompare=useLocalStorageRef('dobStatsSlCompare',false);
const SL_COMPARE_TARGETS=[3,5,2,4].flatMap(k=>[{name:`e${k}`,label:`eng ${k}R`,k},{name:`w${k}`,label:`weit ${k}R`,k,wide:true}]);
const fmtUsd=v=>v==null?'–':v.toLocaleString('de-DE',{maximumFractionDigits:1});
const compareStats=list=>Object.fromEntries(SL_COMPARE_TARGETS.map(t=>[t.name,{all:dobTotalStats(t.wide?list.map(dobAsWide):list,t.k)}]));
const compareLabel=(label,list)=>`${label} · n ${list.length} · Risiko ${fmtUsd(dobMedian(list.map(r=>Math.abs(r.entry_price-r.stop_price))))}/${fmtUsd(dobMedian(list.map(r=>r.wide_risk_usd)))} USD`;
const hasWide=computed(()=>inYear.value.some(dobHasWideVariant));
const timeTable=computed(()=>{
 if(!(slCompare.value&&hasWide.value))return {key:'time',title:'Je Session und Stunde',firstCol:'Entry (Berlin)',
  sections:dobTimeSlotGroups(inYear.value,sessions.value).map(g=>({title:g.title,stats:statsOf(g.rows),rows:g.slots.map(slot=>({key:slot.label,label:slot.label,stats:statsOf(slot.rows)}))}))};
 return {key:'time',title:'Je Session und Stunde',firstCol:'Entry (Berlin) · nur Extrem-SL',compare:true,
  sections:dobTimeSlotGroups(inYear.value.filter(dobHasWideVariant),sessions.value).map(g=>({title:compareLabel(g.title,g.rows),stats:compareStats(g.rows),
   rows:g.slots.map(slot=>({key:slot.label,label:compareLabel(slot.label,slot.rows),stats:compareStats(slot.rows)}))}))};
});
const tables=computed(()=>{
 const list=[
  timeTable.value,
  {key:'month',title:'Je Monat',firstCol:'Monat',sections:[{rows:dobGroups(inYear.value,r=>[dobTradeMonth(r)]).sort((a,b)=>a.key.localeCompare(b.key))
   .map(g=>({key:g.key,label:monthLabel(g.key),stats:statsOf(g.rows)}))}]},
  // Je Wochentag mit den Halbjahren darunter: die Gruppen sind klein, ein Effekt sollte in beiden Halbjahren tragen.
  {key:'weekday',title:'Je Wochentag',firstCol:'Entry-Tag (Berlin)',sections:DOB_WEEKDAYS.map(([day,label])=>({label,list:inYear.value.filter(r=>dobTradeWeekday(r)===day)}))
   .filter(d=>d.list.length).map(d=>({title:`${d.label} (${d.list.length})`,stats:statsOf(d.list),
    rows:DOB_HALVES.map(h=>{const part=d.list.filter(r=>dobTradeHalf(r)===h);return {key:h,label:`${h} (${part.length})`,stats:statsOf(part)};})}))}];
 if(inYear.value.some(dobZoneAgeBucket)){
  const aged=inYear.value.filter(r=>dobZoneAgeBucket(r)&&(!zoneTimeframe.value||r.source_kind===zoneTimeframe.value));
  list.push({key:'zoneAge',title:'Je Kraftquelle-OB-Alter',firstCol:'Zone bis Retest',sections:[{rows:DOB_ZONE_AGE_BUCKETS
   .map(([label])=>({key:label,label,list:aged.filter(r=>dobZoneAgeBucket(r)===label)})).filter(b=>b.list.length).map(b=>({...b,stats:statsOf(b.list)}))}]});
 }
 return list;
});
const computedAt=computed(()=>selectedRun.value?.computed_at);

const pct=dobPct,winTone=(v,k=2)=>dobWinTone(v,k);
const rLabel=k=>`${k.toLocaleString('de-DE')}R`;
const MONTHS=['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const monthLabel=key=>MONTHS[Number(key.slice(5))-1];
</script>
<template>
  <main class="dob-stats" :style="{'--positive':cssColor('candleUp'),'--negative':cssColor('candleDown')}">
    <header>
      <div><h1>DOB-Setup Statistik</h1><p>{{ selectedRun?.description??'Lauf wählen' }} · einmalige Trades (gleiche Richtung, Entry und SL zählen einmal)</p></div>
      <div class="controls">
        <label>Lauf <select v-model="run"><option value="" disabled>Lauf wählen</option><option v-for="r in runs" :key="r.id" :value="r.id">{{ r.label }}</option></select></label>
        <label>Instrument <select v-model="instrument"><option v-for="i in INSTRUMENTS" :key="i">{{ i }}</option></select></label>
        <label>Jahr <select v-model="year"><option v-for="y in years" :key="y">{{ y }}</option></select></label>
        <button type="button" :disabled="loading" @click="refresh">{{ loading?'Wird geladen…':'Aktualisieren' }}</button>
      </div>
    </header>
    <section v-if="!loading&&!error&&yearRows.length" class="accounts" aria-label="Simulationskonto in R">
      <DobAccountTile title="Standard" :subtitle="`TP 2R · keine Sperren · Route a + b · ${year}`" :columns="accountStandard" />
      <DobAccountTile title="Mit Konfig" :subtitle="accountConfigLabel" :columns="accountWithConfig" />
    </section>
    <DobGuardrailsPanel v-if="!loading&&!error&&yearRows.length" :instrument="instrument" :config="guardrails" :rows="yearRows" :targets="targets"
      :open="guardrailsOpen" @toggle="v=>{guardrailsOpen=v;}" @saved="c=>{guardrails=c;}" v-model:apply="applyGuardrails" @update:draft="d=>{guardrailDraft=d;}" />
    <p v-if="!loading&&!error&&yearRows.length>inYear.length" class="note" role="status">{{ yearRows.length-inYear.length }} von {{ yearRows.length }} Trades durch die Sperren{{ draftUnsaved?' (Entwurf, nicht gespeichert)':'' }} ausgeblendet; alle Kennzahlen, Tabellen und die Tradeliste zeigen nur erlaubte Trades.</p>
    <p v-if="error" role="alert" class="error">{{ error }} <button @click="refresh">Erneut versuchen</button></p>
    <p v-else-if="loading" role="status" class="note">Trades werden geladen…</p>
    <p v-else-if="!runs.length" role="status" class="note">Noch keine berechneten DOB-Läufe.</p>
    <p v-else-if="!inYear.length" role="status" class="note">Keine erlaubten Trades für {{ selectedRun?.label }} · {{ instrument }} {{ year }}.</p>
    <template v-else>
      <section class="tiles" aria-label="Gesamt je Route">
        <article v-for="r in ROUTES" :key="r" class="tile">
          <h2>Route {{ r }}</h2>
          <div class="targets"><div v-for="t in targets" :key="t.name">
            <p class="note">{{ rLabel(t.k) }} · BE {{ pct(dobBreakEven(t.k)) }}</p>
            <p class="big" :class="winTone(totals[t.name][r].winrate,t.k)">{{ pct(totals[t.name][r].winrate) }}</p>
            <p>{{ totals[t.name][r].success }} W / {{ totals[t.name][r].loss }} L · <span :class="pnlClass(totals[t.name][r].sumR)">{{ dobSignedR(totals[t.name][r].sumR) }} R</span></p>
            <p class="note" title="offen: bis Datenende weder Ziel noch SL · unklar: SL und Ziel in derselben Kerze oder fehlende Kerzen">offen {{ totals[t.name][r].open }} · unklar {{ totals[t.name][r].ambiguous+totals[t.name][r].unknown }}</p>
            <p v-if="showDelta" class="delta" title="Unterschied zur Ansicht ohne Sperren">{{ deltaText(t.name,r) }}</p>
          </div></div>
        </article>
        <article class="tile config-tile">
          <h2>Nach Konfig</h2>
          <p class="note">TP je Entry-Fenster, sonst {{ guardrailDraft.defaultTpR.toLocaleString('de-DE') }}R{{ draftUnsaved?' · Entwurf':'' }}</p>
          <div class="targets"><div v-for="r in ROUTES" :key="r">
            <p class="note">Route {{ r }}</p>
            <p class="big">{{ pct(configTotals[r].winrate) }}</p>
            <p>{{ configTotals[r].success }} W / {{ configTotals[r].loss }} L · <span :class="pnlClass(configTotals[r].sumR)">{{ dobSignedR(configTotals[r].sumR) }} R</span></p>
            <p class="delta" title="gegen alle Trades ohne Sperren mit Default-TP">{{ configDelta(r) }}</p>
          </div></div>
        </article>
        <article v-if="retestTiles.length" class="tile">
          <h2>Retest der Kraftquelle</h2>
          <div v-for="r in retestTiles" :key="r.kind" class="retest">
            <p class="note">{{ r.label }} · {{ r.n }} Trades</p>
            <p><span v-for="t in r.targets" :key="t.name" class="retest-target">{{ rLabel(t.k) }} <DobStatCell :stats="t.s" :k="t.k" /></span></p>
          </div>
        </article>
        <article v-if="hasMaxR" class="tile">
          <h2>Max R</h2>
          <p class="big">{{ pct(maxRShares.r3) }} <small>≥ 3R</small></p>
          <p>≥ 4R {{ pct(maxRShares.r4) }} · 5R {{ pct(maxRShares.r5) }}</p>
          <p class="note">Anteil der {{ maxRShares.n }} entschiedenen Trades, die die Stufe vor dem SL erreicht hätten.</p>
        </article>
      </section>
      <p class="note">Ziel k: Win, wenn k vor dem SL erreicht wurde (+k R), Loss, wenn der SL vorher kam (−1 R), offen, wenn bis Datenende keins von beiden; Break-even = 1/(1+k). Winrate = Win / (Win + Loss). Zellen: Winrate · Σ R, Details im Tooltip. Ziel 2R entspricht dem bisherigen Ausgang. Jahr und Monat nach Erkennung des Paars, Session und Stunde nach Entry-Zeit (Europe/Berlin).<template v-if="computedAt"> Stand der Berechnung: {{ formatDatedTime(Date.parse(computedAt)/1000) }}.</template></p>

      <template v-for="table in tables" :key="table.key">
        <DobStatsTable :title="table.title" :first-col="table.firstCol" :sections="table.sections" :targets="table.compare?SL_COMPARE_TARGETS:tableTargets" :routes="table.compare?['all']:undefined"
          :open="tablesOpen[table.key]??true" @toggle="open=>{if((tablesOpen[table.key]??true)!==open)tablesOpen={...tablesOpen,[table.key]:open};}">
          <template v-if="table.key==='time'&&hasWide" #controls><label title="nur Trades mit SL am Retest-Extrem; weit = SL an der fernen OB2-Kante, Entry gleich, Ziele aus dem weiten Risiko"><input v-model="slCompare" type="checkbox"> SL-Vergleich eng gegen weit</label></template>
          <template v-if="table.key==='zoneAge'" #controls><label>Zeitrahmen der Zone <select v-model="zoneTimeframe"><option value="">H1 + H4</option><option value="ob_h1">H1</option><option value="ob_h4">H4</option></select></label></template>
        </DobStatsTable>
      </template>

      <section>
        <h2>Trades ({{ listed.length }})</h2>
        <p class="note">Rechtsklick oder ⚑-Knopf pinnt einen Trade mit Kommentar. <label><input v-model="onlyPinned" type="checkbox"> nur gepinnte ({{ pins.length }})</label>
          · gesehen {{ inYear.filter(t=>seenKeys.has(dobTradePinKey(t))).length }} von {{ inYear.length }}
          <button v-if="seen.length||lastOpened" type="button" class="pin" @click="resetSeen">Gesehen zurücksetzen</button></p>
        <fieldset v-if="hasMaxR" class="max-r-filter"><legend>Max R (genaue Stufe, mehrere = oder)</legend>
          <label v-for="level in DOB_MAX_R_FILTERS" :key="level"><input v-model="maxRFilter" type="checkbox" :value="level"> {{ level==='<2'?'< 2R':dobMaxRLabel(Number(level)) }}</label>
          <button v-if="maxRFilter.length" type="button" class="pin" @click="maxRFilter=[]">alle</button>
        </fieldset>
        <fieldset v-if="hasRetest" class="max-r-filter"><legend>Retest der Kraftquelle (mehrere = oder)</legend>
          <label v-for="(label,kind) in DOB_RETEST_KINDS" :key="kind"><input v-model="retestFilter" type="checkbox" :value="kind"> {{ label }}</label>
        </fieldset>
        <p v-if="pinError&&!pinTarget" role="alert" class="error">{{ pinError }}</p>
        <div class="scroll"><table>
          <thead><tr><th scope="col">Entry</th><th scope="col">Richtung</th><th scope="col">Route</th><th scope="col">Ausgang</th><th scope="col">R (Konfig)</th><th scope="col">Session</th><th scope="col">Kraftquelle</th><th scope="col" :aria-sort="maxRSort==='desc'?'descending':maxRSort==='asc'?'ascending':'none'"><button type="button" class="sort" @click="cycleMaxRSort">Max R {{ maxRSort==='desc'?'▼':maxRSort==='asc'?'▲':'↕' }}</button></th><th scope="col">Chart</th><th scope="col">Pin</th></tr></thead>
          <tbody><tr v-for="t in listed.slice(0,shown)" :key="t.id" :class="{'last-opened':isLast(t)}" @contextmenu.prevent="openPin(t)">
            <td><SimulationPinFlag v-if="pinOf(t)" :note="pinOf(t).note||undefined" />{{ formatDatedTime(t.entry_time) }}</td><td>{{ t.direction==='long'?'Long':'Short' }}</td><td>{{ t.route }}</td>
            <td>{{ DOB_OUTCOME_LABELS[t.outcome]??t.outcome }}<template v-if="t.exit_time"> · {{ formatDatedTime(t.exit_time) }}</template></td>
            <td :class="pnlClass(configTp(t).r)" :title="`TP nach Konfig ${configTp(t).target}R`">{{ configTp(t).r==null?'–':fmtR(configTp(t).r) }}<template v-if="configTp(t).label"> ({{ configTp(t).label }})</template></td><td>{{ sessionsOf(t).join(', ') }}</td><td>{{ dobSourceLabel(t) }}</td>
            <td class="max-r"><span class="bar" :title="`Max R ${dobMaxRLabel(t.max_r)}`"><i :style="{width:`${Math.min(t.max_r??0,5)/5*100}%`}" :class="{hit:(t.max_r??0)>=2}"></i></span> {{ dobMaxRLabel(t.max_r) }}</td>
            <td><button type="button" class="chart" :class="{seen:seenKeys.has(dobTradePinKey(t))}" :aria-label="`DOB ${formatDatedTime(t.entry_time)} im Chart öffnen${seenKeys.has(dobTradePinKey(t))?' (gesehen)':''}`" @click="openChart(t)">{{ seenKeys.has(dobTradePinKey(t))?'✓ Im Chart':'Im Chart' }}</button></td>
            <td><button type="button" class="pin" :aria-label="`DOB ${formatDatedTime(t.entry_time)} ${pinOf(t)?'Pin bearbeiten':'anpinnen'}`" @click="openPin(t)">{{ pinOf(t)?'⚑ bearbeiten':'⚑' }}</button></td>
          </tr></tbody>
        </table></div>
        <button v-if="shown<listed.length" type="button" class="more" @click="shown+=PAGE">Weitere {{ Math.min(PAGE,listed.length-shown) }} anzeigen</button>
      </section>
    </template>
    <SimulationPinMenu :target="pinTarget" :saving="pinSaving" :error="pinError" @close="pinTarget=null" @save="savePin" @remove="removePin" @show-pins="onlyPinned=true;pinTarget=null" />
  </main>
</template>
<style scoped>
.dob-stats{padding:24px;color:#d1d4dc;max-width:1600px;width:100%;box-sizing:border-box;margin:0 auto}header{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:20px}h1{margin:0;font-size:20px;font-weight:600}h2{font-size:15px;font-weight:600;margin:24px 0 8px}header p,.note{font-size:13px;color:#b1b7c5}.controls{display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:13px}select,button{background:#1e222d;color:#d1d4dc;border:1px solid #434651;padding:6px 10px;border-radius:4px}button{cursor:pointer}button:disabled{opacity:.6;cursor:wait}.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.tile{background:#1e222d;border:1px solid #2a2e39;border-radius:4px;padding:16px}.tile h2{margin:0 0 4px}.tile p{margin:4px 0;font-size:13px}.targets{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.targets .big{font-size:22px!important}.tiles .tile:has(.targets){grid-column:span 2}@media(max-width:900px){.tiles .tile:has(.targets){grid-column:auto}.targets{grid-template-columns:1fr 1fr}}.big{font-size:28px!important;font-weight:600}.scroll{overflow-x:auto}table{border-collapse:collapse;font-size:13px;min-width:100%}th,td{padding:6px 10px;border-bottom:1px solid #2a2e39;text-align:right;white-space:nowrap}th[scope=row],thead th:first-child,tbody td:first-child{text-align:left}a{color:#91b8ff}.positive{color:var(--positive)}.negative{color:var(--negative)}.error{color:#ff8b91}.more{margin-top:12px}tr.last-opened{background:rgba(145,184,255,.24);box-shadow:inset 4px 0 0 #91b8ff;font-weight:600}.accounts{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:12px;margin-bottom:8px}@media(max-width:600px){.accounts{grid-template-columns:1fr}}.retest{margin-top:6px}.delta{font-size:12px!important;color:#91b8ff}.config-tile .targets{grid-template-columns:1fr 1fr}.retest-target{margin-right:12px}.max-r-filter{border:1px solid #2a2e39;border-radius:4px;margin:8px 0;padding:6px 10px;font-size:13px;display:flex;gap:12px;flex-wrap:wrap;align-items:center}.max-r-filter legend{color:#b1b7c5;padding:0 4px}button.sort{background:none;border:0;padding:0;color:inherit;font:inherit;font-weight:600}td.max-r{text-align:left}.bar{display:inline-block;vertical-align:middle;width:70px;height:8px;border-radius:4px;background:repeating-linear-gradient(90deg,#2a2e39 0 6px,#1e222d 6px 7px);position:relative;overflow:hidden}.bar::after{content:'';position:absolute;left:40%;top:0;bottom:0;width:1px;background:#b1b7c5}.bar i{display:block;height:100%;background:var(--negative)}.bar i.hit{background:var(--positive)}button.chart{padding:2px 10px;border-color:#91b8ff;color:#91b8ff}button.chart.seen{border-color:#434651;color:#7f8696}.pin{padding:2px 8px}:is(button,select,a):focus-visible{outline:2px solid #91b8ff;outline-offset:2px}@media(max-width:600px){.dob-stats{padding:12px}}
</style>
