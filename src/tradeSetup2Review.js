import {setup1ChecklistDetails} from './setup1ChecklistDetails.js';
import {savedRiskInvalidationLabel} from './dealingRangeRisk.js';
import {entryPatternVersion} from './entryPattern.js';
import { entryChecklist } from './m1Entry.js';
import { m1PrerequisiteReason } from './m1Structure.js';
import { inactiveM1Checklist } from './m1Checklist.js';
import { formatDatedTime } from './berlinTime.js';
import { fmtPrice, pricePrecisionForInstrument } from './format.js';
import { toPips } from './pipConfig.js';
import { formatRiskPips } from './entryRisk.js';
import { normalizeM1ChecklistPresentation } from './m1ChecklistPresentation.js';
import { savedDealingRangeStatus, isDisqualifiedDealingRange } from './tradeSetup2DealingRange.js';
import { antiConfluenceStatus, checklistObservationRules, observationRuleDetails } from './checklistObservationRules.js';
import { usesM5BosEntryPattern1, usesPivotBreakEntryPattern1, isEntryPattern1, usesOptionalM5BosEntryPattern1 } from './entryPattern1Conditions.js';
import {entryPattern1M5ConfirmationLabel} from './entryPattern1M5Confirmation.js';
import {isEntryPattern2,entryPattern2ConditionResults} from './entryPattern2Conditions.js';

export const REVIEW_STATUS_LABELS = { passed: 'Erfüllt', unmet: 'Fehlt am gespeicherten Stand', unknown: 'Unbekannt / unbewertet' };
export const REVIEW_STATUS_ICONS = { passed: '✓', unmet: '✕', unknown: '?' };

export function groupSetupSnapshots(snapshots) {
  const groups = new Map();
  for (const snapshot of snapshots) {
    const lifecycle=snapshot.checklist?.setup?.primary?.lifecycle??snapshot.rangeCourse?.lifecycle;
    const ideaKey=snapshot.entry?.ideaKey??lifecycle?.sourceIdeaKey,ideaKnownAt=snapshot.entry?.ideaKnownAt??lifecycle?.sourceIdeaKnownAt;
    const identity=ideaKey&&Number.isFinite(ideaKnownAt)&&ideaKnownAt<=snapshot.knownAt?ideaKey:snapshot.setupKey??snapshot.entry?.setupKey??snapshot.id;
    const key = `${snapshot.runId ?? ''}:${snapshot.instrument}:${identity}`;
    if (!groups.has(key)) groups.set(key, { key, candidate: null, latestCandidate: null, firstValidated: null, entries: [] });
    const group = groups.get(key);
    if (savedDealingRangeStatus(snapshot) === 'validated' && (!group.firstValidated || snapshot.knownAt < group.firstValidated.knownAt)) group.firstValidated = snapshot;
    if (snapshot.entry) {
      if (!group.entries.some(entry => entry.id === snapshot.id)) group.entries.push(snapshot);
    } else {
      if (!group.candidate || snapshot.knownAt < group.candidate.knownAt) group.candidate = snapshot;
      if (!group.latestCandidate || snapshot.knownAt > group.latestCandidate.knownAt) group.latestCandidate = snapshot;
    }
  }
  return [...groups.values()].map(group => {
    group.entries.sort((a, b) => a.knownAt - b.knownAt);
    const snapshot = group.entries[0] ?? (savedDealingRangeStatus(group.latestCandidate) === 'legacy' ? group.candidate : group.latestCandidate);
    return { ...group, snapshot, instrument: snapshot.instrument, direction: snapshot.direction, knownAt: snapshot.knownAt };
  }).sort((a, b) => b.knownAt - a.knownAt || a.key.localeCompare(b.key));
}

export function filterDealingRanges(groups, filter = 'current') {
  return groups.filter(group => {
    const status = savedDealingRangeStatus(group.snapshot);
    return filter === 'allStages' ? status !== 'legacy'
      : filter === 'current' ? ['confirmed', 'validated', 'disqualified', 'invalidated'].includes(status) : filter === 'disqualified' ? isDisqualifiedDealingRange(group.snapshot) : status === filter;
  });
}

