import {computed,ref,watch} from 'vue';
import {matchDobTradePins} from '../dobTradeStatistics.js';
import {fetchDobTradePins,addDobTradePin,removePinEntry,updatePinNote} from '../pinContext.js';

// Pins je DOB-Trade wie auf /statistik (pin_context, Pin-Typ + Notiz), laufübergreifend nach derselben Regel (matchDobTradePins).
// Gemeinsam für /dob-statistik und die Chart-Debugger-Sektion DOB-Entry M1; rows = Zeilen aus dob_trade_setups.
export function useDobTradePins(instrument,rows){
 const pins=ref([]),pinTarget=ref(null),pinSaving=ref(false),pinError=ref('');
 const pinMatches=computed(()=>matchDobTradePins(pins.value,rows.value));
 const pinOf=row=>pinMatches.value.get(row.id);
 async function loadPins(){
  pinError.value='';
  try{pins.value=await fetchDobTradePins(instrument.value);}catch(e){pinError.value=e.message||'Pins konnten nicht geladen werden.';}
 }
 watch(instrument,loadPins,{immediate:true});
 function openPin(row){const pin=pinOf(row);pinError.value='';pinTarget.value={row,title:'DOB-Trade anpinnen',note:pin?.note??'',pinType:pin?.pinType??null,existingId:pin?.id};}
 async function pinAction(action){
  if(pinSaving.value)return;
  pinSaving.value=true;pinError.value='';
  try{await action();await loadPins();pinTarget.value=null;}
  catch(e){pinError.value=e.message||'Pin konnte nicht gespeichert werden.';}
  finally{pinSaving.value=false;}
 }
 const savePin=(note,pinType)=>pinAction(async()=>{const t=pinTarget.value;
  if(t.existingId){if(!await updatePinNote(t.existingId,note,pinType))throw new Error('Pin-Notiz konnte nicht gespeichert werden.');}
  else await addDobTradePin(t.row,note,pinType);});
 const removePin=()=>pinAction(async()=>{if(!await removePinEntry(pinTarget.value.existingId))throw new Error('Pin konnte nicht entfernt werden.');});
 return {pins,pinTarget,pinSaving,pinError,pinOf,loadPins,openPin,savePin,removePin};
}
