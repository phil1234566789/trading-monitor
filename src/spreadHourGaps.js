import { berlinOffsetMinutes } from './berlinTime.js';

export function skipSpreadHourGaps(next, until, duration) {
  while (next < until) {
    const minute = next / 60 + berlinOffsetMinutes(next * 1000);
    if (((minute % 1440) + 1440) % 1440 < 1380) break;
    next += duration;
  }
  return next;
}
