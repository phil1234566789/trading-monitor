import {doubleOrderBlockPinSnapshot} from './doubleOrderBlockPin.js';
import {persistDoubleOrderBlockPin,upsertM5ObZoneId} from '../supabase/functions/_shared/doubleOrderBlockPinStore.js';

// Beim ersten Alarm eines DOB-Paars (Retest oder Entry) pinnt der dob-watcher den DOB und seinen POI
// über die bestehenden Pin-Wege (dob_pin_key bzw. ob_zone_id). Ein vorhandener Pin bleibt unangetastet, damit Philips Notiz
// nicht überschrieben wird; H1/H4-Zonen werden nur gesucht, nie angelegt (wie Dashboard und MCP).
const HTF={H1:'1H',H4:'4H'};
const bounds=(rows,seconds)=>({from:rows[0]?.time??null,through:rows.length?rows.at(-1).time+seconds:null,count:rows.length});
const must=({data,error})=>{if(error)throw new Error(error.message);return data;};

export async function dobAutoPin(client,{event,setup,pair,evaluatedAt,m5Candles,m1Candles}){
 const poiType=event.poiType??'htf_ob';
 const earlier=must(await client.from('dob_alarm_events').select('id').eq('poi_type',poiType).like('setup_id',`${pair.id}:%`).neq('id',event.id).neq('status','suppressed').limit(1));
 if(earlier.length)return {skipped:'notFirstAlarm'};
 const existing=must(await client.from('pin_context').select('id').eq('dob_pin_key',pair.id).maybeSingle());
 // Der Retest-Kandidat hat noch keine Entry-Routen, der Pin-Validator verlangt das Feld.
 const dob=existing?{id:existing.id,existed:true}:await persistDoubleOrderBlockPin({supabase:client,
  snapshot:doubleOrderBlockPinSnapshot({entries:{},...pair},{symbol:pair.instrument,currentBar:'5m',replayUntil:null,evaluatedAt,visibleRange:null,
   coverage:{source:'native-fxcm-bid',m5:bounds(m5Candles,300),m1:bounds(m1Candles,60)}}),
  resolveObId:ob=>upsertM5ObZoneId(client,{instrument:pair.instrument,direction:pair.direction,top:ob.top,bottom:ob.bottom,startTime:ob.startTime})});
 return {dob:dob.id,poi:await (POI_PINS[poiType]??POI_PINS.htf_ob)(client,setup.poi,pair)};
}

// POI-Pin je POI-Art: HTF-OB pinnt die ob_zone; LQ-Sweep pinnt später das gesweepte Level (folgt mit der LQ-Sweep-Erkennung).
const POI_PINS={htf_ob:pinHtfPoi,lq_sweep:pinLsReactionPoi};
// LQ-Sweep: das tragende LS-Reaktion-Setup als normaler trade_setup-Pin (wie Rechtsklick → Anpinnen im Chart).
async function pinLsReactionPoi(client,poi){
 if(!Number.isSafeInteger(poi?.tradeSetupId))return {skipped:'noTradeSetup'};
 const rows=must(await client.from('pin_context').upsert({kind:'trade_setup',trade_setup_id:poi.tradeSetupId},{onConflict:'trade_setup_id',ignoreDuplicates:true}).select('id'));
 return {tradeSetupId:poi.tradeSetupId,pin:rows[0]?.id??null,existed:!rows.length};
}
async function pinHtfPoi(client,poi,pair){
 const timeframe=HTF[poi?.timeframe];
 if(!timeframe)return {skipped:'noHtfPoi'};
 const zone=must(await client.from('ob_zones').select('id').match({instrument:pair.instrument,timeframe,direction:pair.direction,
  start_time:new Date(poi.zoneStartTime*1000).toISOString()}).maybeSingle());
 if(!zone)throw new Error(`POI ${timeframe} ${pair.direction} ${new Date(poi.zoneStartTime*1000).toISOString()} nicht in ob_zones`);
 const rows=must(await client.from('pin_context').upsert({kind:'ob_zone',ob_zone_id:zone.id},{onConflict:'ob_zone_id',ignoreDuplicates:true}).select('id'));
 return {obZoneId:zone.id,pin:rows[0]?.id??null,existed:!rows.length};
}
