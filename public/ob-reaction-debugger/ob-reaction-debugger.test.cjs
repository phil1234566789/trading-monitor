const {test}=require('node:test'),assert=require('node:assert/strict');
const {evaluateOrderBlockReaction,stepAt,closedCandles}=require('./ob-reaction-debugger.js');
test('zone rendering ends at touch only after that touch is known, not at full fill',()=>{
 const {zoneEndAt}=require('./ob-reaction-rendering.js');
 const zone={firstOverlap:{candleTime:200,knownAt:260},firstFarEdgeReach:{candleTime:400,knownAt:460},touchedTime:200,invalidated:true,endTime:400};
 assert.equal(zoneEndAt(zone,259),259);
 assert.equal(zoneEndAt(zone,260),200);
 assert.equal(zoneEndAt(zone,460),200);
 assert.equal(zoneEndAt(zone,150),150);
});
test('standalone end-time helper is identical to the existing repository helper',()=>{
 const fs=require('node:fs');const original=fs.readFileSync(require('node:path').resolve(__dirname,'../../src/orderBlocks.js'),'utf8').match(/export function orderBlockEndTime\(zone, openEnd = Infinity\) \{[\s\S]*?\n\}/)[0].replace('export ','');
 assert.equal(require('./ob-reaction-rendering.js').orderBlockEndTime.toString(),original);
});
test('all native bundled M1/M5 zones have causal firstOverlap independent of final flags',()=>{
 const {zoneEndAt}=require('./ob-reaction-rendering.js');
 for(const id of[502,503,504]){const d=require('./ob-mitigation-native-data-'+id+'.json');
  for(const z of[d.targetOrderBlock,...d.orderBlocks.m1,...d.orderBlocks.m5]){
   assert.ok(Object.hasOwn(z,'firstOverlap'));
   const t=z.firstOverlap;if(!t)continue;
   assert.equal(zoneEndAt(z,t.knownAt-1),t.knownAt-1);
   assert.equal(zoneEndAt(z,t.knownAt),t.candleTime);
  }
 }
});
const evidence={touchAt:100,oldFvgFilledAt:200,internalObReactionAt:220,newFvgKnownAt:240};
test('knowledge arrives causally; no new FVG means unknown, never automatic false',()=>{
 assert.equal(evaluateOrderBlockReaction(evidence,239).state,'unknown');
 assert.equal(evaluateOrderBlockReaction(evidence,240).state,'true');
 assert.equal(evaluateOrderBlockReaction({...evidence,oldFvgFilledAt:null,internalObReactionAt:null},300).state,'true');
 assert.equal(evaluateOrderBlockReaction({...evidence,newFvgKnownAt:null},300).state,'unknown');
});
test('Entry B full-fill M1 depth rejects only when known; earlier reaction and M5 depth stay separate',()=>{
 const e={touchAt:100,newFvgKnownAt:200,m5Depth:.98,entryContext:{aUnsuitableAt:210,aReason:'Gegen-FVG laut Nutzer',b:{fullFillAt:230,maxDepth:.5,tests:[{knownAt:240,depth:.5},{knownAt:250,depth:.5001}]}}};
 assert.equal(evaluateOrderBlockReaction(e,199).state,'unknown');
 assert.equal(evaluateOrderBlockReaction(e,200).state,'true');
 assert.equal(evaluateOrderBlockReaction(e,240).state,'true');
 assert.equal(evaluateOrderBlockReaction(e,250).state,'false');
 assert.equal(evaluateOrderBlockReaction(e,200).state,'true');
 assert.equal(evaluateOrderBlockReaction({...e,entryContext:{b:{...e.entryContext.b,fullFillAt:300}}},250).state,'true');
});
test('no hardcoded case identity and no future evidence in trace',()=>{
 const result=evaluateOrderBlockReaction(evidence,150);
 assert.equal(result.trace.filter(x=>x.available).length,1);
 assert.equal(evaluateOrderBlockReaction({...evidence,pinId:501},240).state,'true');
});
test('stepper clamps and only closed timeframe candles reach the chart',()=>{
 assert.equal(stepAt(-1,[100,200]),100);assert.equal(stepAt(9,[100,200]),200);
 assert.deepEqual(closedCandles([{time:100},{time:160}],220,60),[{time:100},{time:160}]);
 assert.deepEqual(closedCandles([{time:100},{time:160}],219,60),[{time:100}]);
});
test('native bundle UI reaches true only on the final known FVG, and rewind removes it',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
 const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='timeframe'?'m1':'',checked:true,classList:{toggle(){}},dataset:{}});return nodes.get(id);};
 const context={window:{P14_DEBUG_DATA:require('./p14-debug-native-data.json'),OBReactionDebugger:require('./ob-reaction-debugger.js'),OBReactionContact:require('./ob-reaction-contact.js'),OBReactionRendering:require('./ob-reaction-rendering.js')},document:{getElementById:get,querySelectorAll:()=>[]},Intl,Date,Number,Math};
 context.P14_DEBUG_DATA=context.window.P14_DEBUG_DATA;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'ob-reaction-debugger-cases.js'),'utf8'),context);context.window.OB_REACTION_CASES=context.OB_REACTION_CASES;
 vm.runInNewContext((fs.readFileSync(__dirname+'/ob-reaction-entry-source.js','utf8')+'\nwindow.OBReactionEntrySource=OBReactionEntrySource;\n'+fs.readFileSync(path.join(__dirname,'ob-reaction-debugger-ui.js'),'utf8')),context);
 for(let i=0;i<6;i++){assert.equal(context.window.OB_REACTION_DEBUG_STATE().result.state,'unknown');get('next').onclick();}
 const final=context.window.OB_REACTION_DEBUG_STATE();assert.equal(final.result.state,'true');
 assert.equal(new Date(final.asOf*1000).toISOString(),'2026-10-16T12:38:00.000Z');
 get('previous').onclick();assert.equal(context.window.OB_REACTION_DEBUG_STATE().result.state,'unknown');
 const futureData=JSON.parse(JSON.stringify(context.window.P14_DEBUG_DATA));
 futureData.candles.m1.find(c=>new Date(c.time*1000).toISOString()==='2026-10-16T12:41:00.000Z').high=99999;
 const nodes2=new Map(),get2=id=>{if(!nodes2.has(id))nodes2.set(id,{value:id==='timeframe'?'m1':'',checked:true,classList:{toggle(){}},dataset:{}});return nodes2.get(id);};
 const second={...context,window:{...context.window,P14_DEBUG_DATA:futureData},document:{getElementById:get2,querySelectorAll:()=>[]}};
 second.P14_DEBUG_DATA=futureData;vm.runInNewContext(fs.readFileSync(path.join(__dirname,'ob-reaction-debugger-cases.js'),'utf8'),second);second.window.OB_REACTION_CASES=second.OB_REACTION_CASES;
 vm.runInNewContext((fs.readFileSync(__dirname+'/ob-reaction-entry-source.js','utf8')+'\nwindow.OBReactionEntrySource=OBReactionEntrySource;\n'+fs.readFileSync(path.join(__dirname,'ob-reaction-debugger-ui.js'),'utf8')),second);
 while(context.window.OB_REACTION_DEBUG_STATE().index>0)get('previous').onclick();
 assert.equal(get2('chart').innerHTML,get('chart').innerHTML,'future OHLC must not alter initial candles, zones or price axis');
});
test('native 502/503/504 boundaries keep confirmed reaction, rejection and unresolved M5 assignment separate',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ctx={P14_DEBUG_DATA:require('./p14-debug-native-data.json')};
 for(const id of[502,503,504])ctx['OB_MITIGATION_DATA_'+id]=require('./ob-mitigation-native-data-'+id+'.json');
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'ob-reaction-debugger-cases.js'),'utf8'),ctx);
 const c=id=>ctx.OB_REACTION_CASES.find(c=>c.id===id),at=(c,hm)=>Date.parse(c.d.date+'T'+hm+':00+02:00')/1000;
 assert.match(c('500').title,/16\.10\.2026/);assert.match(c('500').title,/Short · erwartet: passt$/);assert.match(c('502').title,/Long · erwartet: passt$/);assert.match(c('503').title,/Long · erwartet: passt nicht$/);assert.match(c('504').title,/Long · erwartet: Entry b passt nicht \/ Near-Touch akzeptiert$/);
 assert.equal(c('502').from,at(c('502'),'05:12'),'502 includes the four-candle M1 formation from 05:12');
 for(const hm of['06:32','06:39','06:51'])assert.equal(evaluateOrderBlockReaction(c('502').evidence,at(c('502'),hm)).state,'true');
 assert.ok(c('502').evidence.entryContext.b.tests.some(t=>t.knownAt===at(c('502'),'06:39')),'complete B window includes 06:38 candle, known 06:39');
 assert.equal(evaluateOrderBlockReaction(c('503').evidence,at(c('503'),'06:28')).state,'unknown');
 assert.equal(evaluateOrderBlockReaction(c('503').evidence,at(c('503'),'06:29')).state,'false');
 assert.equal(evaluateOrderBlockReaction(c('504').evidence,at(c('504'),'07:53')).state,'unknown');
 assert.equal(evaluateOrderBlockReaction(c('504').evidence,at(c('504'),'07:54')).state,'false');
 assert.ok(c('504').evidence.touchAt>at(c('504'),'07:54'),'never fabricate claimed 07:34 M5 touch');
});
test('known FVG selects branch b even while overall unknown or later Entry B rejected',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),nodes=new Map();
 const branch=dataset=>({dataset,querySelector:()=>({}),setAttribute(){}}),waiting=branch({reactionBranch:'waiting'}),confirmed=branch({reactionBranch:'confirmed'}),a=branch({entryBranch:'a'}),b=branch({entryBranch:'b'});
 const get=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='timeframe'?'m1':'',checked:true,classList:{toggle(){}},dataset:{}});return nodes.get(id);};
 const ctx={P14_DEBUG_DATA:require('./p14-debug-native-data.json'),document:{getElementById:get,querySelectorAll:s=>s==='[data-reaction-branch]'?[waiting,confirmed]:s==='[data-entry-branch]'?[a,b]:[]},Intl,Date,Number,Math};
 for(const id of[502,503,504])ctx['OB_MITIGATION_DATA_'+id]=require('./ob-mitigation-native-data-'+id+'.json');
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'ob-reaction-debugger-cases.js'),'utf8'),ctx);
 ctx.window={P14_DEBUG_DATA:ctx.P14_DEBUG_DATA,OB_REACTION_CASES:ctx.OB_REACTION_CASES,OBReactionDebugger:require('./ob-reaction-debugger.js'),OBReactionContact:require('./ob-reaction-contact.js'),OBReactionRendering:require('./ob-reaction-rendering.js'),location:{hash:'#504'}};
 vm.runInNewContext((fs.readFileSync(__dirname+'/ob-reaction-entry-source.js','utf8')+'\nwindow.OBReactionEntrySource=OBReactionEntrySource;\n'+fs.readFileSync(path.join(__dirname,'ob-reaction-debugger-ui.js'),'utf8')),ctx);
 assert.equal(waiting.dataset.branchState,'pending');assert.equal(confirmed.dataset.branchState,'pending');
 for(let i=0;i<6;i++)get('next').onclick();assert.equal(ctx.window.OB_REACTION_DEBUG_STATE().result.state,'false');
 assert.equal(confirmed.dataset.branchState,'selected');assert.equal(waiting.dataset.branchState,'inactive');assert.equal(b.dataset.branchState,'inactive');
 get('previous').onclick();assert.equal(ctx.window.OB_REACTION_DEBUG_STATE().result.state,'unknown');assert.equal(confirmed.dataset.branchState,'selected');assert.equal(b.dataset.branchState,'pending');
 for(const id of['502','503','504']){
  get('example').value=id;get('example').onchange();
  const c=ctx.OB_REACTION_CASES.find(c=>c.id===id);
  function assertRectangle(){const asOf=ctx.window.OB_REACTION_DEBUG_STATE().asOf,touch=c.main.firstOverlap;const expected=touch&&touch.knownAt<=asOf?touch.candleTime:asOf;
   const match=get('chart').innerHTML.match(/<rect data-zone-end="([0-9]+)"[^>]*><title>M5-OB /);assert.ok(match);assert.equal(Number(match[1]),expected,'actual '+id+' M5 rectangle obeys known native touch');}
  assertRectangle();while(!get('next').disabled){get('next').onclick();assertRectangle();}
 }
});
test('resolved opponent before new FVG does not block Entry A; later state stays causal',()=>{const e={touchAt:100,newFvgKnownAt:200,entryContext:{aUnsuitableAt:200,aUnsuitableUntil:180,aReason:'opponent'}};assert.equal(evaluateOrderBlockReaction(e,200).entryA,'offen');assert.equal(evaluateOrderBlockReaction({...e,entryContext:{...e.entryContext,aUnsuitableAt:150}},160).entryA,'ungeeignet laut Nutzer');});

test('node details open by native click only, not hover or focus',()=>{const fs=require('node:fs'),s=fs.readFileSync(__dirname+'/ob-reaction-graph-ui.js','utf8');assert.ok(s.includes("addEventListener('click',()=>details(id))"));assert.ok(!s.includes("addEventListener('mouseenter'"));assert.ok(!s.includes("addEventListener('focus'"));});
