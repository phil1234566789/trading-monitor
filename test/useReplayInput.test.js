import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref, watch } from 'vue';
import { useReplayInput } from '../src/composables/useReplayInput.js';
import { useHttpActivity } from '../src/composables/useHttpActivity.js';

const initial = Date.parse('2026-10-01T17:35') / 1000;
const format = value => {
  const d = new Date(value * 1000), pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
let scope, frames;
beforeEach(() => {
  vi.useFakeTimers(); frames = [];
  vi.stubGlobal('requestAnimationFrame', callback => { frames.push(callback); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', id => { frames[id-1] = null; });
});
afterEach(() => { scope?.stop(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function setup() {
  scope = effectScope();
  const time = ref(initial), context = ref('GBPUSD:1h:replay'), applied = vi.fn();
  const input = scope.run(() => {
    watch(time, applied, { flush: 'sync' });
    return useReplayInput(time, format, () => context.value);
  });
  return { time, context, applied, input, ...useHttpActivity() };
}
async function paint() {
  await nextTick();
  for (const frame of frames.splice(0)) frame?.();
  await vi.advanceTimersByTimeAsync(1);
}
it('waits for the last edit, paints the existing activity indicator, then applies once', async () => {
  const c = setup();
  for (const value of ['2026-10-01T17:36', '2026-10-01T17:37', '2026-10-01T17:38']) {
    c.input.value = value;
    await vi.advanceTimersByTimeAsync(200);
    expect(c.time.value).toBe(initial);
  }
  await vi.advanceTimersByTimeAsync(799);
  expect(c.isActive.value).toBe(false);
  expect(c.time.value).toBe(initial);
  await vi.advanceTimersByTimeAsync(1);
  expect(c.isActive.value).toBe(true);
  expect(c.activeLabels.value).toContain('Replay aktualisieren');
  expect(c.applied).not.toHaveBeenCalled();
  await paint();
  expect(c.time.value).toBe(Date.parse('2026-10-01T17:38') / 1000);
  expect(c.applied).toHaveBeenCalledTimes(1);
  expect(c.isActive.value).toBe(false);
});
it.each(['', '2026-10-01T17:', '2026-02-30T17:35'])('keeps incomplete or invalid draft %s out of replay state', async value => {
  const c = setup();
  c.input.value = '2026-10-01T18:00';
  c.input.value = value;
  await vi.advanceTimersByTimeAsync(1000); await paint();
  expect(c.time.value).toBe(initial);
  expect(c.isActive.value).toBe(false);
});
it('keeps external jumps and single steps immediate and cancels an old draft', async () => {
  const c = setup();
  c.input.value = '2026-10-01T18:00';
  c.time.value = initial + 3600;
  expect(c.input.value).toBe(format(initial + 3600));
  await vi.advanceTimersByTimeAsync(1000); await paint();
  expect(c.time.value).toBe(initial + 3600);
  expect(c.applied).toHaveBeenCalledTimes(1);
});
it('cancels pending edits on context changes and disposal, including the paint window', async () => {
  const c = setup();
  c.input.value = '2026-10-01T18:00';
  await vi.advanceTimersByTimeAsync(1000);
  expect(c.isActive.value).toBe(true);
  c.context.value = 'EURUSD:1h:replay';
  await paint();
  expect(c.time.value).toBe(initial);
  expect(c.isActive.value).toBe(false);
  c.input.value = '2026-10-01T19:00';
  scope.stop();
  await vi.advanceTimersByTimeAsync(1000); await paint();
  expect(c.time.value).toBe(initial);
});
