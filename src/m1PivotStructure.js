import { computeRangesPivots } from './marketStructureAnalysis';
import { buildStructureWithPhases } from './trendPhases.js';
import { M1_STRUCTURE_PERIOD } from './m1StructureSettings.js';
import { resolveM1SweepStart, m1StructureRows } from './m1StructureStart.js';
import { deriveM1PivotBreak } from './m1PivotBreak.js';
import { buildM1PivotState } from './m1PivotState.js';

export function buildM1PivotStructure(candles,primary,evaluatedAt,period=M1_STRUCTURE_PERIOD) {
  const start=resolveM1SweepStart(primary,candles,evaluatedAt);
  const empty={state:null,pivotsOuter:[],pivotsInner:[],events:[],status:'missing',pivotBreak:null,start};
  if(!start)return empty;
  const support=m1StructureRows(candles,start.structureFrom,evaluatedAt).filter(c=>!c.ignored);
  // Pattern 2 nutzt P2; bestehende Aufrufer behalten P5 und dieselbe kausale Bestätigung.
  const pivotsOuter=computeRangesPivots(support,period,start.structureFrom).map(p=>{
    const index=support.findIndex(c=>c.time===p.pivotTime);
    return {...p,recognizedAt:support[index+period].time+60};
  });
  const rows=support.filter(c=>c.time>=start.structureFrom);
  const pivotBreak=deriveM1PivotBreak({pivots:pivotsOuter,candles:rows,direction:primary.direction,
    structureFrom:start.structureFrom,evaluatedAt});
  const structure=pivotBreak ? buildM1PivotState(pivotsOuter,rows,pivotBreak,evaluatedAt)
    : buildStructureWithPhases(pivotsOuter,[],period,period,rows,60);
  return {...structure,pivotsOuter,pivotsInner:[],status:'ready',pivotBreak,start};
}
