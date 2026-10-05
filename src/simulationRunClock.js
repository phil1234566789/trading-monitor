export function startSimulationRunExecution(run,startedAt=Math.floor(Date.now()/1000)) {
  // Ein erneuter Scan ist eine neue Ausführung, auch bei gleicher deterministischer Run-ID.
  const {completedAt,...current}=run;
  return {...current,startedAt};
}

export function completeSimulationRunExecution(run,completedAt=Math.floor(Date.now()/1000)) {
  return {...run,completedAt};
}
