const newYorkClock = new Intl.DateTimeFormat('en-US', {
  timeZone:'America/New_York',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23',
});

// FXCM XAU-Wochenschluss 16:45 New York bis Sonntag18:00; beide US-DST-Grenzen folgen der Zone.
function closedAt(at) {
  const parts=Object.fromEntries(newYorkClock.formatToParts(at*1000).map(p=>[p.type,p.value]));
  const minutes=Number(parts.hour)*60+Number(parts.minute);
  return parts.weekday==='Sat' || parts.weekday==='Fri' && minutes>=16*60+45
    || parts.weekday==='Sun' && minutes<18*60;
}

export function goldWeekendGapCovered(from, to) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) return false;
  if (from === to) return true;
  // Unter drei Tagen können beide geschlossenen Grenzen nur zum selben Wochenende gehören.
  return to-from <= 3*86400 && closedAt(from) && closedAt(to-0.001);
}
