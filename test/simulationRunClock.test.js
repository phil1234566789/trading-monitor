import {expect,it,vi} from 'vitest';
import {startSimulationRunExecution,completeSimulationRunExecution} from '../src/simulationRunClock.js';

it('records wall time independently of the input snapshot and replaces a previous execution',()=>{
  const clock=vi.spyOn(Date,'now').mockReturnValue(1800000123456);
  try {
    const previous={id:'same',evaluatedAt:600,startedAt:100,completedAt:200};
    const running=startSimulationRunExecution(previous);
    expect(running).toEqual({id:'same',evaluatedAt:600,startedAt:1800000123});
    clock.mockReturnValue(1800000456789);
    expect(completeSimulationRunExecution(running)).toEqual({...running,completedAt:1800000456});
    expect(previous.completedAt).toBe(200);
  }finally{clock.mockRestore();}
});

it('does not invent a historical start when only completion is witnessed',()=>{
  expect(completeSimulationRunExecution({id:'legacy',evaluatedAt:600},900)).toEqual({id:'legacy',evaluatedAt:600,completedAt:900});
});
