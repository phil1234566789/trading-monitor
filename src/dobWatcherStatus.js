import {formatBerlinTime} from './berlinTime.js';
import {m1GapCovered} from './goldWeekendGap.js';

// Herzschlag des dob-watchers für Navigation und Panel (ein Punkt, ein Text): rot steht (letzter Lauf > 3 min oder Fehler),
// orange Daten-Lücke (keine neue M1 > 3 min bei offenem Markt), grau Pause (22–02 Uhr), sonst grün läuft. states = dob_watcher_state je
// Instrument, Zeiten als ISO-Text.
export const DOB_WATCHER_STALE_SECONDS=180;
export const DOB_WATCHER_SHORT={XAUUSD:'XAU',GBPUSD:'GBP',EURUSD:'EUR'};
const sec=v=>v?Math.floor(Date.parse(v)/1000):null;
const minutes=s=>`${Math.max(1,Math.round(s/60))} min`;

export function dobWatcherStatus(states,nowSec){
 if(!states.length)return {tone:'down',text:'keine Daten'};
 const lastRun=Math.max(...states.map(s=>sec(s.last_run_at)??0));
 if(nowSec-lastRun>DOB_WATCHER_STALE_SECONDS)return {tone:'down',text:`steht seit ${minutes(nowSec-lastRun)}`};
 const failed=states.find(s=>s.error);
 if(failed)return {tone:'down',text:`Fehler ${DOB_WATCHER_SHORT[failed.instrument]??failed.instrument}`};
 if(states.every(s=>s.skipped==='outsideEntryWindow'))return {tone:'pause',text:'Pause bis 02:00'};
 const gaps=states.filter(s=>!s.skipped&&s.last_m1_time).map(s=>({s,next:sec(s.last_m1_time)+60}))
  .filter(({s,next})=>nowSec-next>DOB_WATCHER_STALE_SECONDS&&!m1GapCovered(s.instrument,next,Math.floor(nowSec/60)*60));
 if(gaps.length){const worst=Math.min(...gaps.map(g=>g.next));return {tone:'gap',text:`Daten-Lücke · ${minutes(nowSec-worst)}`};}
 return {tone:'ok',text:`läuft · ${formatBerlinTime(lastRun)}`};
}

// Telegram-Zustellungen, die nicht sicher angekommen sind (dob_alarm_events, Outbox in _shared/dobDelivery.js): Panel zeigt sie,
// statt dass ein Alarm still fehlt. pending/sending erst nach 2 min, vorher läuft der Versand noch normal.
const DELIVERY_LABEL={failed:'nicht zugestellt',uncertain:'Annahme unklar',pending:'noch nicht gesendet',sending:'Versand hängt'};
export function dobDeliveryIssues(rows,nowSec){
 return rows.filter(r=>r.status==='failed'||r.status==='uncertain'||nowSec-sec(r.detected_at)>120)
  .map(r=>({key:r.id,asset:DOB_WATCHER_SHORT[r.instrument]??r.instrument,clock:formatBerlinTime(sec(r.detected_at)),head:r.text.split('\n')[0],
   label:r.status==='uncertain'&&!r.outage_notified_at&&r.attempts<2?'Annahme unklar, Wiederholung folgt':DELIVERY_LABEL[r.status]}));
}
