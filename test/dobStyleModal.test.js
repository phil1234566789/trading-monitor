import {expect,it,vi} from 'vitest';
import {createSSRApp} from 'vue';
import {renderToString} from '@vue/server-renderer';
vi.mock('../src/components/MetadataPanel.vue',async()=>{const {h}=await import('vue');return{default:{setup:(_,ctx)=>()=>h('div',ctx.slots.default?.())}};});
vi.mock('../src/supabaseClient.js',()=>({supabase:{from:()=>({select:async()=>({data:[],error:null})})}}));
it('exposes the DOB color and alpha fields through the existing keyboard-operable style group',async()=>{
 vi.stubGlobal('localStorage',{getItem:()=>null,setItem:vi.fn()});
 try{const {default:StyleModal}=await import('../src/components/StyleModal.vue');const html=await renderToString(createSSRApp(StyleModal));
 expect(html).toContain('Doppelter Orderblock');
 for(const label of ['Bestätigt','Verlust','Hover-Hervorhebung','Pin-Hervorhebung']){
  expect(html).toContain(`aria-label="Doppelter Orderblock: ${label} Farbe"`);
  expect(html).toContain(`aria-label="Doppelter Orderblock: ${label} Deckkraft"`);
 }
 expect(html).toMatch(/<button[^>]*class="style-group-title"[^>]*aria-expanded="false"/);
 }finally{vi.unstubAllGlobals();}
});
