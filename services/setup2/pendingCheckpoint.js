import {checkpointEvidence} from './evidenceCheckpoint.js';

export function queueEvidenceCheckpoint(cache,{state,events,previous,anchors,h1}) {
 if(cache.pendingCheckpoint)throw new Error('Pending checkpoint must finish before a new scan');
 cache.pendingCheckpoint={state,events,batches:[...(cache.pendingEvidence ?? [])],anchors,h1,
  baseThrough:previous.evaluatedThrough,baseRevision:previous.nativeHistoryRevision ?? 0};
}

// Fehlgeschlagene Pakete werden vor neuer Auswertung wiederholt; fremder Fortschritt bleibt maßgeblich.
export async function flushPendingCheckpoint(request,cache,{instrument,owner,previous}) {
 const pending=cache.pendingCheckpoint;if(!pending)return null;
 const sameBase=previous.evaluatedThrough===pending.baseThrough && (previous.nativeHistoryRevision ?? 0)===pending.baseRevision;
 const state=sameBase?pending.state:previous;
 const delayed=pending.attempted || !sameBase,closedMinute=Math.floor(Date.now()/60000)*60000;
 const events=delayed?pending.events.map(event=>event.kind==='trading' && Date.parse(event.signal_at)<closedMinute
  ? {...event,missed_reason:event.missed_reason ?? 'Verspäteter Checkpoint nach Störung; nur Protokoll und Telegram'}:event):pending.events;
 pending.attempted=true;
 await checkpointEvidence(request,{p_instrument:instrument,p_owner:owner,p_state:state,p_events:events},pending.batches);
 cache.pendingEvidence=[];delete cache.pendingCheckpoint;
 cache.entries=state.entries ?? [];cache.liveState=state;
 if(sameBase){cache.anchors=pending.anchors;cache.h1=pending.h1;}
 else {cache.scanMemo={};cache.evidencePriceObservations=state.evidencePriceObservations ?? {};}
 return state;
}
