import { afterEach, describe, expect, it, vi } from 'vitest';
const lifecycle = vi.hoisted(() => ({ mount: null, unmount: null }));
vi.mock('vue', async original => ({ ...await original(), onMounted: fn => { lifecycle.mount = fn; }, onUnmounted: fn => { lifecycle.unmount = fn; } }));
import { effectScope, nextTick } from 'vue';
import { useSimulationStatistics } from '../src/composables/useSimulationStatistics.js';

const flush = async () => { for (let i = 0; i < 5; i++) await nextTick(); };
const pending = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
let scope;
function start(repository) {
  scope = effectScope();
  const state = scope.run(() => useSimulationStatistics(repository));
  lifecycle.mount();
  return state;
}
afterEach(() => { lifecycle.unmount?.(); scope?.stop(); vi.useRealTimers(); });

describe('simulation statistics loading', () => {
  it('loads the selected real run, passes variant and Berlin date filters', async () => {
    const repository = { listSetups: vi.fn().mockResolvedValue([]), listRuns: vi.fn().mockResolvedValue([{ id: '2026', status: 'complete' }]), listResults: vi.fn().mockResolvedValue([{ entryId: 'one' }]) };
    const state = start(repository);
    await flush();
    expect(state.runId.value).toBe('2026');
    expect(state.rows.value).toEqual([{ entryId: 'one' }]);
    state.variant.value = 'narrow';
    state.instrument.value = 'GBPUSD';
    state.from.value = state.to.value = '2026-10-25';
    await flush();
    expect(repository.listResults).toHaveBeenLastCalledWith({ runId: '2026', variant: 'narrow', instrument: 'GBPUSD',
      from: Date.parse('2026-10-25T00:00:00+02:00') / 1000, to: Date.parse('2026-10-26T00:00:00+01:00') / 1000 });
    expect(repository.listSetups).toHaveBeenLastCalledWith({ runId: '2026', instrument: 'GBPUSD' });
  });
  it('rejects an old response after the user switches stop variants', async () => {
    const old = pending();
    const repository = { listSetups: vi.fn().mockResolvedValue([]), listRuns: vi.fn().mockResolvedValue([{ id: 'run' }]), listResults: vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue([{ variant: 'narrow' }]) };
    const state = start(repository);
    await flush();
    state.variant.value = 'narrow';
    await flush();
    old.resolve([{ variant: 'wide' }]);
    await flush();
    expect(state.rows.value).toEqual([{ variant: 'narrow' }]);
    expect(state.loading.value).toBe(false);
  });
  it('shows read failures and can retry without fabricated rows', async () => {
    const repository = { listSetups: vi.fn().mockResolvedValue([]), listRuns: vi.fn().mockRejectedValueOnce(new Error('Read failed')).mockResolvedValue([]), listResults: vi.fn() };
    const state = start(repository);
    await flush();
    expect(state.error.value).toBe('Read failed');
    expect(state.rows.value).toEqual([]);
    await state.refresh();
    expect(state.error.value).toBe('');
    expect(repository.listResults).not.toHaveBeenCalled();
  });
  it('refreshes a running run and stops polling once it completes', async () => {
    vi.useFakeTimers();
    let status = 'running';
    const repository = { listSetups: vi.fn().mockResolvedValue([]), listResults: vi.fn().mockResolvedValue([]),
      listRuns: vi.fn(async () => [{ id: 'old', evaluatedAt: 1, status: 'complete' }, { id: 'new', evaluatedAt: 2, status }]) };
    const state = start(repository);
    await flush();
    expect(state.runId.value).toBe('new');
    status = 'complete';
    await vi.advanceTimersByTimeAsync(15_000);
    await flush();
    expect(state.selectedRun.value.status).toBe('complete');
    const calls = repository.listRuns.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(repository.listRuns).toHaveBeenCalledTimes(calls);
  });
});
