-- Bestätigungen (Chat 2026-07-28, PLAN-trade-confluences.md #1: "von welchen Sweeps kam die
-- Kraft für die Long/Short-Bewegung? ... auch OBs, Kraft-/Trendwende-Zonen") — gleicher
-- Interaktions-Mechanismus wie trade_targets (Trade-Modus, Pivot-Linie oder OB-Zone anklicken),
-- aber eigene Tabelle: ein Target ist eine ZUKÜNFTIGE Preis-Erwartung, eine Bestätigung ist
-- BEREITS PASSIERTE Evidenz, die den Trade begründet — unterschiedliche Lebenszyklen, deshalb
-- nicht in trade_targets mit einem zusätzlichen Discriminator vermischt.
-- kind='pivot' meint hier einen bereits geschehenen Sweep (siehe tradeConfirmations.ts:
-- KIND_LABEL, zeigt "Sweep" statt "Pivot" an) — derselbe Rohwert wie bei trade_targets, nur
-- anders beschriftet, damit beide Seiten dieselbe TradeTargetKind-artige Klick-Infrastruktur
-- (PriceChart.vue: findClickedTarget) teilen können.
create table trade_confirmations (
  id bigint generated always as identity primary key,
  signal_id bigint not null references signals (id) on delete cascade,
  kind text not null check (kind in ('pivot', 'ob')),
  price numeric not null,
  source_time timestamptz,
  touched_time timestamptz,
  created_at timestamptz not null default now()
);

create index trade_confirmations_signal_id_idx on trade_confirmations (signal_id);

alter table trade_confirmations enable row level security;

-- Alle drei Policies gleich mit angelegt (anders als bei trade_targets, wo INSERT/DELETE erst in
-- späteren Migrationen nachkamen) — der Bedarf für alle drei ist von Anfang an klar.
create policy "trade_confirmations read-only for anon"
  on trade_confirmations for select
  to anon
  using (true);

create policy "trade_confirmations anon insert"
  on trade_confirmations for insert
  to anon
  with check (true);

create policy "trade_confirmations anon delete"
  on trade_confirmations for delete
  to anon
  using (true);
