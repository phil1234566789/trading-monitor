import fs from 'node:fs';
export async function prepareLivePinDb(db,events=[]) {
 await db.exec(`create table trade_setup_simulation_runs(id text primary key);
 create table setup2_alarm_events(id text primary key,kind text,stage int,instrument text,direction text,setup_key text,signal_at timestamptz,payload jsonb);
 create table pin_context(id bigserial primary key,kind text not null,note text,pin_type text,trade_position_id bigint,ob_zone_id bigint,trade_setup_id bigint,trade_confirmation_id bigint,liquidity_level_id bigint,m5_liquidity_instrument text,rsi_divergence_instrument text,
 constraint laniakea_context_kind_check check(kind='ob_zone' and ob_zone_id is not null));
 insert into trade_setup_simulation_runs values('old-run');`);
 await db.exec(fs.readFileSync('supabase/migrations/20261004140000_simulation_pin_context.sql','utf8'));
 await db.exec(`insert into pin_context(kind,simulation_run_id,simulation_entry_snapshot_id,simulation_variant,simulation_pin_key,simulation_context) values('simulation_entry','old-run','old-entry','both','old-key','{"old":true}');insert into pin_context(kind,ob_zone_id) values('ob_zone',1);`);
 const before=(await db.query('select * from pin_context order by id')).rows;
 await db.exec(fs.readFileSync('supabase/migrations/20261015090000_live_source_pins.sql','utf8'));
 for(const event of events)await db.query('insert into setup2_alarm_events values($1,$2,$3,$4,$5,$6,$7,$8)',[event.id,event.kind,event.stage,event.instrument,event.direction,event.setup_key,event.signal_at,event.payload]);
 return before;
}
