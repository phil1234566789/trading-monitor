import {expect,it} from 'vitest';
import {dobWatcherStatus} from '../src/dobWatcherStatus.js';

// Herzschlag-Punkt: rot steht/Fehler, orange Daten-Lücke bei offenem Markt, grau Pause 22–02, sonst grün läuft.
const now=Date.parse('2026-11-18T09:00:00Z')/1000,iso=s=>new Date(s*1000).toISOString();
const st=(instrument,extra={})=>({instrument,last_run_at:iso(now-30),skipped:null,error:null,last_m1_time:iso(now-120),...extra});
it('läuft, steht, Fehler, Pause, Daten-Lücke',()=>{
 expect(dobWatcherStatus([st('XAUUSD'),st('GBPUSD')],now)).toEqual({tone:'ok',text:'läuft · 09:59'});
 expect(dobWatcherStatus([st('XAUUSD',{last_run_at:iso(now-400)})],now)).toMatchObject({tone:'down',text:'steht seit 7 min'});
 expect(dobWatcherStatus([st('XAUUSD'),st('GBPUSD',{error:'boom'})],now)).toMatchObject({tone:'down',text:'Fehler GBP'});
 expect(dobWatcherStatus([st('XAUUSD',{skipped:'outsideEntryWindow'})],now).tone).toBe('pause');
 expect(dobWatcherStatus([st('XAUUSD',{last_m1_time:iso(now-360)})],now)).toMatchObject({tone:'gap',text:'Daten-Lücke · 5 min'});
});
