import {expect,it,vi} from 'vitest';
import {createSSRApp} from 'vue';
import {renderToString} from '@vue/server-renderer';
vi.mock('../src/components/PriceChart.vue',()=>({default:{render:()=>null}}));
vi.mock('../src/components/DashboardMmt.vue',()=>({default:{render:()=>null}}));
vi.mock('../src/supabaseClient.js',()=>{
  const chain=new Proxy({}, {get:(_,key)=>key==='then'?resolve=>resolve({data:[],error:null}):()=>chain});
  return {supabase:{from:vi.fn(()=>chain),functions:{invoke:vi.fn().mockResolvedValue({data:[],error:null})}}};
});
vi.mock('vue-router',async()=>{
  const actual=await vi.importActual('vue-router');
  return {...actual,useRoute:()=>({query:{},path:'/'}),useRouter:()=>({replace:vi.fn(),push:vi.fn()})};
});
it('initializes the real Dashboard setup including DOB before later journal refresh consts exist',async()=>{
  const storage={getItem:()=>null,setItem:vi.fn(),removeItem:vi.fn()};
  vi.stubGlobal('localStorage',storage);vi.stubGlobal('sessionStorage',storage);
  vi.stubGlobal('window',{addEventListener:vi.fn(),removeEventListener:vi.fn(),localStorage:storage,sessionStorage:storage});
  try {
    const {default:Dashboard}=await import('../src/views/Dashboard.vue');
    const html=await renderToString(createSSRApp(Dashboard));
    expect(html).toContain('Indikatoren');
  } finally {vi.unstubAllGlobals();}
});
