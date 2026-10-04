import { formatBerlinTime } from './berlinTime.js';

export const OBSERVATION_RULE_VERSION = 'checklist-observation-rules-v3';
export const OBSERVATION_STATUS_LABELS = { found: 'Gefunden', clear: 'Nicht gefunden', unknown: 'Nicht prüfbar' };
// Bis die DR-Zuordnung fachlich feststeht, bleibt historische Gegendivergenz ein Beleg ohne Sperrwirkung.
export const H1_COUNTER_DIVERGENCE_RULE = { id: 'h1CounterDivergence', label: 'H1-RSI-Gegendivergenz', disqualifies: false };
export const M5_SWEEP_DIVERGENCE_RULE = { id: 'm5SweepDivergence', label: 'M5-RSI-Divergenz am Sweep', disqualifies: false };

export function divergenceObservationRule({ id, label, invalidates, disqualifies, divergences, latestOnly = false }) {
  const candidates = divergences?.candidates ?? [];
  return { id, label, ...(invalidates !== undefined ? {invalidates} : {disqualifies}), status: divergences?.status === 'unknown' ? 'unknown' : candidates.length ? 'found' : 'clear',
    evidence: candidates.map(d => ({ ...d, kind: 'segment' })), ...(latestOnly ? {chartEvidenceLimit:1} : {}) };
}

export function summarizeAntiConfluenceRules(rules, evaluatedAt = Infinity, version) {
  if (version && ![OBSERVATION_RULE_VERSION, 'checklist-observation-rules-v1', 'checklist-observation-rules-v2'].includes(version)) return 'unknown';
  const enabled = rules.filter(rule => observationRuleDisqualifies(rule, version));
  const statusAt = rule => rule.status === 'found' && rule.evidence?.length
    && !rule.evidence.some(e => Number.isFinite(e.recognizedAt) && e.recognizedAt <= evaluatedAt) ? 'unknown' : rule.status;
  if (enabled.some(rule => statusAt(rule) === 'found')) return 'found';
  return enabled.some(rule => statusAt(rule) !== 'clear') ? 'unknown' : 'clear';
}

// Historisches pending bezeichnet hier einen Fund, nicht eine noch offene Prüfung.
export function checklistObservationRules(check, key) {
  if (Array.isArray(check?.rules)) return check.rules;
  if (!check) return [];
  const anti = key === 'antiConfluences';
  const statuses = anti ? { pending: 'found', passed: 'clear' } : { passed: 'found', pending: 'clear' };
  const rule = divergenceObservationRule({ ...(anti ? H1_COUNTER_DIVERGENCE_RULE : M5_SWEEP_DIVERGENCE_RULE),
    divergences: check.divergences, latestOnly: anti });
  const { disqualifies, ...legacyRule } = rule;
  return [{ ...legacyRule, invalidates: anti, status: statuses[check.status] ?? 'unknown',
    evidence: anti ? rule.evidence : rule.evidence.filter(e => e.association === 'sweep-touch') }];
}

export function antiConfluenceStatus(check, evaluatedAt = Infinity) {
  return check ? summarizeAntiConfluenceRules(checklistObservationRules(check, 'antiConfluences'), evaluatedAt, check.ruleVersion) : 'unknown';
}

export function observationRuleDetails(rules) {
  return rules.map(rule => {
    const times = rule.evidence.filter(e => Number.isFinite(e.fromTime) && Number.isFinite(e.toTime))
      .map(e => `${formatBerlinTime(e.fromTime)} → ${formatBerlinTime(e.toTime)}`);
    return `${rule.label}: ${OBSERVATION_STATUS_LABELS[rule.status] ?? OBSERVATION_STATUS_LABELS.unknown} · ${observationRuleDisqualifies(rule) ? 'disqualifiziert bei Fund' : 'nur Beobachtung'}${times.length ? ` · ${times.join('; ')}` : ''}`;
  });
}

export function restoreChecklistObservationChecks(checks) {
  if (!checks) return checks;
  const result = { ...checks };
  for (const key of ['antiConfluences', 'confluences']) {
    const check = checks[key];
    if (!check) continue;
    const rules = checklistObservationRules(check, key);
    result[key] = { ...check, rules, ruleVersion: check.ruleVersion ?? 'checklist-observation-rules-v1',
      ...(key === 'antiConfluences' ? { status: summarizeAntiConfluenceRules(rules, Infinity, check.ruleVersion) } : {}) };
  }
  return result;
}

export function observationRuleDisqualifies(rule, version) {
  if (version === OBSERVATION_RULE_VERSION) return rule.disqualifies === true;
  if (version && !['checklist-observation-rules-v1','checklist-observation-rules-v2'].includes(version)) return false;
  if (version) return rule.invalidates === true;
  return Object.hasOwn(rule, 'disqualifies') ? rule.disqualifies === true : rule.invalidates === true;
}
