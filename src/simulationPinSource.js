import {isLiveWatcherMonth} from './liveWatcherMonth.js';
export function livePinSource(pin){
 const source=pin.simulationContext?.source;
 if(pin.simulationRunId || source?.kind!=='live-watcher')return null;
 if(source.recordId && !source.eventId && !pin.liveEventId && (!pin.liveSnapshotId || pin.liveSnapshotId===source.recordId))return source;
 return source.eventId && !source.recordId && !pin.liveSnapshotId && (!pin.liveEventId || pin.liveEventId===source.eventId)?source:null;
}
export function pinBelongsToSource(pin,viewId){
 const source=livePinSource(pin);
 return pin.simulationRunId===viewId || isLiveWatcherMonth(viewId) && !!source;
}
export function scopePinSource(query,viewId){
 return isLiveWatcherMonth(viewId)?query.is('simulation_run_id',null).or('live_event_id.not.is.null,live_snapshot_id.not.is.null').eq('simulation_context->source->>kind','live-watcher'):query.eq('simulation_run_id',viewId);
}
