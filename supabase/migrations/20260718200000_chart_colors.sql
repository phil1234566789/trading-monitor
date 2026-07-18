-- Chart-Indikator-Farben (Style-Modal, siehe src/chartColors.js) — geräteübergreifend synchron
-- statt nur pro Browser in localStorage (siehe Chat: "hab mehrere Geräte"). localStorage bleibt
-- zusätzlich als Instant-Cache für den ersten Render, bevor die DB-Antwort da ist; die DB gewinnt
-- bei Abweichung (letztes Gerät, das etwas geändert hat).
--
-- Schreibzugriff für anon (wie alarm_settings), weil das Dashboard direkt aus dem Browser
-- speichert — unkritisch, reine Darstellungs-Präferenz ohne sensible Daten.
create table chart_colors (
  key text primary key,
  hex text not null,
  alpha double precision not null default 1,
  updated_at timestamptz not null default now()
);

create trigger chart_colors_set_updated_at
  before update on chart_colors
  for each row
  execute function set_updated_at();

insert into chart_colors (key, hex, alpha) values
  ('candleUp', '#26a69a', 1),
  ('candleDown', '#ef5350', 1),
  ('cvdLine', '#f0b90b', 1),
  ('emaFast', '#42a5f5', 1),
  ('emaSlow', '#ffb74d', 1),
  ('liquidityHigh', '#00e676', 0.9),
  ('liquidityLow', '#ff9800', 0.9),
  ('liquiditySweep', '#ffd700', 0.9),
  ('obBull', '#26a69a', 0.28),
  ('obBear', '#ef5350', 0.28),
  ('obInactive', '#787b86', 0.15),
  ('tradeSetupShort', '#ffd700', 0.9),
  ('tradeSetupLong', '#2196f3', 0.9),
  ('tradeSetupProtected', '#ffffff', 0.95),
  ('zigzagStructure', '#ef5350', 0.9),
  ('zigzagTail', '#787b86', 0.9),
  ('rangeHigh', '#ef5350', 0.95),
  ('rangeLow', '#00e676', 0.95),
  ('rangeProtectedLow', '#ffffff', 0.95),
  ('rangesMarker', '#00bcd4', 0.9),
  ('tradeWin', '#26a69a', 1),
  ('tradeLoss', '#ef5350', 1),
  ('tradeOpen', '#f0b90b', 1),
  ('tradeInvalid', '#787b86', 1),
  ('tradeConnector', '#2962ff', 0.75);

alter table chart_colors enable row level security;

create policy "chart_colors read for anon"
  on chart_colors for select
  to anon
  using (true);

create policy "chart_colors insert for anon"
  on chart_colors for insert
  to anon
  with check (true);

create policy "chart_colors update for anon"
  on chart_colors for update
  to anon
  using (true)
  with check (true);
