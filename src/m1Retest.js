import { detectOrderBlocks, candleTouchesOrderBlock } from './orderBlockDetection.js';
import { orderBlockRecognitionTimes } from './orderBlockRecognitionTime.js';

export function m1RetestAfterReaction(rows, primary, evaluatedAt) {
  const empty = { status: 'unknown', retest: null, fvg: null };
  const ob = primary?.reactionOB;
  const from = primary?.reactionRecognizedAt;
  if (!ob || !Number.isFinite(from) || from > evaluatedAt) return empty;
  const after = rows.filter(c => c.time >= from);
  // Ohne vollständigen Präfix wäre weder der erste Retest noch die erste Folge-FVG belegt.
  if (after.some((c, i) => c.time !== from + i * 60)
    || from + after.length * 60 < Math.floor(evaluatedAt / 60) * 60) return empty;
  const touch = after.find(c => !c.ignored && candleTouchesOrderBlock(c, ob));
  if (!touch) return { ...empty, status: 'ready' };
  const retest = { candleTime: touch.time, recognizedAt: touch.time + 60 };
  const recognition = orderBlockRecognitionTimes(rows, '1m');
  // Derselbe Detektor und dieselbe M1-Mindestgröße wie bei den vorhandenen OB-/FVG-Zonen.
  const zone = detectOrderBlocks(rows, '1m').find(z => z.dir === ob.dir && z.startTime > touch.time
    && recognition.get(z.startTime) <= evaluatedAt);
  const fvg = zone ? { candleTime: zone.startTime, recognizedAt: recognition.get(zone.startTime), gap: zone.fvg } : null;
  return { status: 'ready', retest, fvg };
}
