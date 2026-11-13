import {detectDoubleOrderBlocks} from './doubleOrderBlocks.js';
self.onmessage=({data})=>{
  try {self.postMessage({result:detectDoubleOrderBlocks(data)});}
  catch(error){self.postMessage({error:error.message||'DOB-Auswertung fehlgeschlagen.'});}
};
