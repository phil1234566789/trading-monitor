import { computed, nextTick, onScopeDispose, ref, watch } from 'vue';
import { afterBrowserPaint } from '../afterBrowserPaint.js';
import { beginActivity } from './useHttpActivity.js';

const REPLAY_INPUT_DELAY_MS = 1000;

export function useReplayInput(time, format, context) {
  const display = () => time.value == null ? '' : format(time.value);
  const draft = ref(display());
  let timer, cancelPaint, finish, revision = 0, applying = false;
  function cancel() {
    revision++;
    clearTimeout(timer);
    cancelPaint?.();
    cancelPaint = null;
    finish?.();
    finish = null;
  }
  function reset() { cancel(); draft.value = display(); }
  watch(time, () => { if (!applying) reset(); }, { flush: 'sync' });
  if (context) watch(context, reset, { flush: 'sync' });
  onScopeDispose(cancel);

  return computed({
    get: () => draft.value,
    set(value) {
      cancel();
      draft.value = value;
      const seconds = Math.floor(new Date(value).getTime() / 1000);
      // Leere Teil-Eingaben und normalisierte Fantasiedaten dürfen den Chart nicht zurücksetzen.
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ||
          !Number.isFinite(seconds) || format(seconds) !== value || seconds === time.value) return;
      const ticket = revision;
      timer = setTimeout(async () => {
        const done = beginActivity('Replay aktualisieren');
        finish = done;
        await nextTick();
        if (ticket !== revision) { done(); return; }
        // Der vorhandene Indikator muss vor den synchronen Chart-Watchern gezeichnet werden.
        cancelPaint = afterBrowserPaint(async () => {
          if (ticket !== revision) { done(); return; }
          try {
            applying = true;
            time.value = seconds;
            applying = false;
            await nextTick();
          } finally {
            applying = false;
            done();
            if (finish === done) finish = null;
          }
        });
      }, REPLAY_INPUT_DELAY_MS);
    },
  });
}
