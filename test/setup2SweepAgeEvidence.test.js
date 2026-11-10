import {it,expect} from 'vitest';
import {packEvidence,hydrateEvidence} from '../services/setup2/evidencePayload.js';
import {evidenceHash} from '../services/setup2/evidenceIdentity.js';
import {entryPattern1SweepAgeRule} from '../src/entryPattern1SweepAge.js';
it('stores repeated frozen H-age proofs once without losing any proof field',()=>{
 const sweepAge=entryPattern1SweepAgeRule('GBPUSD',{recognizedAt:100,sweep:{ageSeconds:14400}},200);
 const value={conditions:{sweepAge},again:{sweepAge},third:{sweepAge}},payloads=new Map();
 const packed=packEvidence(value,payloads,evidenceHash);
 expect(hydrateEvidence(packed,new Map([...payloads].map(([id,entry])=>[id,entry.payload])))).toEqual(value);
 expect(packed.conditions.$liveEvidenceRef ?? packed.conditions.sweepAge?.$liveEvidenceRef).toBeTruthy();
 expect([...payloads.values()].filter(p=>p.payload.version===sweepAge.version)).toHaveLength(1);
});
