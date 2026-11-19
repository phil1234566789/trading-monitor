import {diagnoseTs11Case} from './tradeSetup11Debugger.js';

// TS1.1-Diagnosen des Chart-Debuggers abseits des Hauptthreads: eine Diagnose kostet hinter dem OB
// bis zu mehrere Sekunden und fror Seite und Zeitbalken ein. Abbruch = terminate().
// explain: eine erklärte Diagnose je Schritt (Prüfschritte), sonst nur das Urteil (Änderungssuche).
self.onmessage=({data:{from,through,explain,kase,m5,own,located,policy}})=>{
 try{
  for(let t=from;t<=through;t+=300){
   const d=diagnoseTs11Case(kase,m5,own,{...located,evaluatedAt:t},policy,{explain});
   self.postMessage(explain?{at:t,diagnosis:d}:{at:t,verdict:d.verdict});
  }
  self.postMessage({done:true});
 }catch(error){self.postMessage({error:error.message||'TS1.1-Diagnose fehlgeschlagen.'});}
};
