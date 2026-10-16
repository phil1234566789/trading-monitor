import { describe, it, expect } from 'vitest';
import { evaluateCountertrendLifecycle } from '../src/countertrendLifecycle.js';
import { evaluateSimulation } from '../src/tradeSetupSimulation.js';
import { JOINT_LOSS_RISK_VERSION, savedRiskInvalidationLabel } from '../src/dealingRangeRisk.js';
import original from './fixtures/eurusd-19982-joint-losses.json';

const outcomes = original.entries.flatMap(row => row.outcomes);
const recognizedAt = Math.max(...outcomes.map(row => row.exitRecognizedAt));
const selection = {status:'passed',direction:'short',selectedAt:original.entries[0].entry.recognizedAt,
  target1:{price:1.11528},target2:{price:1.11125}};
const lifecycle = (at, entries = outcomes, progress) => evaluateCountertrendLifecycle({
  selection,invalidation:1.12405,m1Candles:original.candles,candles:[],evaluatedAt:at,entries,progress});

describe('T74 gemeinsame SL-Verluste', () => {
  it('reproduziert die ersten zwei Original-Entries von DR19982 aus nativen M1-Kerzen', () => {
    for (const {entry,outcomes:expected} of original.entries) for (const variant of ['wide','narrow']) {
      const result=evaluateSimulation({entry,variant,candles:original.candles,evaluatedAt:recognizedAt,
        target1:entry.scales[variant].targets[0].price,target2:entry.scales[variant].targets[1].price});
      expect(result).toMatchObject(expected.find(row=>row.variant===variant));
    }
  });
  it('sperrt die gesamte DR erst beim kausal bekannten zweiten gemeinsamen Verlust', () => {
    expect(lifecycle(recognizedAt-60).riskInvalidation).toBeFalsy();
    const result=lifecycle(recognizedAt);
    expect(result.main).toMatchObject({state:'ended',reason:'twoConsecutiveJointLosses',recognizedAt});
    expect(result.riskInvalidation).toEqual({version:JOINT_LOSS_RISK_VERSION,recognizedAt,
      entryIds:original.entries.map(row=>row.entry.id)});
    expect(result.entrySearchAllowed).toBe(false);
  });
  it('ergibt vorwärts mit Memo dieselbe Sperre wie der vollständige Präfix', () => {
    const progress={};
    for(let at=selection.selectedAt+60;at<=recognizedAt;at+=60) {
      expect(lifecycle(at,outcomes,progress)).toEqual(lifecycle(at));
    }
    expect(lifecycle(recognizedAt,outcomes,progress).main.reason).toBe('twoConsecutiveJointLosses');
    // Auch zurückgesprungene Replay-Stände dürfen die spätere Sperre nicht übernehmen.
    expect(lifecycle(recognizedAt-60,outcomes,progress).riskInvalidation).toBeFalsy();
  });
  it('zählt weder einen einzelnen Entry noch eine einzelne SL-Variante zweimal', () => {
    expect(lifecycle(recognizedAt,outcomes.slice(0,2)).riskInvalidation).toBeFalsy();
    expect(lifecycle(recognizedAt,outcomes.filter(row=>row.variant==='wide')).riskInvalidation).toBeFalsy();
  });
  it('kennzeichnet weder Zukunft noch unbelegte Altversionen als Risikoende', () => {
    const state={reason:'twoConsecutiveJointLosses',riskInvalidation:{version:JOINT_LOSS_RISK_VERSION,
      recognizedAt,entryIds:['a','b']}};
    expect(savedRiskInvalidationLabel(state,recognizedAt)).toBe('DR risiko-invalidiert · zwei Verlust-Entries in Folge');
    expect(savedRiskInvalidationLabel(state,recognizedAt-1)).toBeNull();
    expect(savedRiskInvalidationLabel({...state,riskInvalidation:{...state.riskInvalidation,version:'old'}},recognizedAt)).toBeNull();
    expect(savedRiskInvalidationLabel({reason:state.reason},recognizedAt)).toBeNull();
  });
});
