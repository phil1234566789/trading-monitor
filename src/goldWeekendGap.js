const newYorkClock = new Intl.DateTimeFormat('en-US', {
  timeZone:'America/New_York',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23',
});
const REOPEN=18*60;
// FXCM liefert die 18:00-Minute nach einer Pause nie (Archiv 01.01.–14.11.2026: 0× 18:00, 221× 18:01).
const M1_REOPEN=REOPEN+1;

function clock(at) {
  const parts=Object.fromEntries(newYorkClock.formatToParts(at*1000).map(p=>[p.type,p.value]));
  return {day:parts.weekday,minutes:Number(parts.hour)*60+Number(parts.minute)};
}

// FXCM XAU-Wochenschluss 16:45 New York bis Sonntag18:00; beide US-DST-Grenzen folgen der Zone.
function closedAt(at,reopen) {
  const {day,minutes}=clock(at);
  return day==='Sat' || day==='Fri' && minutes>=16*60+45 || day==='Sun' && minutes<reopen;
}

export function goldWeekendGapCovered(from, to, reopen=REOPEN) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) return false;
  if (from === to) return true;
  // Unter drei Tagen können beide geschlossenen Grenzen nur zum selben Wochenende gehören.
  return to-from <= 3*86400 && closedAt(from,reopen) && closedAt(to-0.001,reopen);
}

// Fehlende M1-Minuten [from,to) liegen komplett im Wochenende oder in der Tagespause Mo–Do ab 17:00 New York.
export function goldM1ClosureCovered(from, to) {
  if (goldWeekendGapCovered(from,to,M1_REOPEN)) return true;
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to || to-from > (M1_REOPEN-17*60)*60) return false;
  const start=clock(from),end=clock(to-0.001);
  return ['Mon','Tue','Wed','Thu'].includes(start.day) && start.day===end.day && start.minutes>=17*60 && end.minutes<M1_REOPEN;
}
