const {test}=require('node:test'),assert=require('node:assert/strict');const {evaluateReactionStop}=require('./ob-reaction-sl.js');
const input={direction:'long',orderBlock:{bottom:100,top:110},reactionState:'true',entryKnownAt:200,coverageKnown:true,internalFvgs:[{direction:'long',bottom:102,top:104,recognizedAt:120,firstFarEdgeReach:null}],retest:{knownAt:190,low:101,high:109}};
test('any known open internal FVG chooses outer M5 edge, including later formed nested FVG',()=>{
 assert.equal(evaluateReactionStop(input,200).price,100);
 const r=evaluateReactionStop({...input,internalFvgs:[{...input.internalFvgs[0],firstFarEdgeReach:{knownAt:180}},{...input.internalFvgs[0],bottom:103,top:103.5,recognizedAt:199}]},200);assert.equal(r.anchor,'m5-edge');
});
test('all filled chooses known retest extreme, symmetric and without an invented buffer',()=>{
 const filled={...input,internalFvgs:[{...input.internalFvgs[0],firstFarEdgeReach:{knownAt:180}}]};
 assert.equal(evaluateReactionStop(filled,200).price,101);assert.equal(evaluateReactionStop(filled,200).buffer,null);
 assert.equal(evaluateReactionStop({...filled,direction:'short',internalFvgs:[]},200).price,109);
});
test('future fill does not tighten old entry; incomplete data and false never invent an SL',()=>{
 assert.equal(evaluateReactionStop({...input,internalFvgs:[{...input.internalFvgs[0],firstFarEdgeReach:{knownAt:250}}]},300).price,100);
 assert.equal(evaluateReactionStop({...input,coverageKnown:false},200).status,'unknown');
 assert.equal(evaluateReactionStop({...input,reactionState:'false'},200).status,'no-entry');
 assert.equal(evaluateReactionStop({...input,internalFvgs:[],retest:{knownAt:250,low:90,high:120}},200).status,'unknown');
 assert.equal(evaluateReactionStop(input,199).status,'pending');
});
test('relevant partially overlapping FVG makes a tight SL unknown; future overlap is ignored',()=>{
 const partial={direction:'long',bottom:99,top:103,recognizedAt:150,firstFarEdgeReach:null};
 assert.equal(evaluateReactionStop({...input,internalFvgs:[partial]},200).status,'unknown');
 assert.equal(evaluateReactionStop({...input,internalFvgs:[...input.internalFvgs,partial]},200).anchor,'m5-edge');
 assert.equal(evaluateReactionStop({...input,internalFvgs:[{...partial,recognizedAt:201}]},200).anchor,'retest-extreme');
});
test('explicit pre-existing-role policy separates old rest FVGs from a new reaction confirmation',()=>{
 const old={...input.internalFvgs[0],role:'preExistingInternal',firstFarEdgeReach:{knownAt:180}},fresh={...input.internalFvgs[0],recognizedAt:200,role:'reactionConfirmation'};
 const r=evaluateReactionStop({...input,rolePolicy:'preExistingOnly',internalFvgs:[old,fresh]},200);assert.equal(r.anchor,'retest-extreme');assert.equal(r.price,101);
});
