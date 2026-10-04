// Stufe und Lebenszyklus sind unabhängig: eine valide DR kann bereits beendet sein.
export function setup2EntrySearchEnded(checklist) {
  const candidate = checklist?.setup?.primary;
  return candidate?.lifecycle?.entrySearchAllowed === false || candidate?.validity?.state === 'ended';
}
