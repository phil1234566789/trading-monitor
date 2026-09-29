import { describe, it, expect } from 'vitest';
import { checklistPresentation } from '../src/tradeSetupChecklistPresentation.js';

const at = Date.parse('2026-09-09T10:35:00+02:00') / 1000;
const structure = (trend, origin, nestedTrend = null) => ({ trend, nestedTrend, currRange: {
  high: { pivotTime: Date.parse(origin) / 1000 }, low: { pivotTime: at - 3600 },
} });

describe('checklist presentation from evaluated data', () => {
  it('uses recognition time rather than the OB origin', () => {
    const primary = { reactionRecognizedAt: at, reactionPreview: { ob: { top: 1.3, bottom: 1.2, startTime: at - 600 } } };
    const view = checklistPresentation({ setup: { primary } });
    expect(view.reaction.orderBlock.recognizedAt).toBe(at);
  });
  it('puts optional confluence evidence explanations in the status tooltip', () => {
    expect(checklistPresentation({ checks: { confluences: { explanation: 'Am Sweep aus B; bestätigt 09:30.' } } }).confluences)
      .toMatchObject({ explanation: 'Am Sweep aus B; bestätigt 09:30.' });
  });
  it('shows line icons only from the actual E/G check status', () => {
    for (const status of ['passed', 'pending', 'unknown']) {
      const view = checklistPresentation({ checks: {
        antiConfluences: { status, explanation: 'Nur H1; Sweep/OB zurückgestellt.' }, confluences: { status },
      } });
      expect(view.antiConfluences).toEqual({ explanation: 'Nur H1; Sweep/OB zurückgestellt.', detailStatuses: [status] });
      expect(view.confluences.detailStatuses).toEqual(status === 'passed' ? ['passed'] : []);
    }
  });
  it('uses the cockpit business-day age and nested trend chain', () => {
    const state = { evaluatedAt: at, structure: structure('downtrend', '2026-08-21T11:00:00+02:00',
      structure('uptrend', '2026-09-02T14:00:00+02:00')) };
    expect(checklistPresentation(state).h1Trend.details).toEqual(['12 Tage Downtrend', '4 Tage Nested Uptrend']);
    state.structure.trend = 'uptrend';
    expect(checklistPresentation(state).h1Trend.details[0]).toBe('12 Tage Uptrend');
  });
  it('formats the actual frozen sweep age, without rounding 161 hours to 162', () => {
    const state = { instrument: 'GBPUSD', setup: { primary: { sweep: {
      timeframe: '1H', ageTier: 'major', ageSeconds: 161 * 3600, level: { price: 1.35648999999999 },
    } } } };
    expect(checklistPresentation(state).liquiditySweep.details).toEqual(['1H Major Inducement bei 1.35649 (6d 17h)']);
    state.setup.primary.sweep.ageSeconds = 162 * 3600;
    expect(checklistPresentation(state).liquiditySweep.details[0]).toContain('(6d 18h)');
  });
  it('does not invent observations when their data is missing', () => {
    expect(checklistPresentation(null)).toEqual({});
    expect(checklistPresentation({ instrument: 'EURUSD', evaluatedAt: null })).toEqual({});
  });
});
