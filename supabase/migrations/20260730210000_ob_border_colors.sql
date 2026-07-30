-- Order-Block-Umrandung eigenständig stylebar (Chat 2026-07-30, Philip: "diese Boxumrandung
-- stylebar machen") — vorher wurde die Umrandungsfarbe aus der Füllfarbe abgeleitet (fester
-- Alpha-Faktor im Code, siehe orderBlocks.js). Startwerte = genau dieses alte Verhältnis (Border
-- ≈ 2,3-2,5× Füll-Alpha), damit sich am Erscheinungsbild zunächst nichts ändert — siehe
-- src/chartColors.js für dieselben Werte im Frontend-Default.
insert into chart_colors (key, hex, alpha) values
  ('obBullM5Border', '#26a69a', 0.3),
  ('obBearM5Border', '#ef5350', 0.3),
  ('obInactiveM5Border', '#787b86', 0.16),
  ('obBull1hBorder', '#26a69a', 0.45),
  ('obBear1hBorder', '#ef5350', 0.45),
  ('obInactive1hBorder', '#787b86', 0.23),
  ('obBull4hBorder', '#26a69a', 0.75),
  ('obBear4hBorder', '#ef5350', 0.75),
  ('obInactive4hBorder', '#787b86', 0.37)
on conflict (key) do nothing;
