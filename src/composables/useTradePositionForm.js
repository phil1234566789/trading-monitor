import { ref, watch } from 'vue';
import { addPositionToDealingRange, updateTrade } from '../tradeIntake.js';

function toDatetimeLocal(seconds) {
  const d = new Date(seconds * 1000), pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const numeric = ['entryPrice','stopLoss','exitPrice','size','netPl','commission'];
const names = [...numeric,'entryTimeInput','exitTimeInput','outcome','reasoning','tradingAccountId'];
const empty = () => Object.fromEntries(names.map(name => [name, name === 'tradingAccountId' ? null : '']));
function fromTrade(t) {
  const values = empty();
  for (const name of [...numeric,'outcome','reasoning','tradingAccountId']) values[name] = t?.[name] ?? values[name];
  values.entryTimeInput = t?.entryTime != null ? toDatetimeLocal(t.entryTime) : '';
  values.exitTimeInput = t?.exitTime != null ? toDatetimeLocal(t.exitTime) : '';
  return values;
}

export function useTradePositionForm(trade, { saved, created }) {
  const fields = Object.fromEntries(names.map(name => [name, ref(name === 'tradingAccountId' ? null : '')]));
  const addingPosition = ref(false), saving = ref(false), saveError = ref(''), createdPositionId = ref(null);
  let originalDraft = null;
  const values = () => Object.fromEntries(names.map(name => [name, fields[name].value]));
  const fill = value => { for (const name of names) fields[name].value = value[name]; };
  watch(trade, (next, previous) => {
    const same = previous != null && next.id === previous.id;
    if (same && addingPosition.value) return;
    if (!same) { addingPosition.value = false; originalDraft = null; createdPositionId.value = null; saveError.value = ''; }
    const before = fromTrade(previous), after = fromTrade(next);
    // Polling darf ungespeicherte Eingaben derselben AusfÃ¼hrung nicht Ã¼berschreiben.
    for (const name of names) if (!same || fields[name].value === before[name]) fields[name].value = after[name];
  }, { immediate:true });

  function beginPositionDraft(prefill = {}) {
    if (saving.value || trade().dealingRangeId == null) return;
    if (!addingPosition.value) {
      originalDraft = values();
      fill({ ...empty(), tradingAccountId:trade().tradingAccountId ?? null });
      addingPosition.value = true;
    }
    if (prefill.entryPrice != null) fields.entryPrice.value = prefill.entryPrice;
    if (prefill.entryTime != null) fields.entryTimeInput.value = toDatetimeLocal(prefill.entryTime);
    saveError.value = '';
  }
  function cancelPositionDraft() {
    if (saving.value) return;
    fill(originalDraft ?? fromTrade(trade()));
    addingPosition.value = false; originalDraft = null; saveError.value = ''; createdPositionId.value = null;
  }
  async function save() {
    if (saving.value || createdPositionId.value != null) return;
    const value = values(), payload = {};
    for (const name of numeric) payload[name] = value[name] === '' ? null : Number(value[name]);
    payload.entryTime = value.entryTimeInput ? Math.floor(new Date(value.entryTimeInput).getTime()/1000) : null;
    payload.exitTime = value.exitTimeInput ? Math.floor(new Date(value.exitTimeInput).getTime()/1000) : null;
    payload.outcome = value.outcome === '' ? null : value.outcome;
    payload.reasoning = value.reasoning.trim() || null;
    payload.tradingAccountId = value.tradingAccountId;
    saveError.value = '';
    if (addingPosition.value && (!(payload.entryPrice > 0) || !Number.isFinite(payload.entryPrice) || !Number.isFinite(payload.entryTime))) {
      saveError.value = 'Entry-Preis und Entry-Zeit angeben.'; return;
    }
    saving.value = true;
    try {
      if (addingPosition.value) {
        const position = await addPositionToDealingRange(trade().dealingRangeId, { fields:payload });
        if (!position) throw new Error();
        // Bis der neue Datensatz nachgeladen ist, darf ein zweiter Klick nicht erneut einfÃ¼gen.
        createdPositionId.value = position.id;
        created(position.id, payload.tradingAccountId);
      } else if (await updateTrade(trade().id, payload, trade().brokerPrivate)) saved();
      else throw new Error();
    } catch { saveError.value = 'Speichern fehlgeschlagen. Eingaben bleiben erhalten.'; }
    finally { saving.value = false; }
  }
  return { ...fields, addingPosition, saving, saveError, createdPositionId, beginPositionDraft, cancelPositionDraft, save };
}
