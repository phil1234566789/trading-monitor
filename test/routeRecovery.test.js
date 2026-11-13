import {it,expect,vi} from 'vitest';
import {createRouter,createMemoryHistory} from 'vue-router';
import {installRouteRecovery} from '../src/routeRecovery.js';
function browser(storage=new Map()){
 return {location:{reload:vi.fn()},history:{state:{back:'/previous'},replaceState:vi.fn()},navigator:{onLine:true},
  sessionStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)}};
}
it('recovers a removed route chunk by reloading at the intended hash route including filters',async()=>{
 const router=createRouter({history:createMemoryHistory('/trading-monitor/'),routes:[
  {path:'/',component:{}},{path:'/statistik',component:()=>Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/Statistik-old.js'))},
 ]});
 const env=browser();installRouteRecovery(router,env,()=>100000);
 await router.push('/');
 await expect(router.push('/statistik?run=saved#entry')).rejects.toThrow('dynamically imported');
 expect(env.history.replaceState).toHaveBeenCalledWith(env.history.state,'','/trading-monitor/statistik?run=saved#entry');
 expect(env.location.reload).toHaveBeenCalledTimes(1);
});
it('handles hash-history destinations without replacing them by the old route',()=>{
 const router={onError:vi.fn(),resolve:to=>({href:'/trading-monitor/#'+to.fullPath})},env=browser();
 installRouteRecovery(router,env,()=>100000);
 router.onError.mock.calls[0][0](new Error('Unable to preload CSS for /assets/mmt-old.css'),{fullPath:'/milky-meta-trader'});
 expect(env.history.replaceState).toHaveBeenCalledWith(env.history.state,'','/trading-monitor/#/milky-meta-trader');
 expect(env.location.reload).toHaveBeenCalledTimes(1);
});
it('never loops on a bad deployment or reloads for unrelated errors or offline navigation',()=>{
 const storage=new Map(),error=new TypeError('Importing a module script failed.');
 const setup=()=>{const router={onError:vi.fn(),resolve:()=>({href:'#/konten'})},env=browser(storage);installRouteRecovery(router,env,()=>100000);return {env,fail:router.onError.mock.calls[0][0]};};
 const first=setup();first.fail(error,{});first.fail(error,{});expect(first.env.location.reload).toHaveBeenCalledTimes(1);
 const next=setup();next.fail(error,{});expect(next.env.location.reload).not.toHaveBeenCalled();
 const unrelated=setup();unrelated.fail(new Error('database unavailable'),{});expect(unrelated.env.history.replaceState).not.toHaveBeenCalled();
 const offline=setup();offline.env.navigator.onLine=false;offline.fail(error,{});expect(offline.env.location.reload).not.toHaveBeenCalled();
 const blocked=setup();blocked.env.sessionStorage.getItem=()=>{throw new Error('blocked');};blocked.fail(error,{});expect(blocked.env.location.reload).not.toHaveBeenCalled();
});
it('leaves unrelated application errors and offline failures alone even without a previous recovery',()=>{
 for(const offline of [false,true]){
  const env=browser(),router={onError:vi.fn(),resolve:vi.fn()};env.navigator.onLine=!offline;
  installRouteRecovery(router,env,()=>100000);
  router.onError.mock.calls[0][0](new Error(offline?'Failed to fetch dynamically imported module':'Cannot read properties of null'),{});
  expect(router.resolve).not.toHaveBeenCalled();expect(env.location.reload).not.toHaveBeenCalled();
 }
});
it('allows a later recovery after the cooldown and recognizes Firefox module errors',()=>{
 const env=browser(),router={onError:vi.fn(),resolve:()=>({href:'#/konten'})};
 env.sessionStorage.setItem('trading-monitor:route-recovery','100000');
 installRouteRecovery(router,env,()=>160001);
 router.onError.mock.calls[0][0](new TypeError('error loading dynamically imported module: old.js'),{});
 expect(env.location.reload).toHaveBeenCalledTimes(1);
});
