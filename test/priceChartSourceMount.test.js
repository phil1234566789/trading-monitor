import {expect,it,vi} from 'vitest';
import {createSSRApp} from 'vue';
import {renderToString} from 'vue/server-renderer';
const dob=vi.hoisted(()=>({context:null}));
vi.mock('../src/composables/useDoubleOrderBlockChart.js',async original=>{
 const actual=await original();return {...actual,useDoubleOrderBlockChart(context){dob.context=context;return actual.useDoubleOrderBlockChart(context);}};
});
vi.mock('../src/supabaseClient.js',()=>({supabase:{from(){
 const q=new Proxy({}, {get:(_,k)=>k==='then'?r=>r({data:[],error:null}):()=>q});return q;
}}}));
it('initializes the actual PriceChart with DOB, M1 and LS_REACTION replay consumers together',async()=>{
 const storage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
 vi.stubGlobal('localStorage',storage);vi.stubGlobal('sessionStorage',storage);
 vi.stubGlobal('window',{addEventListener:()=>{},removeEventListener:()=>{},localStorage:storage,sessionStorage:storage});
 try{
  const {default:PriceChart}=await import('../src/components/PriceChart.vue');
  const app=createSSRApp(PriceChart,{symbol:'XAUUSD',currentBar:'5m',replayUntil:1793889900,
   showDoubleOrderBlocks:true,showTradeSetups:true,showTradeSetupsLong:true,showM1Structure:true});
  expect(await renderToString(app)).toContain('chart-container');
  expect(()=>dob.context()).not.toThrow();
 }finally{vi.unstubAllGlobals();}
});
