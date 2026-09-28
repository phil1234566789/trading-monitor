-- Getrennte Forschungsstichprobe: weder Journalausführung noch endgültiges Checklist-Go.
create table public.checklist_target_observations (
  candidate_id text not null,
  rule_version text not null,
  config_key text not null check (config_key ~ '^[0-9a-f]{64}$'),
  instrument text not null check (instrument in ('GBPUSD', 'EURUSD', 'XAUUSD')),
  configuration jsonb not null,
  selected_at bigint not null,
  selection jsonb not null,
  invalidation double precision not null,
  source jsonb not null,
  evaluated_at bigint not null check (evaluated_at >= selected_at),
  observation jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (rule_version, config_key, candidate_id),
  check (selection->>'status' = 'passed' and selection->'target1'->>'price' is not null),
  check ((selection->>'selectedAt')::bigint = selected_at),
  check ((observation->>'evaluatedAt')::bigint = evaluated_at),
  check (observation->'target2'->>'status' in ('open','reached','notReached','unknown','notApplicable'))
);
alter table public.checklist_target_observations enable row level security;
create policy checklist_target_observations_read on public.checklist_target_observations for select to anon, authenticated using (true);
grant select on public.checklist_target_observations to anon, authenticated;

-- Nur dieser Schreibweg: ältere Replay-Antworten dürfen neuere Beobachtungen nicht ersetzen.
-- Fehlende spätere Historie darf ein bereits belegtes Ergebnis ebenfalls nicht löschen.
create function public.save_checklist_target_observations(observations jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare item jsonb;
begin
  if jsonb_typeof(observations) <> 'array' or jsonb_array_length(observations) > 100 then
    raise exception 'Expected at most 100 observations';
  end if;
  for item in select value from jsonb_array_elements(observations) loop
    insert into public.checklist_target_observations as existing
      (candidate_id, rule_version, config_key, instrument, configuration, selected_at, selection, invalidation, source, evaluated_at, observation)
    values (item->>'candidate_id', item->>'rule_version', item->>'config_key', item->>'instrument', item->'configuration',
      (item->>'selected_at')::bigint, item->'selection', (item->>'invalidation')::double precision, item->'source',
      (item->>'evaluated_at')::bigint, item->'observation')
    on conflict (rule_version, config_key, candidate_id) do update
      set evaluated_at = excluded.evaluated_at, observation = excluded.observation, updated_at = now()
      where excluded.evaluated_at >= existing.evaluated_at
        and excluded.selection = existing.selection and excluded.invalidation = existing.invalidation
        and not coalesce(excluded.observation->'target2'->>'reason' = 'missingHistory'
          and (existing.observation->'target2'->>'status' in ('reached','notReached')
            or existing.observation->'target2'->>'reason' = 'sameCandle'), false)
        and not coalesce(excluded.observation->'main'->>'reason' = 'missingHistory'
          and existing.observation->'main'->>'state' = 'ended', false);
  end loop;
end;
$$;
revoke all on function public.save_checklist_target_observations(jsonb) from public;
grant execute on function public.save_checklist_target_observations(jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
