import {ref} from 'vue';

export const journalExecutionCardKey=(trade,draftKey=null)=>draftKey!=null?`draft:${draftKey}`:`position:${trade.id}`;
export function journalCardArmedAction(arm,armedPositionId,activeKey,trade,draftKey=null){
 if(arm?.startsWith('entryFvg'))return activeKey===journalExecutionCardKey(trade,draftKey)?arm:null;
 return draftKey==null&&armedPositionId===trade.id?arm:null;
}
export function useJournalEntryFinder(changed) {
 const activeKey=ref(null),cards=new Map(),refs=new Map();
 function close(key){if(activeKey.value===key){activeKey.value=null;changed(key);}}
 function refFor(key){
  if(!refs.has(key))refs.set(key,card=>{
   if(card)cards.set(key,card);
   else{cards.delete(key);close(key);}
  });
  return refs.get(key);
 }
 function open(key){
  for(const [other,card] of cards)if(other!==key)card.closeFinder();
  activeKey.value=key;changed(key);
 }
 function closeAll(){for(const card of cards.values())card.closeFinder();activeKey.value=null;changed(null);}
 function resolve(key){return activeKey.value===key?cards.get(key)?.entryTarget()??null:null;}
 function apply(prefill,key){return resolve(key)?cards.get(key).applyPrefill(prefill):false;}
 return {activeKey,refFor,open,close,closeAll,resolve,apply};
}
