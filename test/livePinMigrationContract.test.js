import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20261015090000_live_source_pins.sql',import.meta.url),'utf8');
it('preserves existing nullable-run FK and old pin checks, adding only an original live-event source',()=>{
 expect(sql).toContain('add column live_event_id text references public.setup2_alarm_events(id)');expect(sql).toContain('((%s) and live_event_id is null)');expect(sql).toContain('$check$,old_rule');
 expect(sql).not.toMatch(/drop\s+constraint\s+.*simulation_run/i);expect(sql).not.toMatch(/update\s+(?:public\.)?pin_context\s+set/i);expect(sql).not.toMatch(/grant\s|disable row level security/i);
});
it('requires matching source, DR, exact entry/time/price and a named checkpoint for NULL-run pins',()=>{
 for(const field of ["simulation_run_id is null and live_event_id is not null","simulation-pin-context-v3","source'->>'eventId'","setupKey' is distinct from event.setup_key","entry'->>'entryId' is distinct from expected_snapshot","entry'->'time'->'unix'","entry'->'price'","checkpoint'->>'key'"])expect(sql).toContain(field);
 expect(sql).toContain('before insert or update on public.pin_context');
});
