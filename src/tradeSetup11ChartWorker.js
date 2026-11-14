import {filterTradeSetup11Candidates} from './tradeSetup11.js';
self.onmessage=({data})=>{
  try{self.postMessage({result:filterTradeSetup11Candidates(data)});}
  catch(error){self.postMessage({error:error.message||'TS1.1-Auswertung fehlgeschlagen.'});}
};
