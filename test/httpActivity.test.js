import { expect, it } from 'vitest';
import { beginActivity, useHttpActivity } from '../src/composables/useHttpActivity.js';

it('keeps concurrent work visible and tolerates cancellation followed by completion', () => {
  const activity = useHttpActivity();
  const first = beginActivity('Replay aktualisieren');
  const second = beginActivity('Replay aktualisieren');
  expect(activity.isActive.value).toBe(true);
  first(); first();
  expect(activity.activeLabels.value).toContain('Replay aktualisieren');
  second(); second();
  expect(activity.activeLabels.value).not.toContain('Replay aktualisieren');
  expect(activity.isActive.value).toBe(false);
});
