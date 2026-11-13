import {berlinDateStrFor} from './berlinTime.js';
import {snapshotAgeSeconds} from './milkyMetaTraderMonitoring.js';
import {mmtPollDelay,mmtStaleSeconds} from './milkyMetaTraderPolling.js';

const reasons={daily_loss:'Tagesverlustgrenze erreicht',broker_drawdown:'Bestätigte Drawdown-Grenze erreicht'};
export const dailyStopReason=reason=>reasons[reason]??reason??'Schutzsperre aktiv';
export function entryDailyStopReason(status,now){
 const day=berlinDateStrFor(now/1000),stop=status?.daily_stop,risk=status?.bridge?.snapshot?.risk;
 if(stop?.latched===true&&stop.day===day)return `Tagesstopp aktiv: ${dailyStopReason(stop.reason)}. Keine neuen Entries.`;
 const age=snapshotAgeSeconds(status?.bridge?.heartbeat_at,now);
 if(!status?.online||age==null||age>mmtStaleSeconds(mmtPollDelay(status)))return '';
 const current=(value,stamp)=>value?.day===day&&Number.isFinite(stamp)&&now/1000-stamp>=-1&&now/1000-stamp<=15;
 if(stop?.latched===true&&current(stop,stop.checked_at_sec))return `Tagesstopp aktiv: ${dailyStopReason(stop.reason)}. Keine neuen Entries.`;
 if(risk?.latched===true&&current(risk,risk.time))return 'Tagesstopp aktiv. Keine neuen Entries.';
 return '';
}
