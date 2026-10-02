import { entryChecklist } from './m1Entry.js';
import { m1PrerequisiteReason } from './m1Structure.js';
import { inactiveM1Checklist } from './m1Checklist.js';
import { formatDatedTime } from './berlinTime.js';
import { fmtPrice, pricePrecisionForInstrument } from './format.js';
import { toPips } from './pipConfig.js';
import { formatRiskPips } from './entryRisk.js';
import { normalizeM1ChecklistPresentation } from './m1ChecklistPresentation.js';

export const REVIEW_STATUS_LABELS = { passed: 'Erfüllt', unmet: 'Fehlt am gespeicherten Stand', unknown: 'Unbekannt / unbewertet' };
export const REVIEW_STATUS_ICONS = { passed: '✓', unmet: '✕', unknown: '?' };

export function groupSetupSnapshots(snapshots) {
  const groups = new Map();
  for (const snapshot of snapshots) {
    const key = `${snapshot.runId ?? ''}:${snapshot.instrument}:${snapshot.setupKey ?? snapshot.entry?.setupKey ?? snapshot.id}`;
    if (!groups.has(key)) groups.set(key, { key, candidate: null, entries: [] });
    const group = groups.get(key);
    if (snapshot.entry) {
      if (!group.entries.some(entry => entry.id === snapshot.id)) group.entries.push(snapshot);
    } else if (!group.candidate || snapshot.knownAt < group.candidate.knownAt) group.candidate = snapshot;
  }
  return [...groups.values()].map(group => {
    group.entries.sort((a, b) => a.knownAt - b.knownAt);
    const snapshot = group.entries[0] ?? group.candidate;
    return { ...group, snapshot, instrument: snapshot.instrument, direction: snapshot.direction, knownAt: snapshot.knownAt };
  }).sort((a, b) => b.knownAt - a.knownAt || a.key.localeCompare(b.key));
}

