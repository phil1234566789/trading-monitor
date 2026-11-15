const{test}=require('node:test'),assert=require('node:assert/strict');
const{buildNativeReactionCase}=require('./ob-reaction-native-adapter.js');
const contact=require('./ob-reaction-contact.js'),render=require('./ob-reaction-rendering.js'),proto=require('./ob-reaction-debugger.js');
const zone={dir:-1,bottom:100,top:110,startTime:480,recognizedAt:600};
const rows=[600,660,720,780,840].map(time=>({time,open:102,high:104,low:99,close:101}));
const near={direction:'short',candleTime:600,recognizedAt:720,top:102,bottom:101},exact={...near,candleTime:720,recognizedAt:840};
function helpers(){return{...contact,...render,closedChecklistCandles:(xs,tf,at)=>xs.filter(c=>c.time+60<=at),m1FvgEntryCandidates:()=>[near,exact],evaluateOrderBlockMitigation:()=>({fvg:exact}),m1FvgEntryPrefill:({fvg})=>({status:'ready',entryTime:fvg.recognizedAt,entryPrice:101})};}
test('keeps existing mitigation and first-near source projections separate without pin-specific branching',()=>{
 const base=buildNativeReactionCase({orderBlock:zone,candles:rows,evaluatedAt:900},helpers());
 assert.equal(base.newFvg.recognizedAt,840);assert.equal(base.sourceSelection.firstNearCandidateKnownAt,720);assert.equal(base.sourceSelection.different,true);
 const early=buildNativeReactionCase({orderBlock:zone,candles:rows,evaluatedAt:900,sourceMode:'firstNear'},helpers());assert.equal(early.newFvg.recognizedAt,720);
 assert.equal(base.source.assessments[0].retestEpisode.status,'unknown');
});
test('missing native warmup does not become a confirmed internal reaction',()=>{
 const result=buildNativeReactionCase({orderBlock:zone,candles:rows.slice(1),evaluatedAt:900},helpers());
 assert.equal(result.coverage.status,'unknown');assert.equal(result.c.evidence.newFvgKnownAt,null);assert.equal(proto.evaluateOrderBlockReaction(result.c.evidence,900).state,'unknown');
});
test('later wick break does not retroactively reject the already known first mitigation',()=>{
 const corrected=rows.map(c=>c.time===840?{...c,high:111}:c),result=buildNativeReactionCase({orderBlock:zone,candles:corrected,evaluatedAt:900},helpers());
 assert.equal(result.c.evidence.rejectedAt,null);assert.equal(proto.evaluateOrderBlockReaction(result.c.evidence,840).state,'true');
});
