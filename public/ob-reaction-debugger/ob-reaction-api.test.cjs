const {test}=require('node:test'),assert=require('node:assert/strict');const {reaction,createReactionRunner}=require('./ob-reaction-api.js');
const input={episodeId:'instrument:zone',route:'b',evidence:{touchAt:60,newFvgKnownAt:120},entryCandidate:{entryTime:240,entryPrice:108},stopInput:{direction:'long',orderBlock:{bottom:100,top:110},coverageKnown:true,internalFvgs:[{direction:'long',bottom:102,top:103,recognizedAt:100,firstFarEdgeReach:null}],retest:null}};
test('internal confirmed reaction is not public entry until entry and SL are known',()=>{
 assert.equal(reaction(input,120).status,'pending');assert.equal(reaction(input,239).status,'pending');
 const r=reaction(input,240);assert.equal(r.status,'entry');assert.deepEqual([r.entryPrice,r.entryTime,r.stopLoss],[108,240,100]);assert.equal('target' in r,false);
 assert.equal(reaction({...input,stopInput:{...input.stopInput,coverageKnown:false}},240).status,'pending');
});
test('same episode/route event only once; sequential replay and rewind deterministic',()=>{
 const run=createReactionRunner(input),states=[];for(let t=60;t<=300;t+=60)states.push(run(t));
 assert.equal(states.filter(r=>r.isNew).length,1);assert.equal(run(300).isNew,false);
 assert.equal(run(120).status,'pending');const replay=run(240);assert.equal(replay.status,'entry');assert.equal(replay.isNew,true);assert.equal(replay.eventId,states.find(r=>r.isNew).eventId);
});
test('known route rejection precedes entry and is terminal; old entry is not rewritten by later rejection',()=>{
 const rejected={...input,evidence:{...input.evidence,rejectedAt:180,rejectedReason:'Keine Verteidigung'}};
 assert.equal(reaction(rejected,179).status,'pending');assert.equal(reaction(rejected,240).status,'rejected');
 const later={...input,evidence:{...input.evidence,rejectedAt:300,rejectedReason:'Später'}};assert.equal(reaction(later,360).status,'entry');
});
test('native fixture contracts: 500 a and 502 b can produce complete entries; 503 and isolated 504 b reject',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),ctx={P14_DEBUG_DATA:require('./p14-debug-native-data.json')};
 for(const id of[502,503,504])ctx['OB_MITIGATION_DATA_'+id]=require('./ob-mitigation-native-data-'+id+'.json');
 vm.runInNewContext(fs.readFileSync(__dirname+'/ob-reaction-debugger-cases.js','utf8'),ctx);
 const sources=require('./ob-reaction-sl-evidence.json'),build=require('./ob-reaction-route-input.js').buildReactionRouteInput;
 for(const [id,route,time,status,entry,sl]of[['500','a','14:38','entry',4177.28,4181.45],['502','b','06:39','entry',4117.62,4112.95],['503','a','06:29','rejected'],['504','b','07:54','rejected']]){
  const c=ctx.OB_REACTION_CASES.find(c=>c.id===id),source=sources.cases.find(c=>c.caseID===id),at=Date.parse(c.d.date+'T'+time+':00+02:00')/1000;
  const result=reaction(build(c,source,route),at);assert.equal(result.status,status);
  if(status==='entry'){assert.equal(result.entryPrice,entry);assert.equal(result.stopLoss,sl);assert.equal(result.entryTime,at);}
  if(id==='504')assert.equal(result.scope,'entry-route-b');
 }
});
test('stepper UI has no future tuple, emits the native entry with user-approved SL, and rejects without prices',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='timeframe'?'m1':'',checked:true,classList:{toggle(){}},dataset:{}});return nodes.get(id);};
 const ctx={P14_DEBUG_DATA:require('./p14-debug-native-data.json'),document:{getElementById:get,querySelectorAll:()=>[]},Intl,Date,Number,Math};for(const id of[502,503,504])ctx['OB_MITIGATION_DATA_'+id]=require('./ob-mitigation-native-data-'+id+'.json');vm.runInNewContext(fs.readFileSync(__dirname+'/ob-reaction-debugger-cases.js','utf8'),ctx);
 ctx.window={P14_DEBUG_DATA:ctx.P14_DEBUG_DATA,OB_REACTION_CASES:ctx.OB_REACTION_CASES,OBReactionDebugger:require('./ob-reaction-debugger.js'),OBReactionContact:require('./ob-reaction-contact.js'),OBReactionRendering:require('./ob-reaction-rendering.js'),OBReactionAPI:require('./ob-reaction-api.js'),OBReactionRouteInput:require('./ob-reaction-route-input.js'),OB_REACTION_SL_EVIDENCE:require('./ob-reaction-sl-evidence.json')};vm.runInNewContext((fs.readFileSync(__dirname+'/ob-reaction-entry-source.js','utf8')+'\nwindow.OBReactionEntrySource=OBReactionEntrySource;\n'+fs.readFileSync(__dirname+'/ob-reaction-debugger-ui.js','utf8')),ctx);
 const output=()=>ctx.window.OB_REACTION_DEBUG_STATE().publicResult;
 for(let i=0;i<6;i++){assert.equal(output().status,'pending');assert.equal('entryPrice'in output(),false);get('next').onclick();}
 assert.deepEqual([output().entryPrice,output().stopLoss],[4177.28,4181.45]);const id=output().eventId;assert.equal(output().isNew,true);get('timeframe').onchange();assert.equal(output().eventId,id);assert.equal(output().isNew,false);
 get('previous').onclick();assert.equal(output().status,'pending');get('next').onclick();assert.equal(output().isNew,true);
 get('example').value='502';get('example').onchange();for(let i=0;i<5;i++)get('next').onclick();assert.deepEqual([output().status,output().entryPrice,output().stopLoss],['entry',4117.62,4112.95]);
 for(const pin of['503','504']){get('example').value=pin;get('example').onchange();while(!get('next').disabled)get('next').onclick();assert.equal(output().status,'rejected');assert.equal('entryPrice'in output(),false);assert.equal('stopLoss'in output(),false);}
});
