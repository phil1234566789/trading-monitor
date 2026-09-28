import { formatDatedTime } from './berlinTime.js';
import { newsEventsForInstrument, newsEventsInWindow, supportsNewsInstrument } from './newsEventRules.js';

export function evaluateChecklistNews({ instrument, evaluatedAt, news, newsLoadStatus } = {}) {
  const unknown = { status: 'unknown', label: newsLoadStatus === 'loading' ? 'News werden geladen' : 'News unbekannt', details: [] };
  if (!Number.isFinite(evaluatedAt) || Math.abs(evaluatedAt) > 8.64e12 || !supportsNewsInstrument(instrument)) return unknown;
  const rows = Array.isArray(news) ? news.filter(e => e && typeof e.currency === 'string') : [];
  const relevant = newsEventsForInstrument(rows, instrument);
  const valid = relevant.filter(e => Number.isFinite(e.eventTime) && Math.abs(e.eventTime) <= 8.64e12);
  const hits = newsEventsInWindow(valid, instrument, evaluatedAt, { beforeMinutes: 30, afterMinutes: 15 });
  // Eine bereits bekannte Sperre bleibt auch bei einem fehlgeschlagenen Nachladen bestehen.
  if (hits.length) {
    const waiting = hits.some(e => e.eventTime <= evaluatedAt);
    const end = Math.max(...hits.map(e => e.eventTime + 900));
    return { status: 'blocked', label: waiting ? 'News – Wartezeit' : 'News bevorstehend',
      details: [`bis ${formatDatedTime(end)} Uhr (Europe/Berlin)`] };
  }
  if (newsLoadStatus !== 'ready' || !Array.isArray(news) || rows.length !== news.length || valid.length !== relevant.length) return unknown;
  const day = formatDatedTime(evaluatedAt).slice(0, 10);
  const past = valid.some(e => e.eventTime + 900 <= evaluatedAt && formatDatedTime(e.eventTime).slice(0, 10) === day);
  return { status: 'passed', label: past ? 'News vorbei' : 'Keine News', details: [] };
}
