import {expect,it,vi} from 'vitest';
import * as Vue from 'vue';
import {parse,compileScript} from '@vue/compiler-sfc';
import {compile} from '@vue/compiler-dom';
import {readFileSync} from 'node:fs';
const api=vi.hoisted(()=>({fetchTrades:vi.fn(),addPositionToDealingRange:vi.fn(),updateTrade:vi.fn(),deleteTrade:vi.fn(),removeConfirmationFromTrade:vi.fn(),removeTargetFromTrade:vi.fn(),updateDealingRange:vi.fn()}));
vi.mock('../src/trades.js',()=>({fetchTrades:api.fetchTrades}));
vi.mock('../src/tradeIntake.js',()=>api);
vi.mock('../src/tradingAccounts.js',async()=>({ALL_ACCOUNTS_ID:'all',accounts:(await import('vue')).ref([])}));
vi.mock('../src/components/MetadataPanel.vue',async()=>({default:{setup:(_,{slots})=>()=>Vue.h('div',{},slots.default?.())}}));
vi.mock('../src/components/DealingRangeSetupSelect.vue',()=>({default:{render:()=>null}}));
vi.mock('../src/components/CrudListSection.vue',()=>({default:{render:()=>null}}));
vi.mock('../src/components/TradeJournalComments.vue',()=>({default:{render:()=>null}}));
vi.mock('../src/components/ui/IconButton.vue',()=>({default:{render:()=>null}}));
import Modal from '../src/components/TradeEditModal.vue';
import Card from '../src/components/TradeExecutionCard.vue';
import ActionButton from '../src/components/ui/ActionButton.vue';
import TpControls from '../src/components/JournalTpControls.vue';
import FvgControls from '../src/components/M1FvgEntryControls.vue';
import {useJournalTpFinder} from '../src/composables/useJournalTpFinder.js';
for(const [component,file] of [[Modal,'TradeEditModal.vue'],[Card,'TradeExecutionCard.vue'],[ActionButton,'ui/ActionButton.vue'],[TpControls,'JournalTpControls.vue'],[FvgControls,'M1FvgEntryControls.vue']]){
 const {descriptor}=parse(readFileSync(new URL('../src/components/'+file,import.meta.url),'utf8'));
 component.render=new Function('Vue',compile(descriptor.template.content,{mode:'function',prefixIdentifiers:true,bindingMetadata:compileScript(descriptor,{id:file}).bindings}).code)(Vue);
}
const renderer=Vue.createRenderer({
 createElement:type=>({type,tagName:type.toUpperCase(),children:[],props:{},options:[],addEventListener(){},getRootNode:()=>({activeElement:null}),scrollIntoView(){}}),createText:text=>({text}),createComment:text=>({text}),
 setText:(n,text)=>n.text=text,setElementText:(n,text)=>n.text=text,patchProp:(n,k,old,value)=>n.props[k]=value,
 insert:(node,parent,anchor)=>{if(node.parent)node.parent.children=node.parent.children.filter(c=>c!==node);node.parent=parent;const index=parent.children.indexOf(anchor);if(index<0)parent.children.push(node);else parent.children.splice(index,0,node);},
 remove:node=>{node.parent.children=node.parent.children.filter(c=>c!==node);},parentNode:node=>node.parent,nextSibling:()=>null,
});
const all=node=>[node,...(node.children??[]).flatMap(all)];
const settle=async()=>{await new Promise(resolve=>setImmediate(resolve));await Vue.nextTick();};
it('keeps the real modal/card TP controls open while the real finder arms and proposes an exit',async()=>{
 vi.stubGlobal('document',{activeElement:null});vi.stubGlobal('Document',class Document{});vi.stubGlobal('ShadowRoot',class ShadowRoot{});
 const trade={id:7,dealingRangeId:3,instrument:'XAUUSD',direction:'long',entryPrice:100,entryTime:1794567600,targets:[{id:1,price:110,sourceTime:1794560000}],invalidation:90};
 api.fetchTrades.mockResolvedValue([trade,{...trade,id:8}]);
 let finder;
 const Parent={setup(){
  const modal=Vue.ref(null),armed=Vue.ref(null),bar=Vue.ref('1m'),symbol=Vue.ref('XAUUSD'),editing=Vue.ref(trade),replay=Vue.ref(null);
  const disarm=()=>armed.value=null;
  finder=useJournalTpFinder({modal,armed,bar,symbol,editing,replay,arm:(key,payload)=>armed.value={key,payload},disarm});
  return ()=>Vue.h(Modal,{ref:modal,trade,positions:[trade],currentSymbol:'XAUUSD',currentBar:'1m',tpMessage:finder.message.value,tpChoices:finder.choices.value,armedAction:armed.value?.key,
   onEntryFinderChanged:()=>{finder.clear();disarm();},onRequestTp:finder.request,onChooseTp:finder.choose});
 }};
 const root={children:[]},app=renderer.createApp(Parent);app.provide(Vue.ssrContextKey,{modules:new Set()});app.mount(root);
 try{
  await settle();const button=all(root).find(n=>n.type==='button'&&all(n).some(c=>c.text==='TP suchen'));expect(button).toBeTruthy();
  button.props.onClick();await settle();
  expect(button.props['aria-expanded']).toBe(true);expect(finder.selection.value).toMatchObject({cardKey:'position:7'});
  finder.select({time:1794567780,lines:[{key:'target:1',label:'Target #1',price:110}],target:finder.selection.value});await settle();
  expect(finder.selection.value).toBeNull();expect(finder.message.value).toContain('Exit vorgeschlagen');
  expect(all(root).filter(n=>n.type==='input'&&n.props.type==='number').map(n=>n.value)).toContain(110);
  expect(api.updateTrade).not.toHaveBeenCalled();expect(api.addPositionToDealingRange).not.toHaveBeenCalled();
 }finally{app.unmount();vi.unstubAllGlobals();}
});
