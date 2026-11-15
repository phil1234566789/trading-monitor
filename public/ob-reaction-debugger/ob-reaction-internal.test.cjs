const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {observeInternalSources}=require('./ob-reaction-internal.js');
const ctx={P14_DEBUG_DATA:require('./p14-debug-native-data.json')};for(const id of[502,503,504])ctx['OB_MITIGATION_DATA_'+id]=require('./ob-mitigation-native-data-'+id+'.json');vm.runInNewContext(fs.readFileSync(__dirname+'/ob-reaction-debugger-cases.js','utf8'),ctx);
const c=id=>ctx.OB_REACTION_CASES.find(c=>c.id===id),at=(c,time)=>Date.parse(c.d.date+'T'+time+':00+02:00')/1000;
test('502 shows 97.44 percent open despite confirmed new FVG, and later old OB holds at 11.29 percent',()=>{
 const early=observeInternalSources(c('502'),at(c('502'),'06:32'));
 assert.equal(early.oldFvg.filled,false);assert.ok(Math.abs(early.oldFvg.fraction*100-97.435897)<.001);assert.equal(early.internalOb.touched,false);
 const later=observeInternalSources(c('502'),at(c('502'),'06:51'));assert.equal(later.oldFvg.filled,true);assert.equal(later.internalOb.held,true);assert.ok(Math.abs(later.internalOb.fraction*100-11.290322)<.001);
});
test('500 observations arrive by closed knowledge, while no old 504 FVG is not a rejection',()=>{
 assert.equal(observeInternalSources(c('500'),at(c('500'),'14:33')).oldFvg.filled,false);
 assert.equal(observeInternalSources(c('500'),at(c('500'),'14:35')).oldFvg.filled,true);
 assert.equal(observeInternalSources(c('500'),at(c('500'),'14:36')).internalOb.held,true);
 assert.equal(observeInternalSources(c('504'),at(c('504'),'07:47')).oldFvg.present,false);
});
