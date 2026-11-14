import {expect,it} from 'vitest';
import {filterTradeSetup11Candidates} from '../src/tradeSetup11.js';
import {fixture as f,nativeInput as input,expectedFor as expected,nativeSetupFor} from './helpers/tradeSetup11NativeFixture.js';

it.each(f.references)('evaluates original pin $pin with native TS1 and causal M5 context',ref=>{
 const ob=Date.parse(ref.row.ob_start_time)/1000,evaluatedAt=ob+600;
 const setup=nativeSetupFor(ref);
 expect(setup).toBeDefined();expect(setup.obTop).toBe(ref.row.ob_top);expect(setup.obBottom).toBe(ref.row.ob_bottom);
 const result=filterTradeSetup11Candidates({...input,setups:[{...setup,instrument:'XAUUSD'}],evaluatedAt});
 const assessment=result.assessments[0];
 expect(assessment.status).toBe(expected(ref)==='reject'?'unmet':'passed');
 expect(result.setups).toHaveLength(expected(ref)==='reject'?0:1);
 expect(assessment.trendEvidence.evaluatedAt).toBeLessThanOrEqual(evaluatedAt);
 if(ref.pin===485){expect(setup.ls.pivotTime).toBe(1791288600);expect(ref.row.ls_pivot_time).toBe('2026-10-06T12:00:00+00:00');}
});
