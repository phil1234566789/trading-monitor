-- Herkunft des sweependen Liquidity-Levels je Trade-Setup festhalten: "1H" oder "5M".
--
-- Bisher stand nirgends, aus welchem der beiden Level-Arrays (h1HighsSetup/h1LowsSetup vs.
-- m5Highs/m5Lows in poi-watcher/index.ts) der Sweep kam. Die Auswertung vom 19.09.2026
-- (analysis/dr-reichweite/) musste das nachträglich aus liquidity_levels rekonstruieren und
-- kam nur auf eine Untergrenze -- die Tabelle führt zwar ausschließlich 1H/4H-Level, ältere
-- Zeilen fehlen dort aber (6 Juli-Fälle nachweislich nicht mehr auffindbar).
--
-- Der Unterschied ist das stärkste Einzelmerkmal der Setup-Qualität, das wir gemessen haben:
-- 1H-Sweep Reichweiten-Median 28,7 Pips gegen 11,3 bei M5. Ab jetzt wird es beim Erkennen
-- geschrieben (findBestLsMatch gibt das Array-Element selbst zurück, die Zuordnung ist damit
-- exakt statt geschätzt).
--
-- Nullable und ohne Default: Altbestand bleibt NULL = "Herkunft unbekannt". Ein Backfill wäre
-- nur wieder die Näherung von oben, deshalb bewusst keiner.
alter table trade_setups add column if not exists ls_timeframe text;

comment on column trade_setups.ls_timeframe is
  'Timeframe des sweependen Liquidity-Levels: 1H oder 5M. NULL bei Zeilen vor dem 19.09.2026.';
