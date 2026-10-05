import {entryPatternVersion} from './entryPattern.js';
import { fmtPrice, pricePrecisionForInstrument } from './format.js';

const trendLabel = trend => trend === 'uptrend' ? 'Uptrend' : trend === 'downtrend' ? 'Downtrend' : 'Unbekannt';

// trends ist die gespeicherte collectNestedChain: nur bestätigte, noch aktive Ebenen.
// Die letzte Ebene bestimmt wie in trendPhases die Richtung; Parents sind Kontext.
export function normalizeM1ChecklistPresentation(check, direction, knownAt = check?.evaluatedAt) {
  if(check?.sweepReaction && check.sweepReaction.direction===direction && Number.isFinite(check.sweepReaction.choch?.recognizedAt)
    && check.sweepReaction.choch.recognizedAt<=knownAt && Number.isFinite(check.evaluatedAt) && check.evaluatedAt<=knownAt) {
    const reaction=check.sweepReaction,short=direction==='short';
    const trend=short?'downtrend':'uptrend';
    const count=check.trends?.length ?? 0;
    return {...check,currentTrend:reaction.active?{trend,source:'sweep',depth:null}:null,
      sweepPresentation:true,
      details:[`M1-Verlauf ab Sweep: ${reaction.active?trendLabel(trend):'invalidiert'} · ${fmtPrice(reaction.sweepPrice,pricePrecisionForInstrument(check.instrument))}`,
        ...(check.trends ?? []).map(level=>`${level.depth?`Nested Ebene ${level.depth}`:'Outer'}: ${trendLabel(level.trend)} (Kontext)`),
        ...(check.details ?? []).slice(count+(check.sweepPresentation?1:0))],
      detailStatuses:[reaction.active?'passed':'unmet',...(check.trends ?? []).map(()=> 'context'),
        ...(check.detailStatuses ?? []).slice(count+(check.sweepPresentation?1:0))]};
  }
  if (!Array.isArray(check?.trends) || !check.trends.length || !Number.isFinite(check.evaluatedAt)
    || !Number.isFinite(knownAt) || check.evaluatedAt > knownAt) return check;
  const trends = check.trends;
  if (trends.some((level, index) => !level || level.depth !== index
    || !['uptrend', 'downtrend'].includes(level.trend))) return check;
  const currentTrend = trends.at(-1);
  const matches = currentTrend.trend === (direction === 'short' ? 'downtrend' : 'uptrend');
  return { ...check, currentTrend: { ...currentTrend },
    details: [`Aktuelle M1-Richtung: ${trendLabel(currentTrend.trend)}`,
      ...trends.slice(0, -1).map(level => `${level.depth ? `Nested Ebene ${level.depth}` : 'Outer'}: ${trendLabel(level.trend)} (Kontext)`),
      ...(Array.isArray(check.details) ? check.details : []).slice(trends.length)],
    detailStatuses: [entryPatternVersion(check) ? 'context' : ['long', 'short'].includes(direction) ? matches ? 'passed' : 'unmet' : 'unknown',
      ...trends.slice(0, -1).map(() => 'context'), ...(Array.isArray(check.detailStatuses) ? check.detailStatuses : []).slice(trends.length)] };
}
