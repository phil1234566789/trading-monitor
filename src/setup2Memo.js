import { checklistObservationRules } from './checklistObservationRules.js';

export function createSetup2Memo(limit=200) {
  const entries=new Map();
  return {get size(){return entries.size;},get:key=>entries.get(key),
    set(key,value){if(!entries.has(key) && entries.size>=limit)entries.delete(entries.keys().next().value);entries.set(key,value);},
    delete:key=>entries.delete(key),clear:()=>entries.clear()};
}

export function finalObservation(check,key) {
  return !!check && checklistObservationRules(check,key).every(rule=>['found','clear'].includes(rule.status));
}

export function setupMemoKey(source,anchor,settings,sessions,revision=0) {
  // Archiv-Revision ist explizit: neue Kerzen ändern sie nicht, korrigierte Historie schon.
  const {instrument,tradeSetupId,createdAt,dir,obTop,obBottom,obStartTime,obFvg,invalidation,ls}=source;
  return JSON.stringify([instrument,tradeSetupId,createdAt,dir,obTop,obBottom,obStartTime,obFvg,invalidation,
    ls?.price,ls?.dir,ls?.pivotTime,ls?.touchedTime,ls?.touched,source.sweeps?.[0]?.timeframe,
    anchor?.structureStartTime,settings,sessions,revision]);
}

export function isCandleAppend(previous,next) {
  return previous.length<=next.length && previous.every((c,i)=>JSON.stringify(c)===JSON.stringify(next[i]));
}
