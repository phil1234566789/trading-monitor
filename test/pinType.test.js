import {describe,it,expect,vi,beforeEach} from 'vitest';
import {pinTypeFields,pinTypeLabel} from '../src/pinType.js';
import {pinTypeFields as serverFields} from '../supabase/functions/trading-monitor-mcp/pinType.ts';
const db=vi.hoisted(()=>({row:null,writes:[]}));
vi.mock('../src/supabaseClient.js',()=>({supabase:{from:()=>{
  let mode='read',payload;
  const query={select:()=>query,eq:()=>query,order:()=>query,in:()=>query,
    range:async from=>({data:from===0&&db.row?[db.row]:[],error:null}),
    upsert:value=>{mode='upsert';payload=value;return query;},
    update:value=>{mode='update';payload=value;return query;},
    maybeSingle:async()=>({data:db.row?{id:db.row.id}:null,error:null}),
    single:async()=>{db.writes.push(payload);db.row={...db.row,...payload,id:db.row?.id??1};return {data:db.row,error:null};},
    then:resolve=>{if(mode!=='read'){db.writes.push(payload);db.row={...db.row,...payload,id:db.row?.id??1};}return Promise.resolve({error:null}).then(resolve);}};
  return query;
}}}));
vi.mock('../src/tradeIntake.js',()=>({findOrCreateObZoneId:vi.fn(async()=>7),findOrCreateTradeSetupId:vi.fn(async()=>8)}));
import {addPinEntry,addPinM5ObEntry,addPinM5LiquidityEntry,addPinRsiDivergenceEntry,addPinTscSetupEntry,addSimulationPin,updatePinNote,fetchSimulationPins} from '../src/pinContext.js';
beforeEach(()=>{db.row=null;db.writes=[];});
describe('pin classification persistence',()=>{
  it('accepts both explicit types and null, and leaves omitted types untouched in both runtimes',()=>{
    for(const fields of [pinTypeFields,serverFields]) {
      expect(fields(undefined)).toEqual({});expect(fields(null)).toEqual({pin_type:null});
      for(const type of ['observation','bug'])expect(fields(type)).toEqual({pin_type:type});
      expect(()=>fields('improvement')).toThrow('Pin-Typ');
    }
    expect(pinTypeLabel(null)).toBe('Typ fehlt');expect(pinTypeLabel('observation')).toBe('Beobachtung');
  });
  it('changes only requested metadata and keeps the original snapshot through reload',async()=>{
    const context={entry:{price:1.3},runId:'old'};
    db.row={id:7,kind:'simulation_entry',pin_type:'observation',note:'Original',simulation_context:context};
    await updatePinNote(7,'Neuer Kommentar');expect(db.row.pin_type).toBe('observation');
    await updatePinNote(7,undefined,'bug');expect(db.row.note).toBe('Neuer Kommentar');
    const loaded=await fetchSimulationPins();expect(loaded[0]).toMatchObject({id:7,pinType:'bug',note:'Neuer Kommentar',simulationContext:context});
    expect(db.writes).toEqual([{note:'Neuer Kommentar'},{pin_type:'bug'}]);
    await expect(updatePinNote(7,'Verloren','invalid')).rejects.toThrow();expect(db.row.note).toBe('Neuer Kommentar');
    db.row.pin_type=null;expect((await fetchSimulationPins())[0].pinType).toBeNull();
  });
  it('stores classification for every supported create path without replacing existing types on comment-only calls',async()=>{
    const creators=[type=>addPinEntry('trade_position',9,'Text',type),type=>addPinEntry('trade_confirmation',9,'Text',type),
      type=>addPinEntry('ob_zone',9,'Text',type),type=>addPinEntry('trade_setup',9,'Text',type),type=>addPinEntry('liquidity_level',9,'Text',type),
      type=>addPinM5ObEntry({instrument:'GBPUSD',dirNum:1,top:1.3,bottom:1.2,startTime:100},'Text',type),
      type=>addPinTscSetupEntry({instrument:'GBPUSD',direction:'long',setup:{}},'Text',type),
      type=>addPinM5LiquidityEntry({instrument:'GBPUSD',dirNum:1,pivotTime:100},'Text',type),
      type=>addPinRsiDivergenceEntry('GBPUSD',{type:'bearish',fromTime:100,toTime:200},'Text',type),
      type=>addSimulationPin({kind:'simulation_dr',key:'key',snapshotId:'s',context:{runId:'new'}},'Text',type)];
    for(const create of creators) {
      db.row=null;await create('observation');expect(db.row.pin_type).toBe('observation');
      await create(undefined);expect(db.row.pin_type).toBe('observation');
      await create('bug');expect(db.row.pin_type).toBe('bug');
    }
  });
});
