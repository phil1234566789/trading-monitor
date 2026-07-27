-- Trennung These (Soll) vs. Ausführung (Ist) im Trade-Journal (Chat 2026-07-27: "die Trade-Idee
-- an sich ist in den meisten Fällen anders" als das, was tatsächlich ausgeführt wurde).
--
-- These-Ebene (wird gesetzt, sobald ein Trade-Setup laut Analyse valide wird):
--   setup_entry   — Preis, ab dem laut Idee ein Einstieg möglich ist
--   invalidation  — Preis, an dem sich die Idee als falsch erweist (NICHT zwangsläufig der
--                   tatsächliche stop_loss — der kann nachgezogen/anders gesetzt werden)
--   trade_targets — ein oder mehrere geplante Ziel-Level (typischerweise TP1/TP2/...)
--
-- Ausführungs-Ebene (bereits vorhanden: entry_price, stop_loss; neu dazu):
--   trade_partial_exits — tatsächliche Teilverkäufe (mehrfach möglich, je mit eigenem Preis/
--                         Zeitpunkt/Anteil der Position)
--   exit_price/exit_time (bereits vorhanden) — Schließung des Rests bzw. des ganzen Trades

alter table signals
  add column setup_entry numeric,
  add column invalidation numeric;

create table trade_targets (
  id bigint generated always as identity primary key,
  signal_id bigint not null references signals (id) on delete cascade,
  price numeric not null,
  created_at timestamptz not null default now()
);

create index trade_targets_signal_id_idx on trade_targets (signal_id);

alter table trade_targets enable row level security;

create policy "trade_targets read-only for anon"
  on trade_targets for select
  to anon
  using (true);

create table trade_partial_exits (
  id bigint generated always as identity primary key,
  signal_id bigint not null references signals (id) on delete cascade,
  price numeric not null,
  exit_time timestamptz not null,
  portion_pct numeric,
  created_at timestamptz not null default now()
);

create index trade_partial_exits_signal_id_idx on trade_partial_exits (signal_id);

alter table trade_partial_exits enable row level security;

create policy "trade_partial_exits read-only for anon"
  on trade_partial_exits for select
  to anon
  using (true);

-- take_profit war bisher EIN Feld für "geplantes Ziel" UND "tatsächlicher Ausstieg" in einem —
-- deckt sich jetzt mit trade_targets (These) bzw. exit_price/trade_partial_exits (Ausführung).
-- Bestehende Werte wandern nach trade_targets, bevor die Spalte verschwindet, damit keine
-- historischen Daten (Test-Trade vom 07-05, GBPUSD-Trade vom 07-27) verloren gehen.
insert into trade_targets (signal_id, price)
select id, take_profit from signals where take_profit is not null;

alter table signals drop column take_profit;
