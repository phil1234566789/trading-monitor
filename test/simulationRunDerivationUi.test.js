import {it,expect} from 'vitest';import {createSSRApp} from 'vue';import {renderToString} from 'vue/server-renderer';
import Component from '../src/components/SimulationRunDerivation.vue';
import {createRunDerivation} from '../src/simulationRunDerivation.js';
const run={provenance:{derivation:createRunDerivation({parentRunId:'parent',parentSetupVersion:'v23',parentEntryPattern:'v10',targetSetupVersion:'v24',targetEntryPattern:'v11',inheritedSetupKeys:['old'],recomputedSetupKeys:['new']})}};
it('makes inherited versus recomputed records visible without relabeling their versions',async()=>{
 const render=props=>renderToString(createSSRApp(Component,props));
 expect(await render({run})).toContain('Teilweise neu berechnet');expect(await render({run})).toContain('1 DRs neu berechnet');
 const old=await render({run,setupKey:'old'});expect(old).toContain('v23 / Entry v10');expect(old).toContain('nicht neu berechnet');expect(old).not.toContain('v24');
 expect(await render({run,setupKey:'new'})).toContain('v24 / Entry v11');expect(await render({run:{id:'ordinary'}})).not.toContain('Ursprungslauf');
});
import DrList from '../src/components/SimulationDrList.vue';import {reviewGroups} from '../src/simulationRunComparison.js';
it('uses original setup keys from real review groups in the DR list',async()=>{
 const snapshot={id:'old-snapshot',runId:'derived',setupKey:'old',instrument:'GBPUSD',direction:'short',knownAt:100,dealingRange:{version:'countertrend-abcdef-v2',status:'validated'},checklist:{entryPattern:'v10',setup:{primary:{recognizedAt:100}}}};
 const groups=reviewGroups([snapshot]);expect(groups[0].key).not.toBe('old');
 const html=await renderToString(createSSRApp(DrList,{run,groups,results:[]}));expect(html).toContain('v23 / Entry v10');expect(html).not.toContain('Herkunft für diese DR nicht belegt');
});
