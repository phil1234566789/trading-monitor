import {describe,it,expect} from 'vitest';
import {m5EntryHistoryKnown} from '../src/m5EntryHistory.js';
import {goldWeekendGapCovered} from '../src/goldWeekendGap.js';
const sec=s=>Date.parse(s)/1000,bar=t=>({time:sec(t),open:10,high:11,low:9,close:10});
describe('native FXCM Gold weekend history',()=>{
 it('covers the observed Friday 16:45 New York to Sunday 18:00 closure only for XAU',()=>{const rows=[bar('2026-09-18T22:40:00+02:00'),bar('2026-09-21T00:00:00+02:00')],end=sec('2026-09-21T00:05:00+02:00');expect(m5EntryHistoryKnown(rows,rows[0].time,end,[],'XAUUSD')).toBe(true);for(const instrument of ['GBPUSD','EURUSD'])expect(m5EntryHistoryKnown(rows,rows[0].time,end,[],instrument)).toBe(false);});
 it('does not excuse missing candles during an open weekday',()=>expect(goldWeekendGapCovered(sec('2026-09-21T12:00:00+02:00'),sec('2026-09-21T12:05:00+02:00'))).toBe(false));
 it('follows the New York DST change at weekend boundaries',()=>{expect(goldWeekendGapCovered(sec('2026-03-06T16:45:00-05:00'),sec('2026-03-08T18:00:00-04:00'))).toBe(true);expect(goldWeekendGapCovered(sec('2026-10-30T16:45:00-04:00'),sec('2026-11-01T18:00:00-05:00'))).toBe(true);});
});
