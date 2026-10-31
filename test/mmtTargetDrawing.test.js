import {afterEach,describe,it,expect,vi} from 'vitest';
import {createRenderer,h,nextTick} from 'vue';
import {useMmtTargetDrawing} from '../src/composables/useMmtTargetDrawing.js';
import {setTargetDraft,removeTargetDraft,useTargetDraft,selectTargetDraft} from '../src/mmtTargetDrafts.js';
vi.mock('../src/chartColors.js',()=>({cssColor:()=> '#00ff00'}));
vi.mock('../src/liquidity.js',()=>({LiquidityLinePrimitive:class {constructor(level,options){this.level=level;this.options=options;}distanceTo(){return 0;}}}));
const renderer=createRenderer({createElement:()=>({children:[]}),createText:()=>({}),createComment:()=>({}),setText:()=>{},setElementText:()=>{},patchProp:()=>{},insert:(n,p)=>p.children.push(n),remove:()=>{},parentNode:()=>null,nextSibling:()=>null});
let app;afterEach(()=>{app?.unmount();removeTargetDraft('one');vi.unstubAllGlobals();});
describe('existing TP line dragging',()=>{
 it('moves a browser draft only and restores chart scrolling on release',async()=>{
  const handlers={},doc={addEventListener:(e,f)=>handlers[e]=f,removeEventListener:vi.fn()};vi.stubGlobal('document',doc);
  let drawing,draft;
  app=renderer.createApp({setup(){drawing=useMmtTargetDrawing();draft=useTargetDraft('one');return()=>h('div');}});app.mount({children:[]});
  const element={addEventListener:(e,f)=>handlers[e]=f,removeEventListener:vi.fn(),getBoundingClientRect:()=>({left:100,top:20})};
  const chart={options:()=>({handleScroll:{mouseWheel:true}}),applyOptions:vi.fn()};
  const series={attachPrimitive:vi.fn(),detachPrimitive:vi.fn(),coordinateToPrice:y=>2000+y};
  setTargetDraft('one',{symbol:'XAUUSD',targets:[{price:2010,volume:.01},{price:2010,volume:''}],entryPrice:2000,initialSl:1990,direction:'long',digits:2,dirty:false});
  drawing.create(chart,series,element);drawing.refresh({symbol:'XAUUSD',candles:[{time:100}],currentBar:'1m'});await nextTick();
  expect(series.attachPrimitive).toHaveBeenCalledTimes(2);
  const event={button:0,target:{tagName:'CANVAS'},clientX:120,clientY:50,preventDefault:vi.fn(),stopPropagation:vi.fn()};
  handlers.pointerdown(event);handlers.pointermove({...event,clientY:60});await nextTick();
  expect(draft.value.targets[0].price).toBe(2010);expect(draft.value.targets[1].price).toBe(2010);expect(chart.applyOptions).not.toHaveBeenCalled();
  selectTargetDraft('one',1);await nextTick();
  handlers.pointerdown(event);handlers.pointermove({...event,clientY:60});await nextTick();
  expect(draft.value.targets[0].price).toBe(2010);expect(draft.value.targets[1].price).toBe(2040);expect(draft.value.dirty).toBe(true);
  handlers.pointerup();expect(chart.applyOptions).toHaveBeenLastCalledWith({handleScroll:{mouseWheel:true}});
  drawing.dispose();expect(element.removeEventListener).toHaveBeenCalled();
 });
});