// Die Tabelle erklärt gespeicherte Prüfungen, sie führt keinen neuen Scan aus.
// Ohne Entry fehlt eine vollständige M1-Prüfung; das ist kein negativer Jahresbefund.
export function setupEntryConditions(snapshot,selectedPattern=null) {
  const at = snapshot.knownAt;
  const known = time => Number.isFinite(time) && Number.isFinite(at) && time <= at;
  const checklist = snapshot.checklist?.status === 'ready' && known(snapshot.checklist.evaluatedAt) ? snapshot.checklist : null;
  const checks = checklist?.checks ?? {}, primary = checklist?.setup?.primary;
  const selectedVersion=snapshot.entry?.patternMatches?.find(item=>item.id===selectedPattern)?.entryPattern??selectedPattern;
  const selectedM1=snapshot.m1Check?.patterns?.find(check=>entryPatternVersion(check)===selectedVersion) ?? snapshot.m1Check;
  const m1 = known(selectedM1?.evaluatedAt)
    ? normalizeM1ChecklistPresentation(selectedM1, snapshot.direction, at) : null;
  const storedEntry = known(snapshot.entry?.recognizedAt) ? snapshot.entry : null;
  const matches=storedEntry?.patternMatches ?? [];
  const match=matches.find(item=>item.id===selectedPattern)??matches.find(item=>item.entryPattern===selectedPattern);
  // Nur die Belegansicht wechselt; Ausführung, Sizing und gespeicherter Besitzer bleiben unverändert.
  const entry=match?{...storedEntry,...match,label:isEntryPattern2(match.entryPattern)?'Entry Pattern 2':'Entry Pattern 1'}:storedEntry;
  const version=entryPatternVersion(entry) ?? entryPatternVersion(m1) ?? entryPatternVersion(checklist);
  const pattern1=isEntryPattern1(version);
  const pattern2=isEntryPattern2(version),patternLabel=pattern2?'Entry Pattern 2':pattern1?'Entry Pattern 1':'Entry 1';
  const multipleSources=new Set(matches.map(item=>item.sourceSetupKey).filter(Boolean)).size>1;
  const patternOptions=matches.map(item=>({version:item.entryPattern,id:item.id,
    label:`${isEntryPattern2(item.entryPattern)?'Entry Pattern 2':'Entry Pattern 1'}${multipleSources?` · Quelle ${known(item.sourceKnownAt)?formatDatedTime(item.sourceKnownAt):'Zeit unbekannt'}`:''}`}));
  const price = value => Number.isFinite(value) ? fmtPrice(value, pricePrecisionForInstrument(snapshot.instrument)) : 'unbekannt';
  const date = time => known(time) ? `${formatDatedTime(time)} Uhr` : 'nicht gespeichert';
  const normal = status => status === 'passed' ? 'passed' : ['unmet', 'pending', 'blocked'].includes(status) ? 'unmet' : 'unknown';
  const rows = [];
  const add = (key, label, status, details, time = at) => rows.push({ key, label, status, details, time: known(time) ? time : null });
  const originalDetails=setup1ChecklistDetails(checklist,m1);
  const checkpoints = checklist?.model === 'countertrend' ? [
    ['liquiditySweep', 'A · Liquidity Sweep bestätigt', primary?.recognizedAt],
    ['reaction', 'B · Passender M5-Orderblock bestätigt', primary?.reactionRecognizedAt],
    ['outerM5Trend', 'C · Äußerster M5-Trend', at],
    ['m5Trend', 'D · Aktueller M5-Trend / Countertrend', at],
    ['targets', 'E · Targets gefunden', primary?.targetSelection?.selectedAt],
    ['antiConfluences', 'F · Anti-Confluences prüfen', at],
  ] : [
    ['h1Trend', 'A · H1-Richtung bestätigt', at],
    ['liquiditySweep', 'B · Liquidity Sweep bestätigt', primary?.recognizedAt],
    ['reaction', 'C · Passender M5-Orderblock bestätigt', primary?.reactionRecognizedAt],
  ];
  for (const [key, label, time] of checkpoints) {
    const check = checks[key];
    const future = Number.isFinite(time) && !known(time);
    const antiStatus = key === 'antiConfluences' ? antiConfluenceStatus(check, at) : null;
    const status = antiStatus ? {clear:'passed',found:'unmet',unknown:'unknown'}[antiStatus] : normal(check?.status);
    const details = antiStatus && check ? observationRuleDetails(checklistObservationRules(check, key)) : originalDetails[key] ?? check?.details;
    add(key, label, future ? 'unknown' : status, future ? ['Beleg liegt nach dem gespeicherten Stand.']
      : details ?? ['Keine Prüfung gespeichert.'], time ?? at);
  }
  const dr = snapshot.dealingRange;
  if(checklist?.model==='countertrend') {
    const check=checks.confluences;
    add('confluences','G · Confluences beobachten',check ? 'observed' : 'unknown',
      check ? observationRuleDetails(checklistObservationRules(check,'confluences')) : ['Keine Beobachtung gespeichert.']);
  }
  if (savedDealingRangeStatus(snapshot) !== 'legacy') add('validation', checklist?.model === 'countertrend' ? 'DR-Stufe nach E/F' : 'D · DR-Validierung / Targets',
    dr?.status === 'validated' ? 'passed' : isDisqualifiedDealingRange(snapshot) ? 'unmet' : 'unknown', dr?.details ?? ['DR-Stufenprüfung nicht gespeichert.'], dr?.evaluatedAt ?? at);
  const timeCheck = snapshot.entryEligibility ?? m1?.entryEligibility ?? checks.time;
  add('time', 'Handelszeit / Session / News',
    timeCheck?.status === 'blocked' ? 'unmet' : timeCheck?.status === 'passed' ? 'passed' : 'unknown',
    [...timeCheck?.details ?? ['Zeitprüfung nicht gespeichert.'],
      pattern1 || pattern2 ? 'Das zentrale Entry-Gate prüft Handelszeiten, Sessions und News unmittelbar vor dem Entry.'
        : 'Entry 1 wird nur durch eine bekannte Sperre blockiert. Unbekannte Angaben gelten nicht als bestätigte Freigabe.']);
  const validity = primary?.validity;
  const riskReason=savedRiskInvalidationLabel(primary?.lifecycle,at);
  const searchEnded=primary?.lifecycle?.entrySearchAllowed===false;
  add('active', checklist?.model==='countertrend' ? 'DR aktiv / Entry-Suche vor T1' : 'Setup noch nicht durch T1 oder Invalidierung beendet',
    searchEnded ? 'unmet' : validity?.state === 'active' ? 'passed' : validity?.state === 'ended' && known(validity.recognizedAt) ? 'unmet' : 'unknown',
    riskReason?[riskReason,...dr?.details ?? []]:[searchEnded ? 'Entry-Suche nach T1 oder Lifecycle-Ende beendet.' : validity?.state === 'active' ? 'Am Bewertungsstand aktiv.' : validity?.state === 'ended' && known(validity.recognizedAt)
      ? `Beendet: ${ { target1: 'T1 vor Invalidation', target2:'T2 erreicht', entriesClosed:'alle Entries geschlossen', invalidation: 'Invalidation vor T1', both: 'T1 und Invalidierung' }[validity.reason] ?? 'Grund unbekannt' }.`
      : 'Gültigkeit nicht abschließend gespeichert. Nur ein bestätigtes Ende sperrt die M1-Auswertung.']);
  const pivotPattern=usesPivotBreakEntryPattern1(version)||pattern2;
  const anchor = pivotPattern ? m1?.structureStart : checks.m5Trend?.m1Anchor;
  add('anchor', pivotPattern ? 'Tatsächlicher Sweep als M1-Strukturstart' : 'Eindeutiger M5-Anker für die M1-P5-Struktur', known(anchor?.recognizedAt) ? 'passed' : 'unknown',
    known(anchor?.recognizedAt) ? [`${pivotPattern?'Sweep':'Pivot'} ${date(pivotPattern?anchor.structureFrom:anchor.pivotTime)} · ${price(anchor.price)}`] : ['Kein zeitlich belegter Anker gespeichert.'], anchor?.recognizedAt);
  add('structure', pattern2?'M1-P2-Struktur auswertbar':'M1-P5-Struktur auswertbar', m1?.currentTrend ? 'passed' : 'unknown',
    m1?.currentTrend ? (m1.details ?? []).slice(0, m1.trends?.length ?? 0)
      : Array.isArray(m1?.details) ? m1.details : ['Keine M1-Auswertung gespeichert.']);
  if (pattern1) for (const [key,label] of (usesM5BosEntryPattern1(version) ? [['m5Bos','M5-BOS in Setup-Richtung'],pivotPattern?['m1PivotBreak','M1-Pivotbruch ab Sweep']:['m1Choch','M1-CHoCH ab Sweep']] : [['m5Choch','M5-CHoCH in Setup-Richtung'],['m1Bos','M1-BOS in Setup-Richtung']])) {
    const signal=entry?.conditions?.[key] ?? m1?.conditions?.[key];
    const optional=key==='m5Bos' && usesOptionalM5BosEntryPattern1(version);
    const signalLabel=key==='m5Bos'?entryPattern1M5ConfirmationLabel(undefined,signal,version):label;
    add(key,optional?`${signalLabel} · optional für Full Entry`:signalLabel,known(signal?.recognizedAt) && signal.direction===snapshot.direction ? 'passed' : optional?'observed':m1?.conditions || entry?.conditions ? 'unmet' : 'unknown',
      known(signal?.recognizedAt) ? [`Erkannt ${date(signal.recognizedAt)}`] : [optional?'Optionaler M5-BOS fehlt · Risky Entry bei erfüllten übrigen Pflichtbedingungen.':'Pflichtsignal fehlt.'],signal?.recognizedAt);
  }
  if(pattern2){
    const conditions=entry?.conditions ?? m1?.conditions;
    const labels={orderBlockPlacement:'M5-OB vollständig jenseits des LS',orderBlockDepth:'M5-OB-Retesttiefe bis Entry',
      retest:'Retest eines passenden M5-OB',m1PivotBreak:'M1-P2-Pivotbruch in Traderichtung',
      retestedFvg:'Gleichgerichtete M1-FVG ab Strukturfreigabe',fvgRetest:'Retest der bekannten M1-FVG · Wick-Überlauf zulässig',fvg:'Neue gleichgerichtete M1-FVG nach FVG-Retest'};
    for(const rule of entryPattern2ConditionResults(conditions,snapshot.direction,entry?.recognizedAt ?? at)){
      const fact=conditions?.[rule.key];
      add(rule.key,labels[rule.key],rule.passed?'passed':fact?.status==='unknown'?'unknown':fact?'unmet':'unknown',
        fact?[`Erkannt ${date(fact.recognizedAt)}`,
          ...(Number.isFinite(fact.maxRetestFraction)?[`Grenze ${fact.maxRetestFraction*100} % · gemessene Tiefe ${Number.isFinite(fact.maxPenetrationFraction)?(fact.maxPenetrationFraction*100).toFixed(2)+' %':'unbekannt'}`]:[]),
          ...(rule.passed?[]:['Pflichtbedingung am gespeicherten Stand nicht erfüllt.'])]:['Kein kausaler Beleg gespeichert.'],fact?.recognizedAt);
    }
  }
  for (const [key, label, offset] of (pattern2?[]:[['retest', pattern1 ? 'Retest eines passenden M5-OB' : 'M5-OB-Retest nach bestätigter Reaktion', 2], ['fvg', pattern1 ? 'Gleichgerichtete M1-FVG nach Retest' : 'Erste gleichgerichtete M1-FVG nach Retest', 3]])) {
    const signal = m1?.[key] ?? entry?.conditions?.[key];
    // evaluateM1Checklist speichert nach den Trendzeilen CHoCH, BOS, Retest, FVG.
    const savedStatus = m1?.trends && m1.detailStatuses?.[m1.trends.length + offset + (m1.sweepPresentation?1:0)];
    const status = known(signal?.recognizedAt) ? 'passed' : signal ? 'unknown' : normal(savedStatus);
    add(key, label, status, known(signal?.recognizedAt)
      ? [`Kerze ${date(signal.candleTime)} · erkannt ${date(signal.recognizedAt)}${key === 'fvg' ? ` · FVG-Größe ${formatRiskPips(toPips(signal.gap, snapshot.instrument))} Pips` : ''}`,
        ...(signal.orderBlock ? [`M5-OB ${date(signal.orderBlock.startTime)} · erkannt ${date(signal.orderBlock.recognizedAt)} · ${price(signal.orderBlock.bottom)}–${price(signal.orderBlock.top)} · ${signal.orderBlock.inclusionRule==='setup1OrderBlockIncluded' ? 'Startregel: Setup-1.0-OB' : 'ab DR-Bestätigung entstanden'}`] : [])]
      : [status === 'unmet' ? 'In der gespeicherten M1-Prüfung noch nicht erfüllt.' : 'Kein kausaler M1-Beleg gespeichert.'], signal?.recognizedAt ?? at);
  }
  add('entry', `Schluss der FVG-Bestätigungskerze / ${patternLabel}`, entry ? 'passed' : 'unknown',
    entry ? [...entryChecklist({ entry }).details, `Entry-Preis ${price(entry.price)} · Kerze ${date(entry.candleTime)}`]
      : ['Kein Entry in diesem Snapshot. Daraus folgt keine vollständige spätere M1-Prüfung.'], entry?.recognizedAt ?? at);
  const observations = (pivotPattern ? [] : pattern1 ? [usesM5BosEntryPattern1(version)?'bos':'choch'] : ['choch', 'bos']).map(key => {
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
  return { pattern1,pattern2,patternLabel,patternOptions,selectedPatternId:match?.id??storedEntry?.id??null,version,rows, missing, counts, assessment, observations, prerequisiteNote: reason ? inactiveM1Checklist(reason).details[0] : null };
}
