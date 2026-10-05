import { closedChecklistCandles } from './tradeSetupChecklistTimeBasis.js';
import { barSecondsForTimeframeCi } from './timeframes.js';
import { candleTouchesPrice } from './structurePivotTime';
import { M1_FRACTAL_SUPPORT } from './m1StructureSettings.js';
import { m1ScanPrefixStart } from './m1ScanPrefix.js';

export function resolveM1SweepStart(primary, candles, evaluatedAt) {
  const level=primary?.sweep?.level,sourceTime=level?.touchedTime;
  const duration=barSecondsForTimeframeCi(primary?.sweep?.timeframe ?? '5M');
  if(!Number.isFinite(sourceTime) || !Number.isFinite(level?.price) || !duration
    || !['short','long'].includes(primary?.direction))return null;
  const rows=closedChecklistCandles(candles,'1m',evaluatedAt)
    .filter(c=>c.time>=sourceTime && c.time<sourceTime+duration);
  // H1 speichert den Stundenbeginn. Fehlende frühere Minuten dürfen nicht
  // eine spätere Kerze fälschlich zur ersten tatsächlichen Berührung machen.
  for(let i=0;i<rows.length;i++) {
    const c=rows[i];
    if(c.time!==sourceTime+i*60)return null;
    if(candleTouchesPrice(c,level.price,primary.direction==='long'))return {
      structureFrom:c.time,recognizedAt:c.time+60,sourceTime,sourceTimeframe:primary.sweep.timeframe ?? '5M',price:level.price,
    };
  }
  return null;
}

export function m1StructureRows(candles,structureFrom,evaluatedAt) {
  if(!Number.isFinite(structureFrom))return [];
  const rows=closedChecklistCandles(candles,'1m',evaluatedAt);
  if(!rows.length || rows.at(-1).time<structureFrom)return [];
  return rows.slice(m1ScanPrefixStart(rows,structureFrom,M1_FRACTAL_SUPPORT));
}

export function m1LoadStart(context) {
  return context?.anchor?.primary?.sweep?.level?.touchedTime
    ?? Math.min(context.anchor.pivotTime,context.primary.reactionRecognizedAt ?? context.anchor.pivotTime);
}
