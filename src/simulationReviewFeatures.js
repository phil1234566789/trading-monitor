import { setupEntryConditions } from './tradeSetup2Review.js';
import { checklistObservationRules, observationRuleDetails, observationRuleDisqualifies } from './checklistObservationRules.js';

export const FEATURE_VALUES = { met: '✓ Erfüllt', unmet: '✕ Nicht erfüllt', unknown: '? Unbekannt', observed: '~ Nur beobachtet' };

// Die Registry beschreibt gespeicherte Belege; neue Prüfungen brauchen keine UI-Verzweigung.
export function simulationReviewFeatures(snapshot) {
  const review = setupEntryConditions(snapshot);
  const features = review.rows.map(row => ({ key: row.key, group: /^[A-H] · /.test(row.label) || row.key === 'entry' ? 'checkpoint' : row.key === 'validation' ? 'antiConfluences' : 'entry', label: row.label,
    value: { passed: 'met', unmet: 'unmet', unknown: 'unknown', observed:'observed' }[row.status], details: row.details ?? [] }));
  const checks = snapshot.checklist?.checks;
  for (const [key, label] of [['antiConfluences', 'F · Anti-Confluences'], ['confluences', 'G · Confluences']]) {
    const rules = checklistObservationRules(checks?.[key], key);
    if (!features.some(f => f.key === key)) features.push({ key, group: 'checkpoint', label,
      value: rules.length ? 'observed' : 'unknown', details: [] });
    for (const rule of rules) features.push({ key: `${key}.${rule.id}`, group: key, label: rule.label,
      value: rule.status === 'unknown' ? 'unknown' : !observationRuleDisqualifies(rule, checks?.[key]?.ruleVersion) ? 'observed' : rule.status === 'found' ? 'unmet' : 'met',
      details: observationRuleDetails([{ ...rule, evidence: rule.evidence ?? [] }]) });
  }
  const entry = features.find(f => f.key === 'entry');
  if (entry) entry.label = `H · ${entry.label}`;
  return features.sort((a,b)=>a.group==='checkpoint' && b.group==='checkpoint' ? a.label.localeCompare(b.label) : 0);
}

export function featureDetails(features, selected) {
  return features.filter(f => f.key === selected.key || f.group === selected.key);
}
