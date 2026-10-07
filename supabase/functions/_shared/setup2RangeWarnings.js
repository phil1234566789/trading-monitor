export const RANGE_HISTORY_WARNING = 'Lifecycle konnte wegen fehlender oder lückenhafter Historie nicht ermittelt werden. Keine Entry-Freigabe; übrige Beobachtung läuft weiter.';

export function rangeWarningEvent(instrument, range, now = Date.now()) {
 return {id:`range-warning:${range.setupKey}:lifecycle-history`,instrument,stage:0,kind:'problem',setup_key:range.setupKey,
  direction:range.direction,signal_at:range.suspendedAt ?? new Date(now).toISOString(),
  payload:{category:'range-warning',message:range.reason ?? RANGE_HISTORY_WARNING}};
}

export function isRangeWarning(event) {
 if(event.payload?.category==='range-warning')return true;
 // Bereits angelegte Health-Outboxeinträge behalten ihre Historie, werden aber nicht mehr als Störung gesendet.
 return event.kind==='problem' && event.id?.startsWith('health:')===true && (
  /^Suspendierte DRs .+: Lifecycle-Historie konnte nicht ermittelt werden \(fehlend oder lückenhaft\)$/.test(event.payload?.message ?? '')
  || /^DR .+: Lifecycle-Historie fehlt oder ist lueckenhaft$/.test(event.payload?.message ?? '')
 );
}
