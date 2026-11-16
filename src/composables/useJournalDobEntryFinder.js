import {computed,ref,watch} from 'vue';
import {loadDoubleOrderBlockCandles,runDoubleOrderBlockWorker} from '../doubleOrderBlockData.js';
import {dobAnchorTime,dobEntrySuggestions,dobEvaluationTime} from '../dobEntrySuggestion.js';

// Entry finden c): Entry, Zeit und SL kommen unverändert aus detectDoubleOrderBlocks(); gespeichert wird erst im Formular.
export function useJournalDobEntryFinder({modal,editing,symbol,message,disarm}) {
  const choices=ref([]),cardKey=ref(null),chosen=ref(null);
  let token=0,worker=null,evaluatedAt=null;
  function clear(){token++;worker?.terminate();worker=null;choices.value=[];cardKey.value=null;chosen.value=null;}
  // Der gewählte Vorschlag erscheint im Chart wie ein gehoverter DOB-Pin, auch bei ausgeschalteter DOB-Ebene.
  const preview=computed(()=>chosen.value?{pair:chosen.value.pair,evaluatedAt}:null);
  function apply(choice){
    const prefill={entryPrice:choice.entryPrice,entryTime:choice.entryTime,stopLoss:choice.stopLoss};
    if(!modal.value?.applyExecutionPrefill(prefill,cardKey.value)){message.value='Ausführung ist nicht mehr bearbeitbar.';return false;}
    chosen.value=choice;
    return true;
  }
  async function request({cardKey:key}){
    const trade=modal.value?.resolveExecutionTarget(key);
    if(!trade||trade.dealingRangeId!==editing.value?.dealingRangeId||trade.instrument!==symbol.value)return;
    disarm();clear();
    const anchor=dobAnchorTime(trade);
    if(anchor==null){message.value='Zuerst Entry-Zeit angeben oder eine M5-OB-Evidence an der Dealing Range hinterlegen.';return;}
    const request=++token;cardKey.value=key;
    evaluatedAt=dobEvaluationTime(anchor,Math.floor(Date.now()/1000));
    message.value='DOB-Indikator rechnet …';
    try{
      const {m5,m1}=await loadDoubleOrderBlockCandles(trade.instrument,evaluatedAt);
      if(request!==token)return;
      if(!m5.length){message.value='DOB-Indikator: M5-Daten fehlen.';return;}
      worker=runDoubleOrderBlockWorker({m5,m1,symbol:trade.instrument,evaluatedAt},{
        onResult:result=>{
          if(request!==token)return;
          worker=null;
          const out=dobEntrySuggestions(result,{direction:trade.direction,anchorTime:anchor,evidence:trade.confirmations,instrument:trade.instrument});
          choices.value=out.choices;
          const pre=out.choices.find(choice=>choice.key===out.preselectedKey);
          message.value=pre&&apply(pre)?`Vorausgewählt (passt zur M5-OB-Evidence): ${pre.label}`:out.reason;
        },
        onError:error=>{if(request===token){worker=null;message.value=`DOB-Indikator: ${error??'Auswertung fehlgeschlagen.'}`;}}});
    }catch(error){if(request===token)message.value=`DOB-Indikator: ${error.message||'Daten konnten nicht geladen werden.'}`;}
  }
  function choose(key){
    const choice=choices.value.find(item=>item.key===key);
    if(choice&&apply(choice))message.value=`Übernommen: ${choice.label}`;
  }
  watch([symbol,()=>editing.value?.dealingRangeId],clear,{flush:'sync'});
  return {choices,cardKey,chosenKey:computed(()=>chosen.value?.key??null),preview,request,choose,clear};
}
