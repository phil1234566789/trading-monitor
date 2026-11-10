import {watch} from 'vue';

export function watchM1FvgPreviewContext({preview,message,editingTradeId,symbol,bar,replayUntil,armed,selection,disarm}) {
  const clear=()=>{preview.value=null;message.value='';};
  watch([editingTradeId,symbol],()=>{clear();if(selection.value)disarm();});
  watch(bar,value=>{clear();if(value!=='1m'&&selection.value)disarm();});
  watch(replayUntil,clear);
  // Erfolgreiches Prefill disarmiert den Picker; seine Vorschau bleibt bis zum Entwurfs-/Kontextwechsel.
  watch(armed,value=>{if(value&&!value.key.startsWith('entryFvg'))clear();});
}
