import {it,expect,vi} from 'vitest';
import {createSSRApp} from 'vue';
import {renderToString} from 'vue/server-renderer';
import {createRouter,createMemoryHistory} from 'vue-router';
import {liveWatcherRun,liveWatcherSnapshots,liveWatcherEntryResults} from '../src/liveWatcherSnapshots.js';
import {reviewGroups} from '../src/simulationRunComparison.js';
const fixture=vi.hoisted(()=>({run:null,groups:[],results:[]}));
vi.mock('../src/supabaseClient.js',()=>({supabase:{}}));
vi.mock('../src/composables/useSimulationComparison.js',async()=>{
 const {ref}=await import('vue');
 return {useSimulationComparison:()=>({runs:ref([fixture.run]),selectedRun:ref(fixture.run),comparisonRun:ref(null),current:ref({groups:fixture.groups,results:fixture.results}),previous:ref({groups:[],results:[]}),datasets:ref(new Map([[fixture.run.id,{groups:fixture.groups,results:fixture.results}]])),loading:ref(false),error:ref(''),dateError:ref(''),refresh:vi.fn()})};
});
vi.mock('../src/composables/useSimulationPins.js',async()=>{
 const {ref}=await import('vue');
 return {useSimulationPins:()=>({pins:ref([]),associatedPins:ref([]),listedPins:ref([]),unmatchedPins:ref([]),error:ref(''),loading:ref(false),saving:ref(false),target:ref(null),refresh:vi.fn(),isPinned:()=>false,pinNote:()=>undefined,open:vi.fn(),save:vi.fn(),remove:vi.fn(),removeListed:vi.fn(),editListed:vi.fn()})};
});
import Statistik from '../src/views/Statistik.vue';
it.each(['ordinary','live','catchup'])('routes %s source through the existing statistics cards, table, metrics and filters',async source=>{
 const id=source==='ordinary'?'saved-run':'live-watcher:2026-10'+(source==='catchup'?':catchup':'');
 fixture.run=source!=='ordinary'?liveWatcherRun({id}):{id,status:'complete',from:1790812800,to:1790899200,configuration:{label:'Original run'}};
 const event={id:'original-event',stage:3,kind:'trading',setup_key:'EURUSD:setup1:16107',instrument:'EURUSD',direction:'short',signal_at:'2026-10-09T07:28:00Z',payload:{entry:{id:'original-entry',recognizedAt:1791530880,entryCategory:'risky',price:1.12},variants:[]}};
 if(source==='catchup')event.payload.provenance={evaluationMode:'catchup'};
 const snapshots=liveWatcherSnapshots([event],source==='ordinary'?'live-watcher:2026-10':id).map(s=>({...s,runId:id}));fixture.groups=reviewGroups(snapshots);fixture.results=snapshots.flatMap(liveWatcherEntryResults);
 const router=createRouter({history:createMemoryHistory(),routes:[{path:'/statistik',component:Statistik},{path:'/',component:{template:'<div/>'}}]});await router.push({path:'/statistik',query:{run:id}});
 const app=createSSRApp(Statistik);app.use(router);const html=await renderToString(app);
 expect(html).toContain('class="dr-list"');expect(html).toContain('class="dr-card"');expect(html).toContain('class="entry-scroll"');expect(html).toContain('class="metric-grid"');expect(html).toContain('class="statistics-filters"');expect(html).toContain('DR-Ausgang');expect(html).toContain('Ergebnis nicht gespeichert');expect(html).toContain('setup2=original-entry');
 if(source!=='ordinary'){expect(html).toContain(source==='catchup'?'Nachholerkennung':'Originale Live-Erkennungen');expect(html).not.toContain('Nur ereignisbelegte DRs');}
 expect(html).not.toContain('class="live-month"');expect(html).not.toContain('/live-watcher-entry');
});
