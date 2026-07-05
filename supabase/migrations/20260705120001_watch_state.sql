-- D1: watch_state — Beobachtungsmodus pro Instrument (idle / watching_m1)

create table watch_state (
  instrument text primary key,
  mode text not null default 'idle' check (mode in ('idle', 'watching_m1')),
  active_zone_id bigint references ob_zones (id),
  last_contact_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger watch_state_set_updated_at
  before update on watch_state
  for each row
  execute function set_updated_at();

alter table watch_state enable row level security;

create policy "watch_state read-only for anon"
  on watch_state for select
  to anon
  using (true);
