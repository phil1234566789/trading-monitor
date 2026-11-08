import {it,expect} from 'vitest';
import {setup1ChecklistDetails} from '../src/setup1ChecklistDetails.js';
import {SWEEP_RETEST_SOURCE_KIND} from '../src/sweepRetestSources.js';
it('labels an existing M5 OB source and its known retest without pretending Setup 1.0',()=>{
  const state={model:'countertrend',instrument:'XAUUSD',evaluatedAt:1800,setup:{primary:{
    recognizedAt:1200,sourceKind:SWEEP_RETEST_SOURCE_KIND,sourceRetest:{candleTime:900,recognizedAt:1200},
    reactionRecognizedAt:600,reactionOB:{dir:1,top:4330,bottom:4320,startTime:0}}}};
  const details=setup1ChecklistDetails(state).reaction.join(' ');
  expect(details).toContain('Bestehender M5-Orderblock');
  expect(details).toContain('Retestkerze');
  expect(details).not.toContain('aus Setup 1.0');
  state.setup.primary.sourceRetest.recognizedAt=1860;
  expect(setup1ChecklistDetails(state).reaction.join(' ')).not.toContain('Retestkerze');
});
