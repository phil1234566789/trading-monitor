<script setup>
import {computed,ref,watch} from 'vue';
import {useRoute,useRouter} from 'vue-router';
import {supabase} from '../supabaseClient.js';
import {fetchAllRows} from '../dbReadPaging.js';
import {DOB_TRADE_SETUP_VERSION} from '../dobTradeSetup.js';
import {dobRouteStats,dobGroups,dobTradeMonth,dobTradeSessions,dobChartLink,dobTradeR,DOB_BREAK_EVEN_WINRATE} from '../dobTradeStatistics.js';
import {formatDatedTime} from '../berlinTime.js';
import {fmtPrice,fmtR,pnlClass} from '../format.js';
import {cssColor} from '../chartColors.js';

// Die Seite rechnet nichts nach, sie liest nur die vorberechneten Trades (scripts/dobTradeSetupsFill.mjs) und zählt sie.
const INSTRUMENTS=['XAUUSD'],ROUTES=['a','b'],PAGE=200;
const route=useRoute(),router=useRouter();
const instrument=ref(INSTRUMENTS.includes(route.query.instrument)?route.query.instrument:'XAUUSD');
const year=ref(String(route.query.year??new Date().getFullYear()));
const rows=ref([]),sessions=ref([]),loading=ref(false),error=ref(''),shown=ref(PAGE);

async function load(){
 loading.value=true;error.value='';
 const [trades,sessionRows]=await Promise.all([
  fetchAllRows((from,to)=>supabase.from('dob_trade_setups').select('*').eq('instrument',instrument.value).eq('version',DOB_TRADE_SETUP_VERSION)
   .order('entry_time',{ascending:false}).order('id').range(from,to)),
  supabase.from('sessions').select('label,from_minutes,to_minutes,days').eq('instrument',instrument.value).order('from_minutes').limit(200)]);
 loading.value=false;
 if(trades.error||sessionRows.error){error.value=(trades.error??sessionRows.error).message;return;}
 rows.value=trades.data;sessions.value=sessionRows.data;
}
watch(instrument,load,{immediate:true});
watch([instrument,year],([i,y])=>{shown.value=PAGE;router.replace({query:{instrument:i,year:y}});});

const years=computed(()=>[...new Set([year.value,...rows.value.map(r=>dobTradeMonth(r).slice(0,4))])].sort().reverse());
const inYear=computed(()=>rows.value.filter(r=>dobTradeMonth(r).startsWith(year.value)));
const total=computed(()=>dobRouteStats(inYear.value));
const sessionsOf=r=>{const s=dobTradeSessions(r,sessions.value);return s.length?s:['ohne Session'];};
const sessionOrder=computed(()=>[...sessions.value.map(s=>s.label),'ohne Session']);
const bySession=computed(()=>dobGroups(inYear.value,sessionsOf).sort((a,b)=>sessionOrder.value.indexOf(a.key)-sessionOrder.value.indexOf(b.key)));
const byMonth=computed(()=>dobGroups(inYear.value,r=>[dobTradeMonth(r)]).sort((a,b)=>a.key.localeCompare(b.key)));
const computedAt=computed(()=>rows.value[0]?.computed_at);

