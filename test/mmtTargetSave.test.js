import {expect,it,vi} from 'vitest';
import {ref} from 'vue';
import {registerTargetSave,saveTargetDraft,targetSaveState,targetSaveRejected,cancelTargetDraft} from '../src/mmtTargetSave.js';
it('routes by exact position owner and stale cleanup cannot remove its replacement',async()=>{
 const state=ref({disabled:false,status:'Ungespeichert'}),oldSave=vi.fn(),newSave=vi.fn(()=>true),otherSave=vi.fn(()=>true);
 const oldCleanup=registerTargetSave('one',oldSave,state),cleanup=registerTargetSave('one',newSave,state),otherCleanup=registerTargetSave('other',otherSave,state);
 try{
  expect(oldCleanup()).toBe(false);expect(await saveTargetDraft('one')).toBe(true);
  expect(oldSave).not.toHaveBeenCalled();expect(newSave).toHaveBeenCalledOnce();expect(otherSave).not.toHaveBeenCalled();
  state.value={disabled:true,status:'Wird gespeichert'};expect(await saveTargetDraft('one')).toBe(false);
  expect(targetSaveState('one').status).toBe('Wird gespeichert');
 }finally{cleanup();otherCleanup();}
 expect(await saveTargetDraft('one')).toBe(false);
});
it('never treats an unknown transport/server failure as a definite rejection',()=>{
 expect(targetSaveRejected({code:'target_action_failed'})).toBe(false);
 expect(targetSaveRejected(new Error('network'))).toBe(false);
 expect(targetSaveRejected({code:'target_position_changed'})).toBe(true);
 expect(targetSaveRejected({definitiveRejection:true})).toBe(true);
});

it('cancels only the exact editor and refuses an unresolved in-flight cancellation',()=>{
 const state=ref({cancelDisabled:false}),one=vi.fn(()=>true),other=vi.fn(()=>true);
 const cleanup=registerTargetSave('one',vi.fn(),state,one),cleanupOther=registerTargetSave('other',vi.fn(),state,other);
 try{expect(cancelTargetDraft('one')).toBe(true);expect(one).toHaveBeenCalledOnce();expect(other).not.toHaveBeenCalled();state.value={cancelDisabled:true};expect(cancelTargetDraft('one')).toBe(false);}finally{cleanup();cleanupOther();}
 expect(cancelTargetDraft('one')).toBe(false);
});
