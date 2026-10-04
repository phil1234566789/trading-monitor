import {buildM1Structure} from './m1Structure.js';
import {markIgnoredCandles} from './sessionOccurrences.js';
import {berlinOffsetMinutes} from './berlinTime.js';

export function calculateSnapshotM1({rows,anchor,at,sessions,instrument}) {
  return buildM1Structure(markIgnoredCandles(rows,sessions.filter(s=>s.instrument===instrument),
    sec=>berlinOffsetMinutes(sec*1000)),anchor,at);
}
