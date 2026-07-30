-- Order-Block-Farben/Linienstärken nach Timeframe aufgeteilt (Chat 2026-07-30, Bug-Report Philip:
-- "die ganzen OBs lassen sich schwierig unterscheiden") — obBull/obBear/obInactive galten bisher
-- für M5/1H/4H gleichermaßen (nur 1H bekam einen fest verdrahteten Dimm-Faktor im Code, siehe
-- orderBlocks.js), jetzt hat jeder Timeframe seine eigenen, über Chart-Style frei einstellbaren
-- drei Farben (Bullish/Bearish/Inaktiv). Defaults gestuft (4H am kräftigsten, M5 am dezentesten,
-- weil davon "ganz viele" gleichzeitig sichtbar sind) — siehe src/chartColors.js für dieselben
-- Werte im Frontend-Default (falls diese Migration nie lief, z.B. frisches Gerät ohne DB-Zeilen).
delete from chart_colors where key in ('obBull', 'obBear', 'obInactive');
delete from chart_line_widths where key in ('obBull', 'obBear', 'obInactive');

insert into chart_colors (key, hex, alpha) values
  ('obBullM5', '#26a69a', 0.12),
  ('obBearM5', '#ef5350', 0.12),
  ('obInactiveM5', '#787b86', 0.07),
  ('obBull1h', '#26a69a', 0.18),
  ('obBear1h', '#ef5350', 0.18),
  ('obInactive1h', '#787b86', 0.1),
  ('obBull4h', '#26a69a', 0.3),
  ('obBear4h', '#ef5350', 0.3),
  ('obInactive4h', '#787b86', 0.16)
on conflict (key) do nothing;

insert into chart_line_widths (key, width) values
  ('obBullM5', 1),
  ('obBearM5', 1),
  ('obInactiveM5', 1),
  ('obBull1h', 1),
  ('obBear1h', 1),
  ('obInactive1h', 1),
  ('obBull4h', 1),
  ('obBear4h', 1),
  ('obInactive4h', 1)
on conflict (key) do nothing;
