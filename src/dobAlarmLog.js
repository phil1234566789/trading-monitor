import {dobPoiTypeLabel} from './dobPoiType.js';

// dob_alarm_events als Protokollzeile (src/alarmLog.js). Preise und POI stehen nur im Alarmtext, deshalb liest die Zeile sie dort heraus;
// der Chart-Link ist derselbe wie im Alarm. Testnachrichten fehlen, Datenlücke und Fehler erscheinen als Systemzeile.
const PHASES={ob2Retest:'Retest',entry:'Entry'};
const REASONS={outsideAlarmWindow:'außerhalb Alarmfenster',alarmDisabled:'Alarm aus',poiTypeAlarmOff:'Alarm der POI-Art aus',
 blockedEntryHour:'Sperrzeit',blockedMonth:'Monat gesperrt',blockedZoneAge:'POI-Zone zu jung',counterDob:'Gegen-DOB',counterCandles:'Gegenkerzen'};
const SYSTEM={stale:'keine neuen M1-Kerzen',error:'Watcher-Fehler'};

export function dobAlarmRow(event){
 const lines=(event.text??'').split('\n'),url=lines.find(l=>l.startsWith('https://'))??null;
 const prices=/Entry ([\d.,]+) · SL ([\d.,]+)/.exec(event.text??'');
 // Die POI-Art steht schon im Typ, im Detail nur der Rest der POI-Zeile.
 const poi=lines.find(l=>l.startsWith('POI: '))?.slice(5).replace(`${dobPoiTypeLabel(event.poi_type)} · `,'');
 const system=Object.hasOwn(SYSTEM,event.phase);
 // ⛔: Entry mit Konfig-Sperre, als Warnung gesendet (unterdrückte Sperren tragen den Grund im Versandstatus).
 const phase=event.phase==='entry'&&event.guardrail&&event.status!=='suppressed'?'⛔ Entry':PHASES[event.phase]??event.phase;
 const reason=REASONS[event.error]??REASONS[event.guardrail]??event.error;
 return {id:`dob-${event.id}`,time:event.sent_at??event.signal_at,signalAt:event.signal_at,detectedAt:event.sent_at??event.detected_at,
  typeLabel:system?'DOB-Watcher':`DOB ${dobPoiTypeLabel(event.poi_type)} · ${phase}`,
  direction:event.direction,directionLabel:event.direction==='long'?'Long':event.direction==='short'?'Short':'–',
  detail:system?SYSTEM[event.phase]:[prices&&`SL ${prices[2]}`,poi].filter(Boolean).join(' · '),
  price:prices?.[1]??'–',link:system?null:url,
  deliveryLabel:event.status==='sent'?'TG ✅':event.status==='suppressed'?`unterdrückt · ${reason}`:event.status==='failed'?`Fehler · ${event.error??'–'}`:event.status??'–'};
}
// Testnachrichten gehören nicht ins Protokoll.
export const dobAlarmLogRows=events=>events.filter(e=>e.phase!=='test').map(dobAlarmRow);
