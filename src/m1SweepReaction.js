import { buildM1Structure, M1_STRUCTURE_PERIOD } from './m1Structure.js';
import { deriveM5CloseReaction } from './m5CloseReaction.js';
import { closedChecklistCandles } from './tradeSetupChecklistTimeBasis.js';

export function m1SweepBoundary(primary, rows) {
  const sweepTime=primary?.sweep?.level?.touchedTime;
  if(!Number.isFinite(sweepTime))return null;
  const swept=rows.filter(c=>c.time>=sweepTime && c.time<sweepTime+300);
  if(swept.length!==5 || swept.some((c,i)=>c.ignored || c.time!==sweepTime+i*60))return null;
  const field=primary.direction==='short'?'high':'low';
  const sweepPrice=primary.direction==='short'?Math.max(...swept.map(c=>c[field])):Math.min(...swept.map(c=>c[field]));
  return Number.isFinite(sweepPrice)?{sweepTime,sweepPrice}:null;
}

// Der Beleg gehört zum Sweep, nicht zum jüngsten Untertrend. Nur ein Schluss
// jenseits des Sweep-Extrems widerlegt ihn; Untertrends und unknown tun das nicht.
export function deriveM1SweepReaction({ candles, anchor, direction, sweepTime, sweepPrice, evaluatedAt, cache, progress }) {
  const empty = { direction: null, choch: null };
  if (!anchor || !['short', 'long'].includes(direction)
    || !Number.isFinite(sweepTime) || !Number.isFinite(sweepPrice)) return empty;
  const rows = closedChecklistCandles(candles, '1m', evaluatedAt);
  const key = JSON.stringify([anchor.pivotTime, direction, sweepTime, sweepPrice, rows[0]?.time]);
  let saved = progress?.sweepReaction?.key === key ? progress.sweepReaction.choch : null;
  if (saved?.recognizedAt > evaluatedAt) saved = null;
  const finish = fact => {
    const invalidation = rows.find(c => !c.ignored && c.time > fact.originTime
      && (direction === 'short' ? c.close > sweepPrice + 1e-9 : c.close < sweepPrice - 1e-9));
    return { direction, choch: fact, active: !invalidation,
      invalidatedAt: invalidation ? invalidation.time + 60 : null, sweepTime, sweepPrice };
  };
  if (saved) return finish(saved);
  const through=progress?.sweepReaction?.key===key && progress.sweepReaction.through+60<=evaluatedAt
    ? progress.sweepReaction.through : -Infinity;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].time < sweepTime || rows[i].time<=through) continue;
    const prefix = rows.slice(0, i + 1), at = rows[i].time + 60;
    const structure = buildM1Structure(prefix, { ...anchor, recognizedAt: at }, at);
    if (structure.status !== 'ready') continue;
    const reaction = deriveM5CloseReaction(structure.state, structure.pivotsOuter, [],
      M1_STRUCTURE_PERIOD, M1_STRUCTURE_PERIOD, prefix.filter(c => !c.ignored), 60, cache);
    const choch = reaction.levels.find(s => s.type === 'CHoCH' && s.direction === direction
      && Number.isFinite(s.recognizedAt) && s.originTime >= sweepTime && s.originTime < sweepTime + 300
      && prefix.some(c => c.time === s.originTime
        && Math.abs(c[direction === 'short' ? 'high' : 'low'] - sweepPrice) < 1e-9));
    if (choch) {
      if (progress) progress.sweepReaction = { key, choch };
      return finish(choch);
    }
  }
  if(progress)progress.sweepReaction={key,choch:null,through:rows.at(-1)?.time};
  return empty;
}
