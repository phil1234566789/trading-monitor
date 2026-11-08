import {it,expect} from 'vitest';
import {createLiveEvidence} from '../services/setup2/evidence.js';

it('pins XAU live evidence without changing other instruments or archived entry versions',()=>{
 const configuration=config=>createLiveEvidence(config,{fromTime:0,toTime:60,startedAt:0}).complete().configuration.configuration;
 expect(configuration({instrument:'XAUUSD'}).m5BosRuleVersion).toBe('m5-p2-preliminary-close-same-d-v2');
 for(const instrument of ['GBPUSD','EURUSD'])expect(Object.hasOwn(configuration({instrument}),'m5BosRuleVersion')).toBe(false);
 expect(Object.hasOwn(configuration({instrument:'XAUUSD',entryPattern:'countertrend-entry-model-1-v10'}),'m5BosRuleVersion')).toBe(false);
});
