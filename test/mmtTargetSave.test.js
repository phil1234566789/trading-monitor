import {expect,it,vi} from 'vitest';
import {ref} from 'vue';
import {registerTargetSave,saveTargetDraft,targetSaveState,targetSaveRejected} from '../src/mmtTargetSave.js';
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
