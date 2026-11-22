import {ref} from 'vue';
import {usePriceChartTradeSetups} from './usePriceChartTradeSetups.js';
import {loadLsReactionContext} from '../lsReactionContextLoader.js';
import {sessions} from '../sessions.js';
import {createLsReactionWorker} from '../lsReactionWorkerClient.js';
import {closedChecklistCandles} from '../tradeSetupChecklistTimeBasis.js';
import {mergeCandles} from '../candleCache.js';
import {TRADE_SETUP_OB_SWEEP_PROFILE} from '../tradeSetup.js';
import {restoreTradeSetupSourceReferences} from '../../supabase/functions/_shared/tradeSetupSourceSnapshot.js';

export {LS_REACTION_CONTEXT_COUNTS} from '../lsReactionContextLoader.js';

export function usePriceChartLsReaction({worker=createLsReactionWorker(),onUpdate}={}) {
  const status=ref('LS-Reaktion: Trendkontext noch nicht geladen.'),assessments=ref([]),chain=ref(null);
  let context={symbol:null,h1:[],d1:[]},revision=0,evaluation=0,disposed=false,loadState='idle',loadError=null,pendingInput=null;
  const base=usePriceChartTradeSetups({sweepSourceProfile:TRADE_SETUP_OB_SWEEP_PROFILE,onEvaluated:onUpdate,async evaluateCandidates(setups,input){
    const request=++evaluation;
    status.value='LS-Reaktion: Trend-Policy wird im Hintergrund geprüft …';
    try {
    const result=await worker.run({setups,...input,includeChain:true,sessionConfigs:sessions.filter(s=>s.instrument===input.instrument)});
    if(disposed||request!==evaluation)return [];
    assessments.value=result.assessments;chain.value=result.chain??null;
    const {passed,unmet,unknown}=result.counts;
    status.value=`LS-Reaktion: ${passed} passend · ${unmet} verworfen`+(unknown?` · ${unknown} Trenddaten unbekannt`:'');
    if(result.status==='unknown'&&!unknown)status.value+=' · Trendkontext unvollständig';
    // JSON-Workertransport verliert Infinity und gemeinsame Objektreferenzen; die Chartquelle bleibt original.
    const original=new Map(setups.map(s=>[`${input.instrument}:${s.dir}:${s.obStartTime}`,s]));
    return result.assessments.filter(a=>a.status==='passed').map(a=>({...original.get(a.setupKey),
      ...(a.evaluatedSetupProjection?restoreTradeSetupSourceReferences(a.evaluatedSetupProjection):{}),
      sourceSnapshotContext:{evaluationAsOf:input.evaluatedAt,
        canonicalSetupKnownAt:a.trendEvidence.sourceTimes?.nativeGeometryKnownAt,
        configuration:{...original.get(a.setupKey)?.detectionConfiguration,settings:input.settings}},
      trendEvaluationVersion:result.version,trendEvaluationSourceProfile:a.trendEvidence.sourceProfile,trendEvidence:a.trendEvidence}));
    } catch(error) {
      if(!disposed&&request===evaluation){assessments.value=[];status.value=error.name==='AbortError'?'LS-Reaktion: Trenddaten werden neu geprüft.':'LS-Reaktion: Trendprüfung nicht verfügbar.';}
      return [];
    }
  }});
  function computeTradeSetups(input) {
    if(disposed)return;
    if(loadState==='loading'){
      pendingInput=input;
      const held=base.holdsFor(input.symbol,input.evaluatedAt);
      base.invalidate({symbol:input.symbol,evaluatedAt:input.evaluatedAt});
      if(!held)status.value='LS-Reaktion: Native M5-/H1-/D1-Daten laden …';return;
    }
    if(loadState==='error'){base.invalidate();status.value=loadError;return;}
    const matching=context.symbol===input.symbol;
    if(!input.candles.length){evaluation++;worker.cancel();assessments.value=[];status.value='LS-Reaktion: M5-Daten fehlen.';}
    return base.computeTradeSetups({...input,policyContext:{
      // Längere Ankerhistorie des Loaders vorne anfügen, sonst bleibt LS-Reaktion bei altem D1-Anker unbekannt.
      instrument:input.symbol,m5Candles:matching&&context.m5?mergeCandles(context.m5,input.candles):input.candles,evaluatedAt:input.evaluatedAt,settings:input.settings??{},
      sweepSourceProfile:TRADE_SETUP_OB_SWEEP_PROFILE,
      h1Candles:matching?context.h1:[],d1Candles:matching?context.d1:[],
    }});
  }
  async function fetchM5Candles(input) {
    const request=++revision;
    loadState='loading';loadError=null;pendingInput=null;
    // Poll am selben Symbol/Stand: letzte Setups und Bewertungen sichtbar lassen, bis neue fertig sind.
    const held=base.holdsFor(input.symbol,input.evaluatedAt);
    evaluation++;worker.cancel();base.invalidate({symbol:input.symbol,evaluatedAt:input.evaluatedAt});
    if(!held){assessments.value=[];status.value='LS-Reaktion: Native M5-/H1-/D1-Daten laden …';}
    onUpdate?.();
    const loadContext=async()=>{
      try {
        const loaded=await loadLsReactionContext(input);
        if(request===revision)context=loaded;
      } catch {
        if(request===revision){context={symbol:input.symbol,h1:[],d1:[]};loadError='LS-Reaktion: Trenddaten nicht verfügbar.';}
      }
    };
    const [result]=await Promise.all([base.fetchM5Candles(input),loadContext()]);
    if(request===revision){
      if(!result.ok)loadError='LS-Reaktion: M5-Daten nicht verfügbar.';
      loadState=loadError?'error':'ready';
      if(loadError)status.value=loadError;
      const queued=pendingInput;pendingInput=null;
      // H1 kann vor dem Kontext fertig sein; dieser eine wartende Stand braucht keinen UI-Klick zum Neustart.
      if(!loadError&&result.applied&&queued?.symbol===input.symbol)computeTradeSetups({...queued,
        candles:closedChecklistCandles(base.getM5Candles(),'5m',queued.evaluatedAt)});
    }
    return request===revision?result:{ok:true,applied:false};
  }
  function dispose(){disposed=true;revision++;evaluation++;base.invalidate();worker.dispose();}
  return {...base,computeTradeSetups,fetchM5Candles,status,assessments,chain,dispose};
}
