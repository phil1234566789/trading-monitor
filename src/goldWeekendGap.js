const newYorkClock = new Intl.DateTimeFormat('en-US', {
  timeZone:'America/New_York',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23',
});
const REOPEN=18*60;

function clock(at) {
  const parts=Object.fromEntries(newYorkClock.formatToParts(at*1000).map(p=>[p.type,p.value]));
  return {day:parts.weekday,minutes:Number(parts.hour)*60+Number(parts.minute)};
}

// FXCM XAU-Wochenschluss 16:45 New York bis Sonntag18:00; beide US-DST-Grenzen folgen der Zone.
function closedAt(at,reopen=REOPEN) {
  const {day,minutes}=clock(at);
  return day==='Sat' || day==='Fri' && minutes>=16*60+45 || day==='Sun' && minutes<reopen;
}

export function goldWeekendGapCovered(from, to) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) return false;
  if (from === to) return true;
  // Unter drei Tagen können beide geschlossenen Grenzen nur zum selben Wochenende gehören.
  return to-from <= 3*86400 && closedAt(from) && closedAt(to-0.001);
}

// M1-Lücke [from,to) liegt komplett in Wochenende oder Tagespause (Mo–Do 17:00 New York).
// FXCM liefert nach jeder Pause nie die 18:00-Minute (Archiv Okt/Nov 2026), deshalb zählt sie mit.
export function goldM1ClosureCovered(from, to) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) return false;
  if (from === to) return true;
  if (to-from <= 3*86400 && closedAt(from,REOPEN+1) && closedAt(to-0.001,REOPEN+1)) return true;
  const start=clock(from),end=clock(to-0.001);
  return to-from <= 61*60 && ['Mon','Tue','Wed','Thu'].includes(start.day) && start.day===end.day
    && start.minutes>=17*60 && end.minutes<=REOPEN;
}
