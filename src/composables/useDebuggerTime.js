import {ref} from 'vue';

// Zeitlogik aller Chart-Debugger-Sektionen an einer Stelle; DebuggerTimeBar.vue ist die Bedienung dazu.
// Die Sektionen liefern nur Bereich, Startzeitpunkt je Fall und ihre Änderungszeiten.

// Auf das Schrittraster ab from einrasten und in den Bereich klemmen.
export function clampTime(t,{from,through},step){
 const snapped=from+Math.round((t-from)/step)*step;
 return Math.min(through,Math.max(from,snapped));
}

export const jumpTarget=(times,at,delta)=>delta>0?(times??[]).find(t=>t>at):(times??[]).findLast(t=>t<at);

// show(): neuer Fall → Startwert der Sektion; gleicher Fall mit anderem Bereich (Vor-/Nachlauf) → Regler bleibt, nur geklemmt.
export function useDebuggerTime(step){
 const at=ref(0),range=ref({from:0,through:0});
 let caseKey;
 function show(key,nextRange,start){
  range.value={from:nextRange.from,through:nextRange.through};
  at.value=clampTime(key===caseKey?at.value:start,range.value,step);
  caseKey=key;
 }
 return {at,range,step,show};
}
