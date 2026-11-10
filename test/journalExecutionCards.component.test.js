import {expect,it,vi} from 'vitest';
import * as Vue from 'vue';
import {parse,compileScript} from '@vue/compiler-sfc';
import {compile} from '@vue/compiler-dom';
import {readFileSync} from 'node:fs';
const api=vi.hoisted(()=>({fetchTrades:vi.fn(),removeConfirmationFromTrade:vi.fn()}));
vi.mock('../src/trades.js',()=>({fetchTrades:api.fetchTrades}));
vi.mock('../src/tradeIntake.js',()=>({removeConfirmationFromTrade:api.removeConfirmationFromTrade,removeTargetFromTrade:vi.fn(),updateDealingRange:vi.fn()}));
vi.mock('../src/tradingAccounts.js',()=>({ALL_ACCOUNTS_ID:'all'}));
vi.mock('../src/components/MetadataPanel.vue',async()=>{const {h}=await import('vue');return {default:{setup:(_,{slots})=>()=>h('div',{},slots.default?.())}};});
vi.mock('../src/components/DealingRangeSetupSelect.vue',()=>({default:{render:()=>null}}));
vi.mock('../src/components/CrudListSection.vue',()=>({default:{render:()=>null}}));
vi.mock('../src/components/ui/IconButton.vue',()=>({default:{render:()=>null}}));
vi.mock('../src/components/ui/ActionButton.vue',async()=>{const {h}=await import('vue');return {default:{props:['disabled'],emits:['click'],setup:(props,{emit,slots})=>()=>h('button',{disabled:props.disabled,onClick:()=>emit('click')},slots.default?.())}};});
vi.mock('../src/components/TradeExecutionCard.vue',async()=>{
 const {h}=await import('vue');return {default:{props:{trade:Object,number:Number,draft:Boolean,draftKey:Number},emits:['remove-evidence','saved','created','cancel'],setup:(props,{emit,expose})=>{
  expose({applyPrefill:()=>true,closeFinder:()=>{},entryTarget:()=>props.trade});return ()=>h('article',{'data-id':props.trade.id,'data-number':props.number,'data-draft':props.draft},[
   h('span',{},JSON.stringify(props.trade.confirmations??[])),
   h('button',{'data-remove':props.trade.id,onClick:()=>emit('remove-evidence',{id:99})},'Remove'),
   h('button',{'data-save':props.trade.id,onClick:()=>emit('saved')},'Saved'),
   h('button',{'data-create':props.draftKey,onClick:()=>emit('created',153,5,props.draftKey)},'Created'),
   h('button',{'data-cancel':props.draftKey,onClick:()=>emit('cancel')},'Cancel'),
  ]);
 }}};
});
import Modal from '../src/components/TradeEditModal.vue';
const {descriptor}=parse(readFileSync(new URL('../src/components/TradeEditModal.vue',import.meta.url),'utf8'));
Modal.render=new Function('Vue',compile(descriptor.template.content,{mode:'function',prefixIdentifiers:true,bindingMetadata:compileScript(descriptor,{id:'modal'}).bindings}).code)(Vue);
const renderer=Vue.createRenderer({
 createElement:type=>({type,tagName:type.toUpperCase(),children:[],props:{},options:[],addEventListener(){},getRootNode:()=>({activeElement:null}),scrollIntoView(){}}),createText:text=>({text}),createComment:text=>({text}),
 setText:(n,text)=>n.text=text,setElementText:(n,text)=>n.text=text,patchProp:(n,k,old,value)=>n.props[k]=value,
 insert:(node,parent,anchor)=>{if(node.parent)node.parent.children=node.parent.children.filter(c=>c!==node);node.parent=parent;const index=parent.children.indexOf(anchor);if(index<0)parent.children.push(node);else parent.children.splice(index,0,node);},
 remove:node=>{node.parent.children=node.parent.children.filter(c=>c!==node);},parentNode:node=>node.parent,nextSibling:()=>null,
});
const all=node=>[node,...(node.children??[]).flatMap(all)];
const settle=async()=>{await new Promise(resolve=>setImmediate(resolve));await Vue.nextTick();};
it('keeps two account-separated cards, refreshes removed foreign-account evidence, and saves exactly one extra draft card',async()=>{
 vi.stubGlobal('document',{activeElement:null});vi.stubGlobal('Document',class Document{});vi.stubGlobal('ShadowRoot',class ShadowRoot{});
 const one={id:151,dealingRangeId:128,instrument:'XAUUSD',direction:'short',tradingAccountId:5,entryTime:1793908560};
 const two={...one,id:152,tradingAccountId:7,confirmations:[{id:99,level:'position',category:'confirmation'}]};let rows=[one,two];
 api.fetchTrades.mockImplementation(async()=>rows);api.removeConfirmationFromTrade.mockImplementation(async()=>{rows=[one,{...two,confirmations:[]}];return true;});
 const root={children:[]},saved=vi.fn();const app=renderer.createApp(Modal,{trade:one,positions:[one],currentSymbol:'XAUUSD',onSaved:saved});
 app.provide(Vue.ssrContextKey,{modules:new Set()});app.mount(root);
 try{
  await settle();expect(all(root).filter(n=>n.type==='article').map(n=>n.props['data-id'])).toEqual([151,152]);
  all(root).find(n=>n.props?.['data-remove']===152).props.onClick();await settle();
  expect(api.removeConfirmationFromTrade).toHaveBeenCalledWith(99);
  const foreign=all(root).find(n=>n.type==='article'&&n.props['data-id']===152);expect(JSON.stringify(foreign.children.map(n=>n.text))).not.toContain('99');
  expect(saved).toHaveBeenCalledTimes(1);
  const add=all(root).find(n=>n.type==='button'&&n.children?.some(c=>c.text==='Position hinzufügen'));
  add.props.onClick();await settle();let cards=all(root).filter(n=>n.type==='article');
  expect(cards.map(n=>n.props['data-number'])).toEqual([1,2,3]);expect(cards[2].props['data-draft']).toBe(true);
  cards[0].children.find(n=>n.props?.['data-save']===151).props.onClick();await settle();expect(all(root).filter(n=>n.type==='article')).toHaveLength(3);
  rows=[...rows,{...one,id:153,confirmations:[]}];
  all(root).find(n=>n.props?.['data-create']!=null).props.onClick();await settle();
  cards=all(root).filter(n=>n.type==='article');expect(cards.map(n=>n.props['data-id'])).toEqual([151,152,153]);expect(cards.some(n=>n.props['data-draft'])).toBe(false);
 }finally{app.unmount();vi.unstubAllGlobals();}
});
