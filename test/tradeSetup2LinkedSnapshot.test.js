import { expect, it, vi } from 'vitest';
import { createLinkedSnapshotReader } from '../src/tradeSetup2LinkedSnapshot.js';

it('loads and reuses a candidate snapshot without outcomes', async () => {
  const snapshot = { id: 'candidate', entry: null };
  const repository = { getEntry: vi.fn().mockResolvedValue(null), getSetupSnapshot: vi.fn().mockResolvedValue(snapshot) };
  const read = createLinkedSnapshotReader(repository);
  expect(await read('run', 'candidate')).toEqual({ snapshot, results: [] });
  await read('run', 'candidate');
  expect(repository.getSetupSnapshot).toHaveBeenCalledTimes(1);
});

it('shares in-flight reads, retains raw outcomes, and refreshes a running result explicitly', async () => {
  let finish;
  const first = { snapshot: { id: 'entry' }, results: [{ status: 'closed', exitRecognizedAt: 600 }] };
  const repository = { getEntry: vi.fn(() => new Promise(resolve => { finish = resolve; })) };
  const read = createLinkedSnapshotReader(repository);
  const one = read('run', 'entry'), two = read('run', 'entry');
  expect(two).toBe(one);
  expect(repository.getEntry).toHaveBeenCalledTimes(1);
  finish(first);
  expect(await one).toBe(first);
  expect(await read('run', 'entry')).toBe(first);
  const refresh = read('run', 'entry', true);
  expect(repository.getEntry).toHaveBeenCalledTimes(2);
  finish({ ...first, results: [] });
  expect((await refresh).results).toEqual([]);
});
it('allows retry after a failed or missing entry', async () => {
  const repository = { getSetupSnapshot: vi.fn().mockResolvedValue(null), getEntry: vi.fn().mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce({ snapshot: { id: 'entry' }, results: [] }) };
  const read = createLinkedSnapshotReader(repository);
  await expect(read('run', 'entry')).rejects.toThrow('fehlt');
  await expect(read('run', 'entry')).rejects.toThrow('network');
  expect((await read('run', 'entry')).snapshot.id).toBe('entry');
});

