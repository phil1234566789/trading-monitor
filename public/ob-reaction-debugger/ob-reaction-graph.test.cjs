const {test}=require('node:test'),assert=require('node:assert/strict');
const {reactionGraphState}=require('./ob-reaction-graph.js');
test('redundant reference paragraph is absent while the expected labels remain in the dropdown data',()=>{
 const fs=require('node:fs'),html=fs.readFileSync(__dirname+'/ob-reaction-debugger.html','utf8');
 assert.equal(html.includes('id="reference-label"'),false);assert.equal(html.includes('Referenzbewertung des gesamten Beispiels'),false);
 assert.ok(fs.readFileSync(__dirname+'/ob-reaction-debugger-cases.js','utf8').includes(' · erwartet: '));
});
test('all price-source nodes use their element direction, and known enemy routes a to rejection and b onward',()=>{
 const {reactionNodeLabel}=require('./ob-reaction-graph.js');
 assert.match(reactionNodeLabel('start',1),/Long/);assert.match(reactionNodeLabel('touch',1),/Bullischer M5-OB/);
 assert.match(reactionNodeLabel('counter',1),/☠️.*bärische M1-FVG im Weg/);assert.match(reactionNodeLabel('counter',-1),/bullische M1-FVG im Weg/);
 assert.match(reactionNodeLabel('oldFvg',1,{oldDirection:'short'}),/bärische/);
 const e={touchAt:100,newFvgKnownAt:200,entryContext:{aUnsuitableAt:200,b:{fullFillAt:240}}};
 assert.equal(reactionGraphState(e,199,{state:'unknown',entryA:'offen',entryB:'offen'}).nodes.counter,'not-visited');
 const g=reactionGraphState(e,200,{state:'true',entryA:'ungeeignet laut Nutzer',entryB:'offen'});assert.equal(g.nodes.counter,'visited');assert.equal(g.edges.reactionA,'rejected');assert.equal(g.nodes.entryB,'unknown');assert.equal(g.edges.reactionB,'visited');
});
test('FVG question follows Long/Short and stays distinct from case outcome',()=>{
 const {reactionFvgLabel}=require('./ob-reaction-graph.js');
 assert.equal(reactionFvgLabel(1),'Neue bullische M1-FVG?');
 assert.equal(reactionFvgLabel(-1),'Neue bärische M1-FVG?');
});
test('not visited, unknown, visited and rejected remain distinct on a causal path',()=>{
 const evidence={touchAt:100,newFvgKnownAt:200,entryContext:{aUnsuitableAt:200,b:{fullFillAt:230,confirmedAt:260}}};
 const state=(t,result)=>reactionGraphState(evidence,t,result);
 assert.equal(state(90,{state:'unknown',entryA:'offen',entryB:'offen'}).nodes.touch,'unknown');
 assert.equal(state(90,{state:'unknown',entryA:'offen',entryB:'offen'}).nodes.fvg,'not-visited');
 assert.equal(state(150,{state:'unknown',entryA:'offen',entryB:'offen'}).nodes.wait,'unknown');
 const rejected=state(250,{state:'false',entryA:'ungeeignet laut Nutzer',entryB:'abgelehnt'});
 assert.equal(rejected.nodes.fvg,'visited');assert.equal(rejected.nodes.wait,'alternative');
 assert.equal(rejected.nodes.entryB,'rejected');assert.equal(rejected.edges.fvgReaction,'visited');
});
