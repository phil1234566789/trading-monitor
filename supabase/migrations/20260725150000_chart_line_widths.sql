-- Chart-Indikator-Linienstärken (Style-Modal, siehe src/chartLineWidths.js) — geräteübergreifend
-- synchron, analog zu chart_colors (20260718200000_chart_colors.sql). Eigene Tabelle statt neue
-- Spalte in chart_colors, weil Linienstärke ein reiner Zahlenwert ohne Hex/Alpha ist.
--
-- EIN Wert PRO FARB-KEY aus chart_colors (Chat 2026-07-25, zweite Runde: "bei jeder Linie, wo man
-- schon die Farbe individuell anpassen kann"), nicht gebündelt pro Zeichenkonzept — dieselben Keys
-- wie chart_colors, außer candleUp/candleDown (Kerzenkörper) und rangesMarker/rangesMarker2 (reine
-- Punkt-Marker, kein Stroke).
create table chart_line_widths (
  key text primary key,
  width double precision not null default 1,
  updated_at timestamptz not null default now()
);

create trigger chart_line_widths_set_updated_at
  before update on chart_line_widths
  for each row
  execute function set_updated_at();

insert into chart_line_widths (key, width) values
  ('cvdLine', 2),
  ('emaFast', 2),
  ('emaSlow', 2),
  ('liquidityHigh', 1),
  ('liquidityLow', 1),
  ('liquiditySweep', 1),
  ('obBull', 1),
  ('obBear', 1),
  ('obInactive', 1),
  ('tradeSetupShort', 2),
  ('tradeSetupLong', 2),
  ('tradeSetupProtected', 2),
  ('rangeHigh', 2),
  ('rangeLow', 2),
  ('rangeProtectedLow', 2),
  ('rangeLqSweep', 1),
  ('rangeBreakOfStructure', 2),
  ('rangeClosed', 2),
  ('rangeChoch', 1),
  ('tradeWin', 1.5),
  ('tradeLoss', 1.5),
  ('tradeOpen', 1.5),
  ('tradeInvalid', 1.5),
  ('tradeConnector', 2);

alter table chart_line_widths enable row level security;

create policy "chart_line_widths read for anon"
  on chart_line_widths for select
  to anon
  using (true);

create policy "chart_line_widths insert for anon"
  on chart_line_widths for insert
  to anon
  with check (true);

create policy "chart_line_widths update for anon"
  on chart_line_widths for update
  to anon
  using (true)
  with check (true);
