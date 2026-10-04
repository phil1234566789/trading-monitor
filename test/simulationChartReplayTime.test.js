import {expect,it} from 'vitest';
import {simulationChartReplayTime} from '../src/simulationChartReplayTime.js';
import {simulationChartLink} from '../src/tradeSetupSimulationStatistics.js';

it.each(['invalidation','target1','target2','entriesClosed','both'])('links to recognition of DR end: %s',reason=>{
  const row={id:'e',knownAt:120,entryTime:60,rangeCourse:{lifecycle:{evaluatedAt:900,
    main:{state:'ended',reason,endedAt:300,recognizedAt:360}}}};
  expect(simulationChartLink(row,'r').query.replay).toBe('360');
});
it('uses the last evaluated open range and remains safe for old snapshots',()=>{
  expect(simulationChartReplayTime({knownAt:120,rangeCourse:{lifecycle:{main:{state:'active'},evaluatedAt:900}}})).toBe(900);
  expect(simulationChartReplayTime({knownAt:120,entryTime:60})).toBe(120);
  expect(simulationChartReplayTime({knownAt:120,drOutcome:{recognizedAt:600}})).toBe(600);
  expect(simulationChartReplayTime({knownAt:120})).toBe(120);
});
