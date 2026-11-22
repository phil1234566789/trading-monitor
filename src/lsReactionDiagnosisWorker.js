import {diagnoseLsReactionCase} from './lsReactionDebugger.js';

// LS-Reaktion-Diagnosen des Chart-Debuggers abseits des Hauptthreads: eine Diagnose kostet hinter dem OB
// bis zu mehrere Sekunden und fror Seite und Zeitbalken ein. Abbruch = terminate().
// explain: eine erklärte Diagnose je Schritt (Prüfschritte), sonst nur das Urteil (Änderungssuche).
self.onmessage=({data:{from,through,explain,structureStartTime,kase,m5,own,located,policy}})=>{
 try{
  for(let t=from;t<=through;t+=300){
   const d=diagnoseLsReactionCase(kase,m5,own,{...located,evaluatedAt:t},policy,{explain,structureStartTime});
   self.postMessage(explain?{at:t,diagnosis:d}:{at:t,verdict:d.verdict});
  }
  self.postMessage({done:true});
 }catch(error){self.postMessage({error:error.message||'LS-Reaktion-Diagnose fehlgeschlagen.'});}
};
