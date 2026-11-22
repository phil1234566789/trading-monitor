import {supabase} from './supabaseClient.js';
import {assertTradeSetupSourceSnapshot,captureTradeSetupSourceSnapshot} from '../supabase/functions/_shared/tradeSetupSourceSnapshot.js';
import {tradeSetupProvenance} from '../supabase/functions/_shared/tradeSetupProvenance.js';

const identity='trade_setup_id,source_profile,settings_hash,canonical_setup_known_at,evaluation_as_of';
const contentHash=async payload=>(await tradeSetupProvenance({source:'manual',configuration:payload})).config_hash;

export async function captureCurrentTradeSetupSources(setup,instrument){
 if(setup.persistedSourceSnapshot){
  const frozen=assertTradeSetupSourceSnapshot(setup.persistedSourceSnapshot);
  if(frozen.instrument!==instrument||frozen.setup.dir!==setup.dir||frozen.setup.obStartTime!==setup.obStartTime
   ||frozen.setup.obTop!==setup.obTop||frozen.setup.obBottom!==setup.obBottom)
   throw new Error('Der Quellen-Snapshot gehört nicht zum ausgewählten Setup.');
  return frozen;
 }
 const {sourceSnapshotContext,...canonical}=setup;
 if(!sourceSnapshotContext){
  if(setup.sweepSourceProfile||setup.trendEvaluationSourceProfile||setup.ls?.sourceKind==='orderBlock')
   throw new Error('Der native Auswertungskontext des LS-Reaktion-Snapshots fehlt.');
  return null;
 }
 return captureTradeSetupSourceSnapshot({setup:canonical,instrument,
  sourceProfile:canonical.trendEvaluationSourceProfile??canonical.sweepSourceProfile,
  ...sourceSnapshotContext});
}

export async function ensureTradeSetupSourceSnapshot(tradeSetupId,payload){
 assertTradeSetupSourceSnapshot(payload);
 if(!Number.isSafeInteger(tradeSetupId)||tradeSetupId<=0)throw new Error('Ungültige Trade-Setup-Referenz.');
 const {error}=await supabase.from('trade_setup_source_snapshots').upsert({trade_setup_id:tradeSetupId,payload},
  {onConflict:identity,ignoreDuplicates:true});
 if(error)throw error;
 const {data,error:readError}=await supabase.from('trade_setup_source_snapshots').select('id,payload')
  .eq('trade_setup_id',tradeSetupId).eq('source_profile',payload.sourceProfile).eq('settings_hash',payload.settingsHash)
  .eq('canonical_setup_known_at',payload.canonicalSetupKnownAt).eq('evaluation_as_of',payload.evaluationAsOf).maybeSingle();
 if(readError)throw readError;
 // Ein Retry darf die unter identischem Schlüssel bereits eingefrorene Aussage nicht umdeuten.
 if(!data||await contentHash(data.payload)!==await contentHash(payload))throw new Error('Konflikt beim eingefrorenen Quellen-Snapshot.');
 assertTradeSetupSourceSnapshot(data.payload);
 return data.id;
}

export async function readTradeSetupSourceSnapshot(id){
 if(!Number.isSafeInteger(id)||id<=0)throw new Error('Ungültige Snapshot-Referenz.');
 const {data,error}=await supabase.from('trade_setup_source_snapshots').select('payload').eq('id',id).maybeSingle();
 if(error)throw error;
 if(!data)throw new Error('Quellen-Snapshot fehlt.');
 return assertTradeSetupSourceSnapshot(data.payload);
}
