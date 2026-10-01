import { afterEach, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';
import { usePolledFetch } from '../src/composables/usePolledFetch.js';

vi.mock('vue', async importOriginal => ({ ...await importOriginal(), onMounted: vi.fn(), onUnmounted: vi.fn() }));
let scope;
afterEach(() => scope?.stop());

it('skips disabled reads, rejects a late response and resumes on return to the dashboard', async () => {
  const enabled = ref(false);
  let finish;
  const fetch = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValue(['current']);
  scope = effectScope();
  const state = scope.run(() => usePolledFetch(fetch, { enabled: () => enabled.value }));
  await state.refresh();
  expect(fetch).not.toHaveBeenCalled();
  enabled.value = true;
  await nextTick();
  expect(fetch).toHaveBeenCalledTimes(1);
  enabled.value = false;
  await nextTick();
  finish(['stale']);
  await nextTick();
  expect(state.data.value).toEqual([]);
  enabled.value = true;
  await nextTick();
  await nextTick();
  expect(state.data.value).toEqual(['current']);
  expect(fetch).toHaveBeenCalledTimes(2);
});
