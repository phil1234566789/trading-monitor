import { assumeFixtureH1Direction } from './helpers/fixtureH1Direction.js';
assumeFixtureH1Direction();
import { describe, expect, it } from 'vitest';
import { buildTradeSetup2Snapshot, buildTradeSetup2CandidateSnapshot } from '../src/tradeSetup2Snapshot.js';
import { evaluateTradeSetupChecklist } from '../src/tradeSetupChecklist.js';
import { activeM1Context, buildM1Structure } from '../src/m1Structure.js';
import { evaluateM1Checklist } from '../src/m1Checklist.js';
import h1 from './fixtures/gbpusd-h1-dr114-lifecycle.json';
import m5 from './fixtures/gbpusd-m5-dr114-close-reaction.json';
import m1 from './fixtures/gbpusd-m1-dr114-p5.json';
import config from './fixtures/gbpusd-m5-dr114-session-targets.json';

const at = clock => Date.parse(`2026-09-09T${clock}:00+02:00`) / 1000;
function input(clock='09:50') {
  const evaluatedAt=at(clock);
  const checklist=evaluateTradeSetupChecklist({instrument:'GBPUSD',evaluatedAt,h1Candles:h1.candles,
    m5Candles:m5,sessionConfigs:config.sessions,settings:{rangesFixedStartActive:true,rangesFixedStartTime:h1.cutoff}});
  const context=activeM1Context(checklist);
  const m1Structure=buildM1Structure(m1,context.anchor,evaluatedAt);
  const m1Check=evaluateM1Checklist({context,structure:m1Structure,candles:m1,evaluatedAt});
  return {checklist,m1Check,m1Structure,m1Candles:m1};
}
describe('Trade Setup 2.0 immutable entry snapshot',()=>{
  it('archives a detected candidate before an entry exists',()=>{
    const {checklist}=input('09:49');
    const snapshot=buildTradeSetup2CandidateSnapshot({checklist,candidate:checklist.setup.primary});
    expect(snapshot).toMatchObject({entry:null,knownAt:at('09:49'),instrument:'GBPUSD'});
    expect(snapshot.evidence.some(e=>e.role==='reactionOB')).toBe(true);
    expect(snapshot.evidence.some(e=>e.role==='fvg')).toBe(false);
    expect(snapshot.checklist.context).toBeUndefined();
  });
  it('captures DR114 at recognition with evidence and no candle archive',()=>{
    const source=input(), snapshot=buildTradeSetup2Snapshot(source);
    expect(snapshot).toMatchObject({schemaVersion:3,instrument:'GBPUSD',knownAt:at('09:50'),entry:{price:1.35615}});
    expect(snapshot.entry.stops.wide.price).toBe(1.35675);
    expect(snapshot.entry.stops.narrow.price).toBe(1.35648);
    expect(snapshot.m1Check.instrument).toBe('GBPUSD');
    expect(snapshot.evidence.map(e=>e.role)).toEqual(expect.arrayContaining(['sweep','reactionOB','target1','target2','retest','fvg']));
    expect(snapshot.evidence.every(e=>e.knownAt<=snapshot.knownAt)).toBe(true);
    expect(snapshot.checklist.context).toBeUndefined();
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
    source.checklist.setup.primary.reactionOB.top=9;
    expect(snapshot.checklist.setup.primary.reactionOB.top).toBe(1.35675);
  });
  it('rejects pre-entry and later-state snapshots instead of backdating facts',()=>{
    expect(buildTradeSetup2Snapshot(input('09:49'))).toBeNull();
    expect(buildTradeSetup2Snapshot(input('09:55'))).toBeNull();
  });
  it('does not promote unassigned OB candidates to evidence',()=>{
    const source=input();
    source.checklist.checks.confluences.obCandidates=[{top:8,bottom:7,startTime:1,sameMovement:'unknown'}];
    expect(buildTradeSetup2Snapshot(source).evidence.some(e=>e.top===8)).toBe(false);
  });
});
