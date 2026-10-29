const STORAGE_KEY = 'mmt-control-key';

export function readMilkyMetaTraderKey() {
  try { return localStorage.getItem(STORAGE_KEY) ?? ''; }
  catch { return ''; }
}

export function saveMilkyMetaTraderKey(key) {
  try { localStorage.setItem(STORAGE_KEY, key); return true; }
  catch { return false; }
}

export function forgetMilkyMetaTraderKey() {
  try { localStorage.removeItem(STORAGE_KEY); return true; }
  catch { return false; }
}
