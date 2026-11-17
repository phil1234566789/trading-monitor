import {assertDoubleOrderBlockPin,cloneDoubleOrderBlockContext} from './doubleOrderBlockPin.js';
const COLUMNS='id,kind,dob_pin_key,dob_context,pin_type,note,created_at';

/** @param {any} options */
export async function persistDoubleOrderBlockPin({supabase,resolveObId,snapshot,note,pinFields={}}) {
  assertDoubleOrderBlockPin(snapshot);
  const context=cloneDoubleOrderBlockContext(snapshot);
  for(const ob of [context.pair.firstOrderBlock,context.pair.secondOrderBlock]) {
    ob.obZoneId=await resolveObId(ob,context.pair);
    if(!Number.isSafeInteger(ob.obZoneId)||ob.obZoneId<=0)throw new Error('DOB-Pin konnte nicht gespeichert werden: Ein Orderblock wurde nicht aufgelöst.');
  }
  assertDoubleOrderBlockPin(context,true);
  const key=context.pair.id;
  // Ein erneuter Pin ändert wie die bestehenden Snapshot-Pins nur Notiz/Typ, niemals den Erstbefund.
  const inserted=await supabase.from('pin_context').upsert({kind:'double_order_block',dob_pin_key:key,dob_context:context,note:note||null,...pinFields},
    {onConflict:'dob_pin_key',ignoreDuplicates:true}).select(COLUMNS).maybeSingle();
  if(inserted.error)throw new Error(inserted.error.message);
  if(inserted.data)return inserted.data;
  const updated=await supabase.from('pin_context').update({note:note||null,...pinFields}).eq('dob_pin_key',key).select(COLUMNS).single();
  if(updated.error)throw new Error(updated.error.message);
  return updated.data;
}

// M5-OBs pflegt kein Watcher; ein DOB-Pin legt seine beiden ob_zones-Zeilen per Natural-Key an oder findet sie (MCP und dob-watcher).
/** @param {any} supabase @param {{instrument:string,direction:string,top:number,bottom:number,startTime:number}} ob */
export async function upsertM5ObZoneId(supabase,{instrument,direction,top,bottom,startTime}) {
  const {data,error}=await supabase.from('ob_zones').upsert({instrument,timeframe:'5M',direction,top,bottom,start_time:new Date(startTime*1000).toISOString()},
    {onConflict:'instrument,timeframe,start_time,direction'}).select('id').single();
  if(error)throw new Error(error.message);
  return data.id;
}
