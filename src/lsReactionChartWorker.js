import {filterLsReactionCandidates} from './lsReaction.js';
self.onmessage=({data})=>{
  try{self.postMessage({result:filterLsReactionCandidates(data)});}
  catch(error){self.postMessage({error:error.message||'LS-Reaktion-Auswertung fehlgeschlagen.'});}
};
