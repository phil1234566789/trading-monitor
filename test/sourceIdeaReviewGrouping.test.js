import {it,expect} from 'vitest';
import {groupSetupSnapshots} from '../src/tradeSetup2Review.js';
import {simulationReviewMetadataProjection,simulationReviewMetadata} from '../src/simulationReviewMetadata.js';
const snapshot=(id,knownAt,idea='known-target-plan')=>({id,setupKey:id,runId:'new-causal-run',instrument:'XAUUSD',direction:'short',knownAt,
 dealingRange:{version:'countertrend-abcdef-v2',status:'validated'},entry:null,
 checklist:{setup:{primary:{id,lifecycle:{sourceIdeaKey:idea,sourceIdeaKnownAt:1800}}}}});
it('counts proved identical alias ideas once without merging different target plans',()=>{
 const rows=[snapshot('r2',1800),snapshot('legacy',2400),snapshot('different',2400,'other-target-plan')];
 expect(groupSetupSnapshots(rows)).toHaveLength(2);
 const compact=rows.map(s=>simulationReviewMetadata({id:s.id,run_id:s.runId,instrument:s.instrument,direction:s.direction,
  ...simulationReviewMetadataProjection(s)}));
 expect(groupSetupSnapshots(compact)).toHaveLength(2);
});
it('leaves historical runs and not-yet-known idea bindings on their original source identities',()=>{
 const old=[snapshot('r2',1800),snapshot('legacy',2400)];
 for(const row of old)delete row.checklist.setup.primary.lifecycle.sourceIdeaKey;
 expect(groupSetupSnapshots(old)).toHaveLength(2);
 const future=snapshot('legacy',1700);expect(groupSetupSnapshots([snapshot('r2',1800),future])).toHaveLength(2);
});
