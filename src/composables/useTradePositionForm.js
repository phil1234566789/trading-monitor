import { ref, watch } from 'vue';
import { addPositionToDealingRange, updateTrade } from '../tradeIntake.js';

import {berlinDatetimeInput,parseBerlinDatetimeInput} from '../berlinTime.js';
import {usePositionExitDate} from './usePositionExitDate.js';

const numeric = ['entryPrice','stopLoss','exitPrice','size','netPl','commission'];
const names = [...numeric,'entryTimeInput','exitTimeInput','outcome','reasoning','tradingAccountId'];
const empty = () => Object.fromEntries(names.map(name => [name, name === 'tradingAccountId' ? null : '']));
function fromTrade(t) {
  const values = empty();
  for (const name of [...numeric,'outcome','reasoning','tradingAccountId']) values[name] = t?.[name] ?? values[name];
  values.entryTimeInput = t?.entryTime != null ? berlinDatetimeInput(t.entryTime) : '';
  values.exitTimeInput = t?.exitTime != null ? berlinDatetimeInput(t.exitTime) : '';
  return values;
}

export function useTradePositionForm(trade, { saved, created }) {
  const fields = Object.fromEntries(names.map(name => [name, ref(name === 'tradingAccountId' ? null : '')]));
  const exitDate=usePositionExitDate(fields.entryTimeInput,fields.exitTimeInput);
  const addingPosition = ref(false), saving = ref(false), saveError = ref(''), createdPositionId = ref(null);
  let originalDraft = null;
  const values = () => Object.fromEntries(names.map(name => [name, fields[name].value]));
  const fill = value => { for (const name of names) fields[name].value = value[name]; exitDate.resetExitDate(); };
  watch(trade, (next, previous) => {
    const same = previous != null && next.id === previous.id;
    if (same && addingPosition.value) return;
    if (!same) { addingPosition.value = false; originalDraft = null; createdPositionId.value = null; saveError.value = ''; }
    const before = fromTrade(previous), after = fromTrade(next);
    // Polling darf ungespeicherte Eingaben derselben Ausführung nicht überschreiben.
    for (const name of names) if (!same || fields[name].value === before[name]) fields[name].value = after[name];
  }, { immediate:true });

  function applyEntryPrefill(prefill={}) {
    if(saving.value||createdPositionId.value!=null)return false;
    if(prefill.entryPrice!=null)fields.entryPrice.value=prefill.entryPrice;
    if(prefill.entryTime!=null)fields.entryTimeInput.value=berlinDatetimeInput(prefill.entryTime);
    return true;
  }
  function beginPositionDraft(prefill = {}) {
    if (saving.value || trade().dealingRangeId == null) return;
    if (!addingPosition.value) {
      originalDraft = values();
      fill({ ...empty(), tradingAccountId:trade().tradingAccountId ?? null });
      addingPosition.value = true;
    }
    applyEntryPrefill(prefill);
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
    payload.entryTime = value.entryTimeInput ? parseBerlinDatetimeInput(value.entryTimeInput,trade().entryTime) : null;
    payload.exitTime = value.exitTimeInput ? parseBerlinDatetimeInput(value.exitTimeInput,trade().exitTime) : null;
    payload.outcome = value.outcome === '' ? null : value.outcome;
    payload.reasoning = value.reasoning.trim() || null;
    payload.tradingAccountId = value.tradingAccountId;
    saveError.value = '';
    if((value.entryTimeInput&&!Number.isFinite(payload.entryTime))||(value.exitTimeInput&&!Number.isFinite(payload.exitTime))){
      saveError.value='Ungültige Berliner Entry-/Exit-Zeit (Sommerzeit beachten).';return;
    }
    if(exitDate.exitClockInput.value&&!exitDate.exitDateInput.value){saveError.value='Exit-Datum angeben.';return;}
    if (addingPosition.value && (!(payload.entryPrice > 0) || !Number.isFinite(payload.entryPrice) || !Number.isFinite(payload.entryTime))) {
      saveError.value = 'Entry-Preis und Entry-Zeit angeben.'; return;
    }
    saving.value = true;
    try {
      if (addingPosition.value) {
        const position = await addPositionToDealingRange(trade().dealingRangeId, { fields:payload });
        if (!position) throw new Error();
        // Bis der neue Datensatz nachgeladen ist, darf ein zweiter Klick nicht erneut einfügen.
        createdPositionId.value = position.id;
        created(position.id, payload.tradingAccountId);
      } else if (await updateTrade(trade().id, payload, trade().brokerPrivate)) saved();
      else throw new Error();
    } catch { saveError.value = 'Speichern fehlgeschlagen. Eingaben bleiben erhalten.'; }
    finally { saving.value = false; }
  }
  return { ...fields, ...exitDate, addingPosition, saving, saveError, createdPositionId, applyEntryPrefill, beginPositionDraft, cancelPositionDraft, save };
}
