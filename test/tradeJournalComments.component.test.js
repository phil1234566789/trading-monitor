import {it,expect,vi} from 'vitest';
import * as Vue from 'vue';
import {parse,compileScript} from '@vue/compiler-sfc';
import {compile} from '@vue/compiler-dom';
import {readFileSync} from 'node:fs';
import Comments from '../src/components/TradeJournalComments.vue';
import ActionButton from '../src/components/ui/ActionButton.vue';

for(const [component,file] of [[Comments,'TradeJournalComments'],[ActionButton,'ui/ActionButton']]){
 const {descriptor}=parse(readFileSync(new URL(`../src/components/${file}.vue`,import.meta.url),'utf8'));
 component.render=new Function('Vue',compile(descriptor.template.content,{mode:'function',prefixIdentifiers:true,bindingMetadata:compileScript(descriptor,{id:file}).bindings}).code)(Vue);
}
const renderer=Vue.createRenderer({
 createElement:type=>({type,tagName:type.toUpperCase(),children:[],props:{},options:[],addEventListener(){},getRootNode:()=>({activeElement:null})}),createText:text=>({text}),createComment:text=>({text}),
 setText:(n,text)=>{n.text=text;},setElementText:(n,text)=>{n.text=text;},patchProp:(n,k,old,value)=>{n.props[k]=value;},
 insert:(n,p)=>{n.parent=p;p.children.push(n);},remove:n=>{n.parent.children=n.parent.children.filter(x=>x!==n);},parentNode:n=>n.parent,nextSibling:()=>null,
});
const all=n=>[n,...(n.children??[]).flatMap(all)];
const settle=async()=>{await new Promise(resolve=>setImmediate(resolve));await Vue.nextTick();};
it('reads, retries with the same UUID and corrects shared private comments',async()=>{
 vi.stubGlobal('document',{activeElement:null});
 vi.stubGlobal('Document',class Document{});vi.stubGlobal('ShadowRoot',class ShadowRoot{});
 const root={children:[]},stored=new Map(),saves=[];let fail=true;
 const api=vi.fn(async(action,input)=>{
  if(action==='journal_comments')return input.after_id?{rows:[],next_cursor:null}:{rows:[...stored.values()],next_cursor:[...stored.keys()].at(-1)??null};
  saves.push(input);
  if(fail){fail=false;throw new Error('timeout');}
  const previous=stored.get(input.id);
  stored.set(input.id,{...input,trade_position_id:input.position_id,created_at:previous?.created_at??input.occurred_at,updated_at:input.occurred_at});return {comment:stored.get(input.id)};
 });
 const app=renderer.createApp(Comments,{positionId:42,api});app.provide(Vue.ssrContextKey,{modules:new Set()});app.mount(root);
 try{
  await settle();
  all(root).find(n=>n.type==='textarea').props['onUpdate:modelValue']('Philip: zu früh.');await Vue.nextTick();
  const submit=()=>all(root).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
  await submit();await settle();expect(saves).toHaveLength(1);
  await submit();await settle();expect(saves[1].id).toBe(saves[0].id);expect(stored.size).toBe(1);
  const correct=all(root).find(n=>n.type==='button'&&all(n).some(x=>x.text==='Korrigieren'));
  correct.props.onClick();await Vue.nextTick();
  all(root).find(n=>n.type==='textarea').props['onUpdate:modelValue']('Korrigierte Aussage');await Vue.nextTick();
  await submit();await settle();expect(stored.size).toBe(1);expect(saves[2]).toMatchObject({id:saves[0].id,position_id:42,body:'Korrigierte Aussage',kind:'statement'});
  expect(all(root).some(n=>n.text==='Korrigierte Aussage')).toBe(true);
 }finally{app.unmount();vi.unstubAllGlobals();}
});
