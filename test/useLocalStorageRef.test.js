import {describe,expect,it,vi} from 'vitest';
import {effectScope} from 'vue';

describe('useLocalStorageRef',()=>{
 it('schreibt weiter, auch wenn der Scope der ersten aufrufenden Komponente beendet ist',async()=>{
  const store=new Map();
  vi.stubGlobal('localStorage',{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)});
  const {useLocalStorageRef}=await import('../src/composables/useLocalStorageRef.js');
  const scope=effectScope();
  const value=scope.run(()=>useLocalStorageRef('scopeTest',[]));
  scope.stop();
  value.value=['a'];
  expect(store.get('trading-monitor:scopeTest')).toBe('["a"]');
  vi.unstubAllGlobals();
 });
});
