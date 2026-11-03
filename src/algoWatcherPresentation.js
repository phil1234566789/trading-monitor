import {isRangeWarning} from '../supabase/functions/_shared/setup2RangeWarnings.js';

const berlinHour = new Intl.DateTimeFormat('en-GB', {
 timeZone:'Europe/Berlin', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', hourCycle:'h23'
});

export function isWatcherMarketGapWindow(at) {
 const time = Date.parse(at);
 return Number.isFinite(time) && berlinHour.formatToParts(time)
  .some(part => part.type === 'hour' && part.value === '23');
}

export function isExpectedWatcherPause(pause) {
 if (pause?.reason !== 'scheduledMarketGap') return false;
 const from = Date.parse(pause.from), until = Date.parse(pause.until);
 if (!Number.isFinite(from) || !Number.isFinite(until) || from >= until) return false;
 return berlinHour.format(from) === berlinHour.format(until - 1)
  && isWatcherMarketGapWindow(pause.from);
}

export function watcherSuspensionGroups(instruments = [], events = []) {
 const current = instruments.flatMap(item => (item.suspendedRanges ?? []).map(range => ({...range, instrument:item.instrument})));
 const currentKeys = new Set(current.map(range => range.setupKey));
 const historical = events.filter(event => isRangeWarning(event) && !currentKeys.has(event.setup_key));
 return {current, historical};
}

export function watcherIssuePhase(error, phase) {
 if (phase) return {fetch:'Abruf', evaluate:'Auswertung', save:'Speichern', delivery:'Versand'}[phase] ?? 'Schritt unbekannt';
 if (/^Pushover-Versand\b/i.test(error)) return 'Versand';
 if (/^Archive (?:trade_setups|fxcm_candles|forex_candles)\b/i.test(error)) return 'Abruf';
 if (/^FXCM-(?:M1|M5)-Feed\b|\bGET (?:fxcm_candles|forex_candles)\b/i.test(error)) return 'Abruf';
 if (/\b(?:POST|PATCH)\s+(?:rpc\/setup2_(?:checkpoint|store_live_evidence)|setup2_(?:live_state|live_evidence))\b/i.test(error)) return 'Speichern';
 return 'Schritt unbekannt';
}
