import {expect,it} from 'vitest';
import {tradeSetupSourceDetails,tradeSetupInteractionRows} from '../src/tradeSetupSourcePresentation.js';
it('distinguishes displayed OB-edge sweeps from the separate GO witness outside the top three',()=>{
 const ob={level:{sourceKind:'orderBlock',price:4135.61,sourceStartTime:1793880000,sourceKnownAt:1793880600,touchedTime:1793889000},timeframe:'5M'};
 const witness={level:{price:4179.51,pivotTime:1793870000,touchedTime:1793888000},timeframe:'5M'};
 const text=tradeSetupSourceDetails({sweeps:[ob],trendEvidence:{goWitness:witness}},'XAUUSD');
 expect(text).toContain('OB-Kante 4.135,61');expect(text).toContain('GO-Beleg: LS 4.179,51');
 expect(text).toContain('bekannt');
});
it('uses one frozen-priority collection for rendering, hover and selection',()=>{
 const live={dir:1,obStartTime:300,obTop:110},frozen={dir:1,obStartTime:300,obTop:100};
 expect(tradeSetupInteractionRows([live],frozen)).toEqual([frozen]);
 expect(tradeSetupInteractionRows([live],null)).toEqual([live]);
});
