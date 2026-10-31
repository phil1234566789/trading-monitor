export const RUN_DERIVATION_VERSION='selective-entry-replay-v1';
export function createRunDerivation(input){
 const {inheritedSetupKeys,recomputedSetupKeys}=input;
 if(!input.parentRunId||!input.parentSetupVersion||!input.parentEntryPattern||!input.targetSetupVersion||!input.targetEntryPattern)throw new Error('Missing derivation identity/versions');
 if(!Array.isArray(inheritedSetupKeys)||!Array.isArray(recomputedSetupKeys)||[...inheritedSetupKeys,...recomputedSetupKeys].some(k=>typeof k!=='string'||!k)||new Set([...inheritedSetupKeys,...recomputedSetupKeys]).size!==inheritedSetupKeys.length+recomputedSetupKeys.length)throw new Error('Derivation groups must be unique and disjoint');
 return {...input,version:RUN_DERIVATION_VERSION,inheritedSetupKeys:[...inheritedSetupKeys].sort(),recomputedSetupKeys:[...recomputedSetupKeys].sort()};
}
export const runDerivation=run=>run?.provenance?.derivation?.version===RUN_DERIVATION_VERSION?run.provenance.derivation:null;
const shortVersion=value=>value?.match(/v\d+$/)?.[0]??value;
export function rangeDerivationLabel(run,setupKey){
 const d=runDerivation(run);if(!d)return '';
 if(d.inheritedSetupKeys.includes(setupKey))return `Aus Ursprungslauf übernommen · ${shortVersion(d.parentSetupVersion)} / Entry ${shortVersion(d.parentEntryPattern)} · nicht neu berechnet`;
 if(d.recomputedSetupKeys.includes(setupKey))return `Neu berechnet · ${shortVersion(d.targetSetupVersion)} / Entry ${shortVersion(d.targetEntryPattern)} · M5-BOS Pflicht`;
 return 'Herkunft für diese DR nicht belegt';
}
