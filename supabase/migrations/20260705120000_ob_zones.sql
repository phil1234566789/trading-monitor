-- D1: ob_zones — aktuell erkannte 4H-Orderblock-Zonen pro Instrument

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table ob_zones (
  id bigint generated always as identity primary key,
  instrument text not null,
  direction text not null check (direction in ('long', 'short')),
  top numeric not null,
  bottom numeric not null,
  weak boolean not null default false,
  touched boolean not null default false,
  invalidated boolean not null default false,
  start_time timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instrument, start_time, direction)
);

create index ob_zones_instrument_active_idx
  on ob_zones (instrument)
  where not invalidated;

create trigger ob_zones_set_updated_at
  before update on ob_zones
  for each row
  execute function set_updated_at();

alter table ob_zones enable row level security;

create policy "ob_zones read-only for anon"
  on ob_zones for select
  to anon
  using (true);
