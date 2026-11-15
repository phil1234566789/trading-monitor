import {expect,it,vi} from 'vitest';
import {effectScope,ref,nextTick} from 'vue';
import {useJournalTpFinder} from '../src/composables/useJournalTpFinder.js';
const trade={id:7,cardKey:'draft:1',dealingRangeId:3,instrument:'XAUUSD',direction:'long',entryPrice:100,entryTime:120,targets:[{id:1,price:110,sourceTime:0},{id:2,price:115,sourceTime:0}],invalidation:90};
function setup(){
 const scope=effectScope(),current=ref({...trade}),bar=ref('1m'),symbol=ref('XAUUSD'),editing=ref({dealingRangeId:3}),replay=ref(null),arm=ref(null);
 const apply=vi.fn(()=>true),disarm=vi.fn(()=>arm.value=null),modal=ref({resolveExecutionTarget:()=>current.value,applyExecutionPrefill:apply});
 const armChart=vi.fn((key,payload)=>arm.value={key,payload});
 const finder=scope.run(()=>useJournalTpFinder({modal,bar,symbol,editing,replay,armed:arm,arm:armChart,disarm}));
 return {scope,current,bar,symbol,editing,replay,arm,apply,disarm,armChart,finder};
}
it('arms M1 only; multiple hits require an explicit line and prefill only once',()=>{
 const s=setup();s.bar.value='5m';s.finder.request({cardKey:'draft:1'});expect(s.armChart).not.toHaveBeenCalled();expect(s.bar.value).toBe('5m');
 s.bar.value='1m';s.finder.request({cardKey:'draft:1'});
 const result={time:180,lines:[{key:'target:1',price:110,label:'Target #1'},{key:'invalidation',price:90,label:'Invalidierung'}],target:s.arm.value.payload};
 s.finder.select(result);expect(s.apply).not.toHaveBeenCalled();expect(s.finder.choices.value).toHaveLength(2);
 s.finder.choose('invalidation');expect(s.apply).toHaveBeenCalledWith({exitPrice:90,exitTime:180},'draft:1');
 s.finder.choose('target:1');expect(s.apply).toHaveBeenCalledTimes(1);s.scope.stop();
});
it('explains missing draft entry without arming or modifying the timeframe',()=>{
 const s=setup();s.current.value={...trade,entryPrice:null,entryTime:null};s.finder.request({cardKey:'draft:1'});
 expect(s.armChart).not.toHaveBeenCalled();expect(s.finder.message.value).toContain('Entry-Preis');expect(s.bar.value).toBe('1m');s.scope.stop();
});
it('removes multi-hit choices and instructions when the global chart mode is cancelled',()=>{
 const s=setup();s.finder.request({cardKey:'draft:1'});
 s.finder.select({time:180,lines:[{key:'target:1',price:110},{key:'invalidation',price:90}],target:s.arm.value.payload});
 s.disarm();expect(s.finder.choices.value).toEqual([]);expect(s.finder.message.value).toBe('');s.finder.choose('target:1');expect(s.apply).not.toHaveBeenCalled();s.scope.stop();
});
it('clears old selection on all context changes and rejects a stale result synchronously',async()=>{
 for(const key of ['bar','symbol','editing','replay','current']){
  const s=setup();s.finder.request({cardKey:'draft:1'});
  const result={time:180,lines:[{key:'target:1',price:110}],target:s.arm.value.payload};
  const changes={bar:'5m',symbol:'EURUSD',editing:{dealingRangeId:4},replay:180,current:{...trade,entryTime:180}};
  s[key].value=changes[key];s.finder.select(result);expect(s.apply).not.toHaveBeenCalled();
  await nextTick();expect(s.finder.selection.value).toBeNull();expect(s.finder.choices.value).toEqual([]);s.scope.stop();
 }
});
it('invalidates an in-place target edit and an old multi-hit choice after closing the active card',()=>{
 const s=setup();s.finder.request({cardKey:'draft:1'});
 const result={time:180,lines:[{key:'target:1',price:110},{key:'target:2',price:115}],target:s.arm.value.payload};
 s.finder.select(result);s.current.value.targets[0].price=111;
 expect(s.finder.selection.value).toBeNull();s.finder.choose('target:2');expect(s.apply).not.toHaveBeenCalled();
 s.current.value={...trade,targets:[{id:1,price:110}]};s.finder.request({cardKey:'draft:1'});
 s.current.value=null;s.finder.select({...result,target:s.arm.value?.payload});expect(s.apply).not.toHaveBeenCalled();s.scope.stop();
});
