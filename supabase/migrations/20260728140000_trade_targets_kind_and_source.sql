-- Chat 2026-07-28: Ziel-Klicks sollten die ganze LQ-Sweep-Entität mitnehmen, nicht nur den Preis
-- ("wieso steht bei mir unter zielen nur der Preis?") — und ein Target kann jetzt entweder ein
-- Pivot (LQ-Level, kann später zum LQ-Sweep werden) oder eine OB-Zone sein ("ein Pivot targetiere
-- ich oder einen OB"). source_time/touched_time erlauben, die Linie später wieder zu zeichnen
-- (siehe PriceChart.vue: refreshTradeTargetLinksInternal) und ihr Alter anzuzeigen — genau wie
-- ob_start_time das schon für die verlinkte Trade-Setup-OB tut.
--
-- Bestehende Zeilen (bisher nur aus LQ-Level-Klicks) bekommen kind='pivot' als Default; ohne
-- bekannte source_time bleiben sie ohne Linie/Alter im Chart — kein Zurückrechnen aus dem reinen
-- Preis möglich (anders als beim einmaligen OB-Bounds-Fix, wo die Zeit schon bekannt war).
alter table trade_targets
  add column kind text not null default 'pivot' check (kind in ('pivot', 'ob')),
  add column source_time timestamptz,
  add column touched_time timestamptz;
