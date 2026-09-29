import { describe, it, expect } from 'vitest';
import { effectScope, reactive } from 'vue';
import { useChecklistDisplay } from '../src/composables/useChecklistDisplay.js';

describe('checklist display during updates', () => {
  it('retains a complete same-instrument snapshot until M1 finishes, then exposes errors', () => {
    const old = { instrument: 'GBPUSD', status: 'ready', evaluatedAt: 100, checks: { h1Trend: { status: 'passed' } } };
    const m1 = { instrument: 'GBPUSD', status: 'pending', evaluatedAt: 100, details: ['BOS'] };
    const props = reactive({ instrument: 'GBPUSD', checklistState: old, m1Check: m1 });
    const scope = effectScope();
    const view = scope.run(() => useChecklistDisplay(props));
    try {
      expect(view.busy.value).toBeFalsy();
      props.checklistState = null;
      props.m1Check = null;
      expect(view.busy.value).toBeTruthy();
      expect(view.state.value).toEqual(old);
      expect(view.m1.value).toEqual(m1);
      props.m1Check = { instrument: 'GBPUSD', reason: 'loading' };
      props.checklistState = { ...old, evaluatedAt: 200 };
      expect(view.state.value.evaluatedAt).toBe(100);
      props.m1Check = { ...m1, evaluatedAt: 200 };
      expect(view.busy.value).toBeFalsy();
      expect(view.state.value.evaluatedAt).toBe(200);
      props.checklistState = { ...old, status: 'error' };
      expect(view.state.value.status).toBe('error');
      expect(view.retained.value).toBeNull();
      props.instrument = 'EURUSD';
      expect(view.state.value).toBeNull();
      expect(view.m1.value).toBeNull();
    } finally { scope.stop(); }
  });
  it('does not confuse pending trading requirements with actual work', () => {
    const props = reactive({ instrument: 'GBPUSD', checklistState: { instrument: 'GBPUSD', status: 'ready' }, m1Check: null });
    const scope = effectScope();
    const view = scope.run(() => useChecklistDisplay(props));
    try {
      for (const reason of ['abc', 'disabled', 'ended', 'missing', 'error', 'structure']) {
        props.m1Check = { instrument: 'GBPUSD', status: 'pending', reason };
        expect(view.busy.value).toBeFalsy();
      }
      props.m1Check = { instrument: 'GBPUSD', updating: true };
      expect(view.busy.value).toBeTruthy();
    } finally { scope.stop(); }
  });
});
