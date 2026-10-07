export const ENTRY_CATEGORY_VERSION = 'full-risky-v1';

// Historische Faktoren sind keine Kategorie: nur ausdrücklich gespeicherte Werte zählen.
export function entryCategoryOf(entryOrRow) {
  const category = entryOrRow?.entryCategory;
  return category === 'full' || category === 'risky' ? category : null;
}

export function entryCategoryLabel(entryOrRow) {
  const category = entryCategoryOf(entryOrRow);
  return category === 'full' ? 'Full Entry' : category === 'risky' ? 'Risky Entry'
    : 'Historischer Stand · keine Kategorie gespeichert';
}
