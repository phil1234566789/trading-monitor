-- Trade-Setup-Winrate: pro trade_setups-Zeile die berechnete Entry/SL/TP-Geometrie + Kriterien-
-- Rohwerte + das aufgelöste Ergebnis (win/loss/pending), siehe milk-city-Task
-- trade-setup-winrate-outcome-tracking-kriterien-filter. Win-Definition (Philip 2026-09-05): 2,5 RR
-- erreicht, SL max. 6 Pips (auch wenn die strukturelle Invalidierung weiter weg liegt) — sl_pips ist
-- deshalb min(strukturelle Distanz, 6), nicht die rohe OB-Höhe. Kriterien als Rohwerte
-- (within_trading_hours/sweep_age_hours) statt fertiger Kombinationen, damit neue Schwellwerte per
-- WHERE zur Abfragezeit greifen, ohne das Schema pro Kombination zu erweitern — künftige Kriterien
-- (EMA/RSI/Sweep-Anzahl, ...) kommen später als weitere Spalten dazu.
create table trade_setup_outcomes (
  trade_setup_id bigint primary key references trade_setups (id) on delete cascade,
  instrument text not null,
  direction text not null check (direction in ('short', 'long')),
  entry_price numeric not null,
  invalidation_price numeric not null,
  sl_price numeric not null,
  tp_price numeric not null,
  sl_pips numeric not null,
  within_trading_hours boolean not null,
  sweep_age_hours numeric not null,
  outcome text not null default 'pending' check (outcome in ('win', 'loss', 'pending')),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trade_setup_outcomes_set_updated_at
  before update on trade_setup_outcomes
  for each row
  execute function set_updated_at();

-- Winrate-Abfragen filtern fast immer zuerst auf outcome (nur win/loss zählen, pending raus).
create index trade_setup_outcomes_outcome_idx on trade_setup_outcomes (outcome);

alter table trade_setup_outcomes enable row level security;

create policy "trade_setup_outcomes read for anon"
  on trade_setup_outcomes for select
  to anon
  using (true);

-- Gleiches permissives Single-User-Modell wie trade_setups (20260831140000_trade_setups_anon_insert_update.sql)
-- — das Backfill-Script läuft mit dem Anon-Key (Konvention aus rsiDivergenceStats.ts), poi-watcher
-- selbst nutzt service_role und ist von RLS ohnehin nicht betroffen.
create policy "trade_setup_outcomes insert for anon"
  on trade_setup_outcomes for insert
  to anon
  with check (true);

create policy "trade_setup_outcomes anon update"
  on trade_setup_outcomes for update
  to anon
  using (true)
  with check (true);
