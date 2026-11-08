import {it,expect} from 'vitest';
import {bindKnownSourceIdeas} from '../src/setupSourceIdeaBindings.js';
const selection=(selectedAt=1800,price=90)=>({status:'passed',selectedAt,target1:{price,knownAt:1200,id:'target:'+price}});
const candidate=(id='r2',recognizedAt=1800)=>({id,direction:'short',sourceFamilyKey:'same-geometry',recognizedAt,invalidation:110,targetSelection:selection(recognizedAt)});
const signature=(c,asOf)=>c.targetSelection.selectedAt<=asOf?c.sourceFamilyKey+':'+c.targetSelection.target1.price:null;
it('keeps first known target binding immutable when a later alias has the same idea',()=>{
 const state=new Map(),first=candidate(),later=candidate('legacy',2400);
 const early=bindKnownSourceIdeas([first],1800,state,signature)[0];
 const late=bindKnownSourceIdeas([later],2400,state,signature)[0];
 expect(late.ideaKey).toBe(early.ideaKey);expect(late.ideaBinding.selection.selectedAt).toBe(1800);
 expect(later.recognizedAt).toBe(2400);expect(later.targetSelection.selectedAt).toBe(2400);
 expect(late.id).toBe('legacy');
});
it('keeps different targets and future aliases separate',()=>{
 const a=candidate(),b={...candidate('other',2400),targetSelection:selection(2400,80)},state=new Map();
 const current=bindKnownSourceIdeas([a,b],1800,state,signature);
 expect(current[0].ideaKey).toBeDefined();expect(current[1].ideaKey).toBeUndefined();
 const later=bindKnownSourceIdeas([a,b],2400,state,signature);
 expect(later[0].ideaKey).not.toBe(later[1].ideaKey);
});
it('survives checkpoint restoration without reactivating an earlier first-selection lifecycle',()=>{
 const state=new Map();bindKnownSourceIdeas([candidate()],1800,state,signature);
 const restored=new Map(JSON.parse(JSON.stringify([...state])));
 const result=bindKnownSourceIdeas([candidate('legacy',2400)],2400,restored,signature)[0];
 expect(result.ideaBinding.selection.selectedAt).toBe(1800);
 expect(result.ideaBinding.canonicalSourceKey).toBe('r2');
});
it('does not rewrite established history when earlier provenance arrives after binding',()=>{
 const state=new Map();bindKnownSourceIdeas([candidate('legacy',2400)],2400,state,signature);
 const lateCorrection=bindKnownSourceIdeas([candidate('r2',1800)],2400,state,signature)[0];
 expect(lateCorrection.ideaBinding.status).toBe('ambiguous');
 expect(state.values().next().value.selection.selectedAt).toBe(2400);
});
