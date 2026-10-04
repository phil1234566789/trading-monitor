// Eine Stelle für das DR-Ende; eine spätere Nachbeobachtung kann hier ansetzen.
export function simulationChartReplayTime(row) {
  const lifecycle=row.rangeCourse?.lifecycle;
  const main=lifecycle?.main;
  const time=row.drReplayTime ?? (main?.state==='ended'?main.recognizedAt:lifecycle?.evaluatedAt)
    ?? row.drOutcome?.recognizedAt ?? row.entryTime ?? row.entry?.recognizedAt ?? row.knownAt;
  return Number.isFinite(time)?Math.max(time,Number.isFinite(row.knownAt)?row.knownAt:time):row.knownAt;
}
