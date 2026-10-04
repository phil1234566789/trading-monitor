import {expect,it,vi} from 'vitest';
import {computed,createRenderer,h,nextTick,ref,watch} from 'vue';
import * as Vue from 'vue';
import {readFileSync} from 'node:fs';
import {parse,compileScript} from '@vue/compiler-sfc';
import {compile} from '@vue/compiler-dom';
import TradeSetup2Controls from '../src/components/TradeSetup2Controls.vue';
import ToggleButton from '../src/components/ui/ToggleButton.vue';
import {useTradeSetup2Route} from '../src/composables/useTradeSetup2Route.js';
import {useSnapshotVisitToggle} from '../src/composables/useSnapshotVisitToggle.js';

// Vitest lädt SFCs für SSR; der kleine Vue-Renderer benötigt ihre Client-Templates.
for(const [component,file] of [[ToggleButton,'ui/ToggleButton'],[TradeSetup2Controls,'TradeSetup2Controls']]) {
  const {descriptor}=parse(readFileSync(new URL(`../src/components/${file}.vue`,import.meta.url),'utf8'));
  component.render=new Function('Vue',compile(descriptor.template.content,{mode:'function',prefixIdentifiers:true,
    bindingMetadata:compileScript(descriptor,{id:file}).bindings}).code)(Vue);
}

const renderer=createRenderer({
  createElement:type=>({type,children:[],props:{}}),createText:text=>({text}),createComment:text=>({text}),
  setText:(node,text)=>{node.text=text;},setElementText:(node,text)=>{node.text=text;},
  patchProp:(node,key,old,value)=>{node.props[key]=value;},
  insert:(node,parent)=>{node.parent=parent;parent.children.push(node);},
  remove:node=>{node.parent.children=node.parent.children.filter(n=>n!==node);},
  parentNode:node=>node.parent,nextSibling:()=>null,
});
function find(root,label) {
  if(root.props?.['aria-label']===label||root.text===label)return root;
  return (root.children??[]).map(n=>find(n,label)).find(Boolean);
}
it('mounts a linked visit with editable switches, replay steps, timeframe changes and a working close button',async()=>{
  const saved=ref(false),writes=vi.fn(),query=ref({setup2:'e',run:'r',instrument:'GBPUSD',replay:'600'});
  const state={currentSymbol:ref('EURUSD'),currentBar:ref('1h'),replayTime:ref(null),replayActive:ref(false),tradeSetup2Variant:ref('wide')};
  const root={children:[]};let show;
  const app=renderer.createApp({setup(){
    const active=computed(()=>!!query.value.setup2);
    show=useSnapshotVisitToggle(saved,active);watch(saved,writes);
    useTradeSetup2Route(()=>query.value,state,['GBPUSD','EURUSD']);
    return ()=>h('div',[
      h(ToggleButton,{'aria-label':'Setup-Schalter','aria-pressed':show.value,onClick:()=>{show.value=!show.value;}}),
      h(ToggleButton,{'aria-label':'Replay-Schritt',onClick:()=>{state.replayTime.value+=60;}}),
      h(TradeSetup2Controls,{positions:[],selected:{id:'e',knownAt:300},snapshotView:active.value,onClose:()=>{query.value={};}}),
    ]);
  }});
  app.component('RouterLink',{setup:(_,ctx)=>()=>h('a',{},ctx.slots.default?.())});
  app.provide(Vue.ssrContextKey,{modules:new Set()});
  app.mount(root);
  try {
    expect(state.currentBar.value).toBe('5m');expect(show.value).toBe(true);
    find(root,'Setup-Schalter').props.onClick();await nextTick();expect(show.value).toBe(false);
    find(root,'Setup-Schalter').props.onClick();await nextTick();expect(writes).not.toHaveBeenCalled();
    find(root,'Replay-Schritt').props.onClick();await nextTick();expect(state.replayTime.value).toBe(660);
    state.currentBar.value='1h';await nextTick();expect(state.currentBar.value).toBe('1h');
    find(root,'Auswahl schließen').props.onClick();await nextTick();expect(query.value).toEqual({});expect(show.value).toBe(false);
  }finally{app.unmount();}
});
