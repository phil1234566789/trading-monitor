import {expect,it} from 'vitest';
import {reactionVerdict} from '../src/orderBlockReactionVerdict.js';

it('waits after structural confirmation until an unblocked route really enters',()=>{
 const r={structuralState:'true',knownAt:120,routes:{a:{status:'rejected',reason:'opposingFvgOpen',knownAt:120},b:{status:'pending'}}};
 expect(reactionVerdict(r)).toMatchObject({state:'pending'});
 expect(reactionVerdict({...r,routes:{...r.routes,b:{status:'entry',entryTime:240}}})).toMatchObject({state:'true',knownAt:240});
});

it('rejects the episode only once both routes have failed, without erasing the structural evidence',()=>{
 const r={structuralState:'true',knownAt:120,routes:{a:{status:'rejected',reason:'opposingFvgOpen',knownAt:120},b:{status:'rejected',reason:'entryBOrderBlockTooDeep',knownAt:240}}};
 expect(reactionVerdict(r)).toMatchObject({state:'false',knownAt:240});
 expect(r.structuralState).toBe('true');
});

it('preserves an earlier real entry when a different route later fails',()=>{
 expect(reactionVerdict({structuralState:'true',routes:{a:{status:'entry',entryTime:120},b:{status:'rejected',knownAt:300}}}))
  .toMatchObject({state:'true',knownAt:120});
});

it('treats expiry as finished but missing evidence as unknown',()=>{
 expect(reactionVerdict({structuralState:'unknown',reason:'marketClosed',knownAt:240})).toMatchObject({state:'false',reason:'marketClosed',knownAt:240});
 expect(reactionVerdict({structuralState:'unknown',reason:'missingHistory',knownAt:null})).toMatchObject({state:'unknown',reason:'missingHistory'});
 expect(reactionVerdict({structuralState:'unknown',reason:'awaitingFvg',knownAt:null})).toMatchObject({state:'pending'});
});

it('does not disguise an unresolved stop as a negative reference',()=>{
 expect(reactionVerdict({structuralState:'true',routes:{a:{status:'unknown',reason:'partialOverlapOpen',knownAt:120},b:{status:'rejected',knownAt:180}}}))
  .toMatchObject({state:'unknown',reason:'partialOverlapOpen'});
});

it('reports unknown only once no route is pending: the latest route knownAt, null without any',()=>{
 const routes={a:{status:'unknown',reason:'partialOverlapOpen',knownAt:120},b:{status:'unknown',reason:'partialOverlapOpen',knownAt:300}};
 expect(reactionVerdict({structuralState:'true',routes})).toMatchObject({state:'unknown',reason:'partialOverlapOpen',knownAt:300});
 expect(reactionVerdict({structuralState:'true',routes:{a:{status:'unknown',reason:'missingHistory'},b:{status:'rejected'}}}))
  .toMatchObject({state:'unknown',knownAt:null});
});
