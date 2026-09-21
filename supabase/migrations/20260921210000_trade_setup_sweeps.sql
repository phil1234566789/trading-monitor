-- Alle Level, die ein Trade-Setup abgeräumt hat — nicht nur das entscheidende.
--
-- Philip 21.09.2026: "Je mehr Bestätigungs-LQ-Sweeps desto besser." collectObSweeps
-- (_shared/tradeSetup.ts) sammelt sie längst, warf aber alle bis auf den ältesten weg, weil
-- trade_setups genau EIN Level in vier Spalten führt.
--
-- Gemessen vor dem Schema-Entwurf (backfillTradeSetups.ts im Trockenlauf, GBPUSD Januar-September
-- 2026, 1325 Setups): 1 Sweep 747x, 2x 326, 3x 159, 4x 50, 5x 30, 6x 12, 9x 1 — 44 % haben mehr
-- als einen. Der Fall ist damit der Normalfall und keine Randnotiz; eine Anzahl-Spalte in
-- trade_setups hätte genau die Preise weggeworfen, die Anzeige und Auswertung brauchen.
--
-- trade_setups.ls_* bleiben unangetastet: sie tragen den ENTSCHEIDENDEN Sweep (Philip: "ältester
-- Sweep ist der für die Strategie am entscheidendsten"), jeder Verbraucher liest sie, und die
-- Auswertung in analysis/dr-reichweite/ hängt daran. Derselbe Sweep steht hier zusätzlich als
-- Zeile mit is_primary = true — "alle Sweeps dieses Setups" bleibt damit EINE Abfrage statt einer
-- Mischung aus vier Spalten plus Kindtabelle.
create table trade_setup_sweeps (
  trade_setup_id bigint not null references trade_setups(id) on delete cascade,
  timeframe text not null check (timeframe in ('1H', '5M')),
  -- Pivot-Zeitpunkt identifiziert das Level: zwei Level derselben Zeitebene können ihn sich nicht
  -- teilen, weil ein Setup nur EINE Seite sammelt (Highs bei Short, Lows bei Long).
  pivot_time timestamptz not null,
  price numeric not null,
  touched_time timestamptz not null,
  -- Der in trade_setups.ls_* gespiegelte Sweep. Als Spalte und nicht abgeleitet, weil "der älteste"
  -- über businessSecondsBetween geht (Handelsstunden, kein reiner Zeitabstand) — das kann SQL nicht
  -- nachrechnen, die Erkennung weiß es dagegen ohnehin.
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (trade_setup_id, timeframe, pivot_time)
);

alter table trade_setup_sweeps enable row level security;

-- Dasselbe permissive Single-User-Modell wie trade_setups (siehe
-- 20260831140000_trade_setups_anon_insert_update.sql). Insert UND Update, weil beide Schreiber
-- upserten.
create policy "trade_setup_sweeps read-only for anon"
  on trade_setup_sweeps for select
  to anon
  using (true);

create policy "trade_setup_sweeps insert for anon"
  on trade_setup_sweeps for insert
  to anon
  with check (true);

create policy "trade_setup_sweeps anon update"
  on trade_setup_sweeps for update
  to anon
  using (true)
  with check (true);
