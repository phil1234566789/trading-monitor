import {doubleOrderBlockPinSnapshot} from './doubleOrderBlockPin.js';
import {persistDoubleOrderBlockPin,upsertM5ObZoneId} from '../supabase/functions/_shared/doubleOrderBlockPinStore.js';

// Beim ersten zugestellten Alarm eines DOB-Paars (Retest oder Entry) pinnt der dob-watcher den DOB und seine Quelle der Kraft
// über die bestehenden Pin-Wege (dob_pin_key bzw. ob_zone_id). Ein vorhandener Pin bleibt unangetastet, damit Philips Notiz
// nicht überschrieben wird; H1/H4-Zonen werden nur gesucht, nie angelegt (wie Dashboard und MCP).
const HTF={H1:'1H',H4:'4H'};
const bounds=(rows,seconds)=>({from:rows[0]?.time??null,through:rows.length?rows.at(-1).time+seconds:null,count:rows.length});
const must=({data,error})=>{if(error)throw new Error(error.message);return data;};

export async function dobAutoPin(client,{event,setup,pair,evaluatedAt,m5Candles,m1Candles}){
 const earlier=must(await client.from('dob_alarm_events').select('id').like('setup_id',`${pair.id}:%`).neq('id',event.id).in('status',['sent','uncertain']).limit(1));
 if(earlier.length)return {skipped:'notFirstAlarm'};
 const existing=must(await client.from('pin_context').select('id').eq('dob_pin_key',pair.id).maybeSingle());
 // Der Retest-Kandidat hat noch keine Entry-Routen, der Pin-Validator verlangt das Feld.
 const dob=existing?{id:existing.id,existed:true}:await persistDoubleOrderBlockPin({supabase:client,
  snapshot:doubleOrderBlockPinSnapshot({entries:{},...pair},{symbol:pair.instrument,currentBar:'5m',replayUntil:null,evaluatedAt,visibleRange:null,
   coverage:{source:'native-fxcm-bid',m5:bounds(m5Candles,300),m1:bounds(m1Candles,60)}}),
  resolveObId:ob=>upsertM5ObZoneId(client,{instrument:pair.instrument,direction:pair.direction,top:ob.top,bottom:ob.bottom,startTime:ob.startTime})});
 return {dob:dob.id,source:await pinSource(client,setup.sourceOfStrength,pair)};
}

async function pinSource(client,source,pair){
 const timeframe=HTF[source?.timeframe];
 if(!timeframe)return {skipped:'noHtfSource'};
 const zone=must(await client.from('ob_zones').select('id').match({instrument:pair.instrument,timeframe,direction:pair.direction,
  start_time:new Date(source.zoneStartTime*1000).toISOString()}).maybeSingle());
 if(!zone)throw new Error(`Quelle ${timeframe} ${pair.direction} ${new Date(source.zoneStartTime*1000).toISOString()} nicht in ob_zones`);
 const rows=must(await client.from('pin_context').upsert({kind:'ob_zone',ob_zone_id:zone.id},{onConflict:'ob_zone_id',ignoreDuplicates:true}).select('id'));
 return {obZoneId:zone.id,pin:rows[0]?.id??null,existed:!rows.length};
}
