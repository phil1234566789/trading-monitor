import { computeRangesPivots } from './marketStructureAnalysis';
import { buildStructureWithPhases } from './trendPhases.js';
import { M1_STRUCTURE_PERIOD } from './m1StructureSettings.js';
import { resolveM1SweepStart, m1StructureRows } from './m1StructureStart.js';
import { deriveM1PivotBreak } from './m1PivotBreak.js';
import { buildM1PivotState } from './m1PivotState.js';

export function buildM1PivotStructure(candles,primary,evaluatedAt) {
  const start=resolveM1SweepStart(primary,candles,evaluatedAt);
  const empty={state:null,pivotsOuter:[],pivotsInner:[],events:[],status:'missing',pivotBreak:null,start};
  if(!start)return empty;
  const support=m1StructureRows(candles,start.structureFrom,evaluatedAt).filter(c=>!c.ignored);
  // Linke Stützkerzen dürfen P5 bestätigen, aber nie in den Strukturzustand gelangen.
  const pivotsOuter=computeRangesPivots(support,M1_STRUCTURE_PERIOD,start.structureFrom).map(p=>{
    const index=support.findIndex(c=>c.time===p.pivotTime);
    return {...p,recognizedAt:support[index+M1_STRUCTURE_PERIOD].time+60};
  });
  const rows=support.filter(c=>c.time>=start.structureFrom);
  const pivotBreak=deriveM1PivotBreak({pivots:pivotsOuter,candles:rows,direction:primary.direction,
    structureFrom:start.structureFrom,evaluatedAt});
  const structure=pivotBreak ? buildM1PivotState(pivotsOuter,rows,pivotBreak,evaluatedAt)
    : buildStructureWithPhases(pivotsOuter,[],M1_STRUCTURE_PERIOD,M1_STRUCTURE_PERIOD,rows,60);
  return {...structure,pivotsOuter,pivotsInner:[],status:'ready',pivotBreak,start};
}