// Die Tabelle erklärt gespeicherte Prüfungen, sie führt keinen neuen Scan aus.
// Kandidaten enthalten nur ihren Erststand: fehlendes M1 ist kein negativer Jahresbefund.
export function setupEntryConditions(snapshot) {
  const at = snapshot.knownAt;
  const known = time => Number.isFinite(time) && Number.isFinite(at) && time <= at;
  const checklist = snapshot.checklist?.status === 'ready' && known(snapshot.checklist.evaluatedAt) ? snapshot.checklist : null;
  const checks = checklist?.checks ?? {}, primary = checklist?.setup?.primary;
  const m1 = known(snapshot.m1Check?.evaluatedAt)
    ? normalizeM1ChecklistPresentation(snapshot.m1Check, snapshot.direction, at) : null;
  const entry = known(snapshot.entry?.recognizedAt) ? snapshot.entry : null;
  const price = value => Number.isFinite(value) ? fmtPrice(value, pricePrecisionForInstrument(snapshot.instrument)) : 'unbekannt';
  const date = time => known(time) ? `${formatDatedTime(time)} Uhr` : 'nicht gespeichert';
  const normal = status => status === 'passed' ? 'passed' : ['unmet', 'pending', 'blocked'].includes(status) ? 'unmet' : 'unknown';
  const rows = [];
  const add = (key, label, status, details, time = at) => rows.push({ key, label, status, details, time: known(time) ? time : null });
  for (const [key, label, time] of [
    ['h1Trend', 'A · H1-Richtung bestätigt', at],
    ['liquiditySweep', 'B · Liquidity Sweep bestätigt', primary?.recognizedAt],
    ['reaction', 'C · Passender M5-Orderblock bestätigt', primary?.reactionRecognizedAt],
  ]) {
    const check = checks[key];
    const future = Number.isFinite(time) && !known(time);
    add(key, label, future ? 'unknown' : normal(check?.status), future ? ['Beleg liegt nach dem gespeicherten Stand.']
      : check?.details ?? ['Keine Prüfung gespeichert.'], time ?? at);
  }
  const timeCheck = checks.time;
  add('time', 'Handelszeit / Session / News',
    timeCheck?.status === 'blocked' ? 'unmet' : timeCheck?.status === 'passed' ? 'passed' : 'unknown',
    [...timeCheck?.details ?? ['Zeitprüfung nicht gespeichert.'],
      'Entry 1 wird nur durch eine bekannte Sperre blockiert. Unbekannte Angaben gelten nicht als bestätigte Freigabe.']);
  const validity = primary?.validity;
  add('active', 'Setup noch nicht durch T1 oder Invalidierung beendet',
    validity?.state === 'active' ? 'passed' : validity?.state === 'ended' && known(validity.recognizedAt) ? 'unmet' : 'unknown',
    [validity?.state === 'active' ? 'Am Bewertungsstand aktiv.' : validity?.state === 'ended' && known(validity.recognizedAt)
      ? `Beendet: ${ { target1: 'T1 erreicht', invalidation: 'invalidiert', both: 'T1 und Invalidierung' }[validity.reason] ?? 'Grund unbekannt' }.`
      : 'Gültigkeit nicht abschließend gespeichert. Nur ein bestätigtes Ende sperrt die M1-Auswertung.']);
  const anchor = checks.m5Trend?.m1Anchor;
  add('anchor', 'Eindeutiger M5-Anker für die M1-P5-Struktur', known(anchor?.recognizedAt) ? 'passed' : 'unknown',
    known(anchor?.recognizedAt) ? [`Pivot ${date(anchor.pivotTime)} · ${price(anchor.price)}`] : ['Kein zeitlich belegter Anker gespeichert.'], anchor?.recognizedAt);
  add('structure', 'M1-P5-Struktur auswertbar', m1?.currentTrend ? 'passed' : 'unknown',
    m1?.currentTrend ? m1.details.slice(0, m1.trends.length)
      : Array.isArray(m1?.details) ? m1.details : ['Keine M1-Auswertung gespeichert.']);
  for (const [key, label, offset] of [['retest', 'M5-OB-Retest nach bestätigter Reaktion', 2], ['fvg', 'Erste gleichgerichtete M1-FVG nach Retest', 3]]) {
    const signal = m1?.[key];
    // evaluateM1Checklist speichert nach den Trendzeilen CHoCH, BOS, Retest, FVG.
    const savedStatus = m1?.trends && m1.detailStatuses?.[m1.trends.length + offset];
    const status = known(signal?.recognizedAt) ? 'passed' : signal ? 'unknown' : normal(savedStatus);
    add(key, label, status, known(signal?.recognizedAt)
      ? [`Kerze ${date(signal.candleTime)} · erkannt ${date(signal.recognizedAt)}${key === 'fvg' ? ` · FVG-Größe ${formatRiskPips(toPips(signal.gap, snapshot.instrument))} Pips` : ''}`]
      : [status === 'unmet' ? 'In der gespeicherten M1-Prüfung noch nicht erfüllt.' : 'Kein kausaler M1-Beleg gespeichert.'], signal?.recognizedAt ?? at);
  }
  add('entry', 'Schluss der FVG-Bestätigungskerze / Entry 1', entry ? 'passed' : 'unknown',
    entry ? [...entryChecklist({ entry }).details, `Entry-Preis ${price(entry.price)} · Kerze ${date(entry.candleTime)}`]
      : ['Kein Entry in diesem Snapshot. Daraus folgt keine vollständige spätere M1-Prüfung.'], entry?.recognizedAt ?? at);
  const observations = ['choch', 'bos'].map(key => {
    const signal = m1?.[key];
    return { label: key === 'choch' ? 'M1 CHoCH' : 'M1 BOS', text: known(signal?.recognizedAt)
      ? `${date(signal.candleTime)} · erkannt ${date(signal.recognizedAt)} · ${price(signal.price)}`
      : m1?.trends && !signal ? 'Am Stand nicht vorhanden.' : 'Unbekannt / nicht zeitlich belegt.' };
  });
  const reason = m1PrerequisiteReason(checklist);
  const missing = rows.filter(row => row.status === 'unmet');
  const counts = ['passed', 'unmet', 'unknown'].map(status => rows.filter(row => row.status === status).length);
  const assessment = missing.length ? { status: 'unmet', label: 'Nicht tradebar am Bewertungsstand' }
    : { status: 'unknown', label: entry ? 'Entry gespeichert · siehe Einzelbedingungen' : 'Handelbarkeit nicht vollständig belegt' };
  return { rows, missing, counts, assessment, observations, prerequisiteNote: reason ? inactiveM1Checklist(reason).details[0] : null };
}
