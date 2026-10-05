import { afterEach, expect, it, vi } from 'vitest';
import { calculateSnapshotIndicatorsInWorker } from '../src/snapshotIndicatorBrowser.js';

afterEach(() => vi.unstubAllGlobals());
function workerMock() {
  const worker = { postMessage: vi.fn(), terminate: vi.fn() };
  vi.stubGlobal('Worker', vi.fn(function () { return worker; }));
  return worker;
}
it('dispatches without synchronously calculating and terminates after completion', async () => {
  const worker = workerMock(), input = { frames: { '5m': [] } };
  const pending = calculateSnapshotIndicatorsInWorker(input);
  expect(worker.postMessage).toHaveBeenCalledWith(input);
  expect(worker.terminate).not.toHaveBeenCalled();
  const result = { zones: [], pivots: {}, m5: null };
  worker.onmessage({ data: { result } });
  expect(await pending).toBe(result);
  expect(worker.terminate).toHaveBeenCalledOnce();
});
it('aborts running CPU work rather than merely ignoring its answer', async () => {
  const worker = workerMock(), controller = new AbortController();
  const pending = calculateSnapshotIndicatorsInWorker({}, { signal: controller.signal });
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(worker.terminate).toHaveBeenCalledOnce();
});
it('does not start an already aborted request', async () => {
  workerMock();
  await expect(calculateSnapshotIndicatorsInWorker({}, { signal: AbortSignal.abort() })).rejects.toMatchObject({ name: 'AbortError' });
  expect(Worker).not.toHaveBeenCalled();
});
it.each(['message', 'runtime', 'clone'])('cleans up on %s errors', async kind => {
  const worker = workerMock();
  if (kind === 'clone') worker.postMessage.mockImplementation(() => { throw new Error('bad'); });
  const pending = calculateSnapshotIndicatorsInWorker({});
  if (kind === 'message') worker.onmessage({ data: { error: 'bad' } });
  if (kind === 'runtime') worker.onerror({ message: 'bad' });
  await expect(pending).rejects.toThrow('bad');
  expect(worker.terminate).toHaveBeenCalledOnce();
});


it('publishes debug pivots while the structure calculation is still running', async () => {
  const worker = workerMock(), onProgress = vi.fn(), controller = new AbortController();
  const pending = calculateSnapshotIndicatorsInWorker({}, { signal: controller.signal, onProgress });
  const progress = { zones: [], pivots: { '5m': { pivotsOuter: [{ pivotTime: 600, price: 1.324 }] } } };
  worker.onmessage({ data: { progress } });
  expect(onProgress).toHaveBeenCalledWith(progress);
  expect(worker.terminate).not.toHaveBeenCalled();
  const final = { ...progress, m5: { state: {} } };
  worker.onmessage({ data: { result: final } });
  expect(await pending).toBe(final);
  expect(worker.terminate).toHaveBeenCalledOnce();
});

it('ignores late progress after aborting a replay calculation', async () => {
  const worker = workerMock(), controller = new AbortController(), onProgress = vi.fn();
  const pending = calculateSnapshotIndicatorsInWorker({}, { signal: controller.signal, onProgress });
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  worker.onmessage({ data: { progress: { pivots: {} } } });
  expect(onProgress).not.toHaveBeenCalled();
});
