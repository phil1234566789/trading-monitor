import {isLiveWatcherMonth} from './liveWatcherMonth.js';
export function livePinSource(pin) {
  const source=pin.simulationContext?.source;
  return !pin.simulationRunId && source?.kind==='live-watcher' && source.eventId
    && (!pin.liveEventId || pin.liveEventId===source.eventId)?source:null;
}
export function pinBelongsToSource(pin,viewId) {
  return pin.simulationRunId===viewId || isLiveWatcherMonth(viewId) && !!livePinSource(pin);
}
export function scopePinSource(query,viewId) {
  return isLiveWatcherMonth(viewId)?query.is('simulation_run_id',null).not('live_event_id','is',null):query.eq('simulation_run_id',viewId);
}
