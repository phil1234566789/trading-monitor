import {shallowReactive} from 'vue';
// Laufzeitbindung an den echten Editor; keine Callbacks in serialisierbaren TP-Entwürfen.
const editors=shallowReactive(new Map());
const rejectedCodes=new Set(['target_fill_required','target_worker_not_ready','target_position_unavailable','target_position_changed','target_daily_stop','target_command_unresolved','target_revision_reused','target_revision_changed','target_outcome_unresolved','account_changed']);
export const targetSaveRejected=error=>error.definitiveRejection||rejectedCodes.has(error.code)||/^invalid_target_/.test(error.code??'');
export function registerTargetSave(orderId,save,state){
 const editor={save,state};editors.set(orderId,editor);
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
