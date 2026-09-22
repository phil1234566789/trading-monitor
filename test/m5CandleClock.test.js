import { effectScope, ref, nextTick } from 'vue';
import { afterEach, expect, it, vi } from 'vitest';
import { m5ClockState, useM5CandleClock } from '../src/composables/useM5CandleClock.js';

let scope;
afterEach(() => { scope?.stop(); vi.useRealTimers(); });
const at = (time) => Date.parse(`2026-09-22T${time}+02:00`);

it('requires the 16:15 candle at 16:23 and follows wall time across a close', () => {
  const latest = at('16:15:00') / 1000;
  expect(m5ClockState(at('16:23:00'), latest)).toMatchObject({ remaining: 120, missing: false });
  expect(m5ClockState(at('16:24:59'), latest).remaining).toBe(1);
  expect(m5ClockState(at('16:25:00'), latest)).toMatchObject({ remaining: 300, missing: true });
});

it('retries successful-but-old responses, warns, and clears only on fresh data', async () => {
  vi.useFakeTimers(); vi.setSystemTime(at('16:20:00'));
  let latest = at('16:10:00') / 1000;
  const reload = vi.fn(async () => true);
  scope = effectScope();
  const clock = scope.run(() => useM5CandleClock({ enabled: () => true, getLatestTime: () => latest, reload }));
  await vi.advanceTimersByTimeAsync(61_000);
  expect(reload.mock.calls.length).toBeGreaterThan(2);
  expect(clock.state.value.status).toBe('stale');
  latest = at('16:15:00') / 1000;
  await vi.advanceTimersByTimeAsync(1000);
  expect(clock.state.value.status).toBe('current');
});

it('does not overlap requests or retry outside live M5, and cleans up', async () => {
  vi.useFakeTimers(); vi.setSystemTime(at('16:23:00'));
  const enabled = ref(true);
  const reload = vi.fn(() => new Promise(() => {}));
  scope = effectScope();
  scope.run(() => useM5CandleClock({ enabled: () => enabled.value, getLatestTime: () => null, reload }));
  await vi.advanceTimersByTimeAsync(31_000);
  expect(reload).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(1);
  enabled.value = false; await nextTick();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(reload).toHaveBeenCalledTimes(1);
  scope.stop();
  expect(vi.getTimerCount()).toBe(0);
});

it('keeps the failure warning across boundaries until the chart really catches up', async () => {
  vi.useFakeTimers(); vi.setSystemTime(at('16:23:00'));
  scope = effectScope();
  const clock = scope.run(() => useM5CandleClock({ enabled: () => true,
    getLatestTime: () => at('16:10:00') / 1000,
    reload: async () => { throw new Error('offline'); },
  }));
  await vi.advanceTimersByTimeAsync(20_000);
  expect(clock.state.value.status).toBe('stale');
  vi.setSystemTime(at('16:25:00'));
  await vi.advanceTimersByTimeAsync(1000);
  expect(clock.state.value.status).toBe('stale');
});
