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
 it('übernimmt den Wert eines umbenannten Keys einmal und löscht den alten',async()=>{
  const store=new Map([['trading-monitor:altName','true']]);
  vi.stubGlobal('localStorage',{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)});
  const {useLocalStorageRef}=await import('../src/composables/useLocalStorageRef.js');
  expect(useLocalStorageRef('neuName',false,{legacyKey:'altName'}).value).toBe(true);
  expect(store.has('trading-monitor:altName')).toBe(false);
  vi.unstubAllGlobals();
 });
});
