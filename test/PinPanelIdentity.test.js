import {afterEach,expect,it,vi} from 'vitest';
import * as Vue from 'vue';
import {parse,compileScript} from '@vue/compiler-sfc';
import {compile} from '@vue/compiler-dom';
import {readFileSync} from 'node:fs';
import PinPanel from '../src/components/PinPanel.vue';
import PinTypeChips from '../src/components/PinTypeChips.vue';
import {COPIED_FEEDBACK_MS} from '../src/priceChartConstants.js';
for(const [component,file] of [[PinPanel,'PinPanel.vue'],[PinTypeChips,'PinTypeChips.vue']]){
 const {descriptor}=parse(readFileSync(new URL('../src/components/'+file,import.meta.url),'utf8'));
 component.render=new Function('Vue',compile(descriptor.template.content,{mode:'function',prefixIdentifiers:true,
  bindingMetadata:compileScript(descriptor,{id:file}).bindings}).code)(Vue);
}
const all=n=>[n,...(n.children??[]).flatMap(all)];
const renderer=Vue.createRenderer({createElement:type=>({type,children:[],props:{},focus:vi.fn(),select:vi.fn()}),
 createText:text=>({text}),createComment:()=>({}),setText:(n,t)=>n.text=t,setElementText:(n,t)=>n.text=t,
 patchProp:(n,k,old,v)=>{n.props[k]=v;if(k==='value')n.value=v;},
 insert:(n,p,anchor)=>{n.parent=p;const at=p.children.indexOf(anchor);if(at<0)p.children.push(n);else p.children.splice(at,0,n);},
 remove:n=>n.parent.children.splice(n.parent.children.indexOf(n),1),parentNode:n=>n.parent,nextSibling:()=>null});
let app;
afterEach(()=>{app?.unmount();app=null;vi.useRealTimers();vi.unstubAllGlobals();});
const entry={id:472,kind:'trade_setup',tradeSetupId:2852,obZoneId:4683329,
 tradeSetup:{instrument:'GBPUSD',direction:'short',obTop:1.33,obBottom:1.32},note:'unchanged'};
function mount(entries=[entry]){
 const root={children:[]},events={onSelect:vi.fn(),onRemove:vi.fn(),'onUpdate-note':vi.fn()};
 app=renderer.createApp(PinPanel,{entries,trades:[],...events});
 app.provide(Vue.ssrContextKey,{modules:new Set()});app.component('RouterLink',{render:()=>null});app.mount(root);
 return {root,events};
}
function copyButton(root,id=472){return all(root).find(n=>n.type==='button'&&n.props['aria-label']===`Pin-ID ${id} kopieren`);}
function click(root,button){
 const stopPropagation=vi.fn(),card=all(root).find(n=>n.props?.class==='pin-panel-entry');
 card.querySelector=()=>all(card).find(n=>n.type==='input'&&n.props.class==='pin-id-fallback');
 return {event:{stopPropagation,currentTarget:{closest:()=>card}},stopPropagation};
}
it.each(['trade_setup','ob_zone','m5_liquidity_level','rsi_divergence'])('shows the pin identity for %s without confusing its source ID',kind=>{
 const {root}=mount([{...entry,kind}]);
 expect(all(root).some(n=>n.text==='Pin #472')).toBe(true);
 expect(copyButton(root)).toBeTruthy();
});
it('uses the entire visible pin label as the single native copy control without a normal-state input or icon',()=>{
 const {root}=mount(),button=copyButton(root);
 expect(button.text).toBe('Pin #472');
 expect(button.props.type).toBe('button');
 expect(all(button).some(n=>n.props?.['aria-hidden']==='true')).toBe(false);
 expect(all(root).some(n=>n.type==='input'&&n.props.class==='pin-id-fallback')).toBe(false);
 expect(all(root).filter(n=>n.text==='Pin #472')).toHaveLength(1);
});
it('copies only pin.id and leaves row navigation, source labels, note and removal intact',async()=>{
 vi.useFakeTimers();const writeText=vi.fn().mockResolvedValue();vi.stubGlobal('navigator',{clipboard:{writeText}});
 const {root,events}=mount(),button=copyButton(root),{event,stopPropagation}=click(root,button);
 await button.props.onClick(event);await Vue.nextTick();
 expect(writeText).toHaveBeenCalledExactlyOnceWith('472');expect(stopPropagation).toHaveBeenCalledOnce();
 expect(events.onSelect).not.toHaveBeenCalled();expect(events.onRemove).not.toHaveBeenCalled();
 expect(all(root).some(n=>n.text?.includes('Setup #2852'))).toBe(true);
 expect(all(root).some(n=>n.props?.role==='status'&&n.text?.includes('kopiert'))).toBe(true);
 expect(all(root).find(n=>n.type==='textarea').props.value).toBe('unchanged');
 all(root).find(n=>n.props?.class==='pin-panel-remove').props.onClick();expect(events.onRemove).toHaveBeenCalledWith(472);
 const row=all(root).find(n=>n.props?.class==='pin-panel-entry');row.props.onClick({target:{closest:()=>null}});
 expect(events.onSelect).toHaveBeenCalledWith(entry);
 vi.advanceTimersByTime(COPIED_FEEDBACK_MS);await Vue.nextTick();
 expect(all(root).some(n=>n.props?.role==='status')).toBe(false);
});
it.each(['denied','unavailable'])('selects only the pin ID for manual copying when clipboard is %s',async mode=>{
 vi.stubGlobal('navigator',mode==='denied'?{clipboard:{writeText:vi.fn().mockRejectedValue(new Error('denied'))}}:{});
 const {root,events}=mount(),button=copyButton(root),{event}=click(root,button);
 await button.props.onClick(event);await Vue.nextTick();
 const input=all(root).find(n=>n.props?.class==='pin-id-fallback');
 expect(input.props.readonly).not.toBeUndefined();expect(input.props.value).toBe('472');
 expect(input.focus).toHaveBeenCalledOnce();expect(input.select).toHaveBeenCalledOnce();
 expect(all(root).some(n=>n.props?.role==='status'&&n.text?.includes('manuell'))).toBe(true);
 expect(events.onSelect).not.toHaveBeenCalled();expect(events.onRemove).not.toHaveBeenCalled();
});
it('keeps feedback on the latest pin and clears its timer when the panel closes',async()=>{
 vi.useFakeTimers();let finish;
 const writeText=vi.fn().mockImplementationOnce(()=>new Promise(r=>finish=r)).mockResolvedValueOnce();
 vi.stubGlobal('navigator',{clipboard:{writeText}});
 const {root}=mount([entry,{...entry,id:473}]);
 const first=copyButton(root),second=copyButton(root,473);
 const pending=first.props.onClick(click(root,first).event);
 await second.props.onClick(click(root,second).event);await Vue.nextTick();
 finish();await pending;await Vue.nextTick();
 const cards=all(root).filter(n=>n.props?.class==='pin-panel-entry');
 expect(all(cards[0]).some(n=>n.props?.role==='status')).toBe(false);
 expect(all(cards[1]).some(n=>n.props?.role==='status'&&n.text?.includes('kopiert'))).toBe(true);
 expect(writeText.mock.calls.map(c=>c[0])).toEqual(['472','473']);
 app.unmount();app=null;expect(vi.getTimerCount()).toBe(0);
});