const pct=v=>v==null?'–':`${(v*100).toFixed(1)} %`;
const winTone=v=>v==null?'':v>DOB_BREAK_EVEN_WINRATE?'positive':v<DOB_BREAK_EVEN_WINRATE?'negative':'';
const OUTCOME_LABELS={success:'Win',loss:'Loss',open:'offen',ambiguous:'uneindeutig',unknown:'unbekannt'};
const MONTHS=['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const monthLabel=key=>MONTHS[Number(key.slice(5))-1];
</script>
<template>
  <main class="dob-stats" :style="{'--positive':cssColor('candleUp'),'--negative':cssColor('candleDown')}">
    <header>
      <div><h1>DOB-Setup Statistik</h1><p>{{ DOB_TRADE_SETUP_VERSION }} · DOB + TP 2R · einmalige Trades (gleiche Richtung, Entry und SL zählen einmal)</p></div>
      <div class="controls">
        <label>Instrument <select v-model="instrument"><option v-for="i in INSTRUMENTS" :key="i">{{ i }}</option></select></label>
        <label>Jahr <select v-model="year"><option v-for="y in years" :key="y">{{ y }}</option></select></label>
        <button type="button" :disabled="loading" @click="load">{{ loading?'Wird geladen…':'Aktualisieren' }}</button>
      </div>
    </header>
    <p v-if="error" role="alert" class="error">{{ error }} <button @click="load">Erneut versuchen</button></p>
    <p v-else-if="loading" role="status" class="note">Trades werden geladen…</p>
    <p v-else-if="!inYear.length" role="status" class="note">Keine berechneten Trades für {{ instrument }} {{ year }}.</p>
    <template v-else>
      <section class="tiles" aria-label="Gesamt je Route">
        <article v-for="r in ROUTES" :key="r" class="tile">
          <h2>Route {{ r }}</h2>
          <p class="big" :class="winTone(total[r].winrate)">{{ pct(total[r].winrate) }}</p>
          <p>{{ total[r].success+total[r].loss }} Trades · {{ total[r].success }} W / {{ total[r].loss }} L · <span :class="pnlClass(total[r].sumR)">{{ fmtR(total[r].sumR) }}</span></p>
          <p class="note">offen {{ total[r].open }} · uneindeutig/unbekannt {{ total[r].ambiguous+total[r].unknown }}</p>
        </article>
      </section>
      <p class="note">Break-even bei 2R: 33,3 % Winrate. Winrate = Win / (Win + Loss); offene, uneindeutige und unbekannte Ausgänge zählen nicht. Jahr und Monat nach Erkennung des Paars, Session nach Entry-Zeit (Europe/Berlin). Ein Entry in überlappenden Sessions zählt in jeder.<template v-if="computedAt"> Stand der Berechnung: {{ formatDatedTime(Date.parse(computedAt)/1000) }}.</template></p>

      <section v-for="[title,groups,labelOf] in [['Je Session',bySession,k=>k],['Je Monat',byMonth,monthLabel]]" :key="title">
        <h2>{{ title }}</h2>
        <div class="scroll"><table>
          <thead><tr><th scope="col" rowspan="2">{{ title.slice(3) }}</th><th v-for="r in ROUTES" :key="r" scope="colgroup" colspan="3">Route {{ r }}</th></tr>
            <tr><template v-for="r in ROUTES" :key="r"><th scope="col">Winrate</th><th scope="col">W / L</th><th scope="col">Σ R</th></template></tr></thead>
          <tbody><tr v-for="g in groups" :key="g.key"><th scope="row">{{ labelOf(g.key) }}</th>
            <template v-for="r in ROUTES" :key="r"><td :class="winTone(g.routes[r].winrate)">{{ pct(g.routes[r].winrate) }}</td><td>{{ g.routes[r].success }} / {{ g.routes[r].loss }}</td><td :class="pnlClass(g.routes[r].sumR)">{{ fmtR(g.routes[r].sumR) }}</td></template></tr></tbody>
        </table></div>
      </section>

      <section>
        <h2>Trades ({{ inYear.length }})</h2>
        <div class="scroll"><table>
          <thead><tr><th scope="col">Entry</th><th scope="col">Richtung</th><th scope="col">Route</th><th scope="col">Entry</th><th scope="col">SL</th><th scope="col">TP 2R</th><th scope="col">Ausgang</th><th scope="col">R</th><th scope="col">Session</th><th scope="col">Chart</th></tr></thead>
          <tbody><tr v-for="t in inYear.slice(0,shown)" :key="t.id">
            <td>{{ formatDatedTime(t.entry_time) }}</td><td>{{ t.direction==='long'?'Long':'Short' }}</td><td>{{ t.route }}</td>
            <td>{{ fmtPrice(t.entry_price) }}</td><td>{{ fmtPrice(t.stop_price) }}</td><td>{{ fmtPrice(t.target_price) }}</td>
            <td>{{ OUTCOME_LABELS[t.outcome]??t.outcome }}<template v-if="t.exit_time"> · {{ formatDatedTime(t.exit_time) }}</template></td>
            <td :class="pnlClass(dobTradeR(t))">{{ dobTradeR(t)==null?'–':fmtR(dobTradeR(t)) }}</td><td>{{ sessionsOf(t).join(', ') }}</td>
            <td><RouterLink :to="dobChartLink(t)" target="_blank" rel="noopener noreferrer" :aria-label="`DOB ${formatDatedTime(t.entry_time)} im Chart öffnen`">Im Chart</RouterLink></td>
          </tr></tbody>
        </table></div>
        <button v-if="shown<inYear.length" type="button" class="more" @click="shown+=PAGE">Weitere {{ Math.min(PAGE,inYear.length-shown) }} anzeigen</button>
      </section>
    </template>
  </main>
</template>
<style scoped>
.dob-stats{padding:24px;color:#d1d4dc;max-width:1600px;width:100%;box-sizing:border-box;margin:0 auto}header{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:20px}h1{margin:0;font-size:20px;font-weight:600}h2{font-size:15px;font-weight:600;margin:24px 0 8px}header p,.note{font-size:13px;color:#b1b7c5}.controls{display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:13px}select,button{background:#1e222d;color:#d1d4dc;border:1px solid #434651;padding:6px 10px;border-radius:4px}button{cursor:pointer}button:disabled{opacity:.6;cursor:wait}.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.tile{background:#1e222d;border:1px solid #2a2e39;border-radius:4px;padding:16px}.tile h2{margin:0 0 4px}.tile p{margin:4px 0;font-size:13px}.big{font-size:28px!important;font-weight:600}.scroll{overflow-x:auto}table{border-collapse:collapse;font-size:13px;min-width:100%}th,td{padding:6px 10px;border-bottom:1px solid #2a2e39;text-align:right;white-space:nowrap}th[scope=row],thead th:first-child,tbody td:first-child{text-align:left}a{color:#91b8ff}.positive{color:var(--positive)}.negative{color:var(--negative)}.error{color:#ff8b91}.more{margin-top:12px}:is(button,select,a):focus-visible{outline:2px solid #91b8ff;outline-offset:2px}@media(max-width:600px){.dob-stats{padding:12px}}
</style>
