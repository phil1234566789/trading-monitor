import {shallowReactive} from 'vue';
import {isTargetPlanRejection} from '../supabase/functions/trading-monitor-mcp/targetPlanErrors.js';
// Laufzeitbindung an den echten Editor; keine Callbacks in serialisierbaren TP-Entwürfen.
const editors=shallowReactive(new Map());
export const targetSaveRejected=error=>Boolean(error.definitiveRejection||isTargetPlanRejection(error.code));
export function registerTargetSave(orderId,save,state,cancel){
 const editor={save,state,cancel};editors.set(orderId,editor);
 return ()=>{if(editors.get(orderId)!==editor)return false;editors.delete(orderId);return true;};
}
export function targetSaveState(orderId){
 return editors.get(orderId)?.state.value??{disabled:true,reason:'TP-Verwaltung wird geladen.',status:'Wird geladen'};
}
export async function saveTargetDraft(orderId){
 const editor=editors.get(orderId);
 if(!editor||editor.state.value.disabled)return false;
 return editor.save();
}

export const nativeTargetKey=(accountId,ticket)=>`native:${accountId}:${ticket}`;

export function cancelTargetDraft(orderId){
 const editor=editors.get(orderId);
 if(!editor?.cancel||editor.state.value.cancelDisabled)return false;
 return editor.cancel();
}
