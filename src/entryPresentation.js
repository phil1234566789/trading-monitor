import {entryCategoryOf,entryCategoryLabel} from './entryCategory.js';
import {entrySizingLabel} from './tradeSetup2EntrySizing.js';
import {fmtMoney} from './format.js';

export function entrySizeLabel(value) {
  if(!entryCategoryOf(value)) {
    const previous=entrySizingLabel(value?.sizing ?? value?.entrySizing);
    return previous.startsWith('Historischer Stand')?previous:`Historischer Stand · ${previous}`;
  }
  const factor=value?.positionSizeFactor ?? value?.sizing?.positionSizeFactor ?? value?.entrySizing?.positionSizeFactor;
  return Number.isFinite(factor)?`${(factor*100).toLocaleString('de-DE')} % der Full-Größe`:'Relative Größe nicht gespeichert';
}
export function entryOptionalConditionLabel(value) {
  if(!entryCategoryOf(value))return '';
  return value?.optionalConditionsMissing?.includes('m5Bos')?'Optionaler M5-BOS fehlt':'';
}
export function entryLotsLabel(value) {
  if(!Number.isFinite(value?.lots))return '';
  const lots=n=>n.toLocaleString('de-DE',{maximumFractionDigits:2});
  const reference=entryCategoryOf(value)&&Number.isFinite(value.fullLots)?` · Full: ${lots(value.fullLots)} Lots`:'';
  return `${lots(value.lots)} Lots${reference}`;
}
export function entryBudgetLabel(value) {
  if(!Number.isFinite(value?.riskBudget))return '';
  const reference=entryCategoryOf(value)&&Number.isFinite(value.fullRiskBudget)?` · Full: ${fmtMoney(value.fullRiskBudget)}`:'';
  return `Preisrisikobudget ${fmtMoney(value.riskBudget)}${reference}`;
}
export function entryCategorySizeLabel(value) {
  return entryCategoryOf(value)?`${entryCategoryLabel(value)} · ${entrySizeLabel(value)}`:entrySizeLabel(value);
}
