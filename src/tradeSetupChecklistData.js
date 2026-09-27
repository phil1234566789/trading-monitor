// Eigener Besitz der Snapshots verhindert, dass ein alter Fetch im gemeinsam genutzten
// Chart-Cache nach Symbol-/Replay-Wechsel als neuer Checklist-Datenstand erscheint.
export function createChecklistDataAdapter() {
  let generation = 0;
  let key;
  let slots;
  function reset(nextKey) {
    if (slots && nextKey === key) return;
    key = nextKey;
    generation++;
    slots = Object.fromEntries(['h1', 'm5'].map(tf => [tf, { sequence: 0, candles: [], status: 'loading' }]));
  }
  reset(null);
  return {
    reset,
    invalidate(tf) {
      const slot = slots[tf];
      slots[tf] = { sequence: slot.sequence + 1, candles: [], status: 'loading' };
    },
    begin(tf) {
      const slot = slots[tf];
      slot.status = slot.candles.length ? 'ready' : 'loading';
      return { generation, tf, sequence: ++slot.sequence };
    },
    finish(ticket, response, candles = []) {
      const slot = slots[ticket.tf];
      if (ticket.generation !== generation || ticket.sequence !== slot.sequence) return false;
      if (!response.ok) slot.status = 'error';
      else if (!response.applied) return false;
      else { slot.candles = candles; slot.status = 'ready'; }
      return true;
    },
    snapshot() {
      const statuses = Object.values(slots).map(s => s.status);
      return { ...slots, status: statuses.includes('error') ? 'error' : statuses.includes('loading') ? 'loading' : 'ready' };
    },
  };
}
