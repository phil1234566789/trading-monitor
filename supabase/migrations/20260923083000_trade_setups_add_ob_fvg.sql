-- Groesse der bestaetigenden FVG je Trade-Setup, in Preiseinheiten (nicht Pips).
--
-- Gemessen am 23.09.2026 ueber 3282 GBPUSD-Dealing-Ranges (analysis/dr-reichweite/README.md,
-- Abschnitt "FVG-Groesse"): das Merkmal trennt staerker als Sweep-Herkunft und Sweep-Alter --
-- 47 % Trefferquote bei 3R unter einem Pip gegen 91 % ueber acht Pips, und es haelt in R, ist also
-- nicht bloss Volatilitaet. Bis dahin rechnete detectOrderBlocks die Luecke aus und warf sie weg.
--
-- Bewusst nur MARKIEREN, nicht filtern: der Verlauf hat keine Kante, an der sich eine Schwelle
-- begruenden liesse, und das schwaechste Band ist mit 29,6 % zugleich das groesste. Ein
-- Unterdrueckungs-Filter in poi-watcher wuerde also knapp ein Drittel aller Alarme unsichtbar
-- machen, ohne dass man hinterher pruefen koennte, ob sie gelaufen waeren.
--
-- NULL-bar, weil die Altzeilen erst per scripts/backfillObFvg.ts gefuellt werden und eine Zeile
-- ohne passende Archiv-Kerze dort bewusst leer bleibt, statt eine geratene Zahl zu bekommen.
alter table trade_setups add column if not exists ob_fvg double precision;

comment on column trade_setups.ob_fvg is
  'Groesse der bestaetigenden FVG in Preiseinheiten (ob_bottom - high(C2+1) bei short, '
  'low(C2+1) - ob_top bei long). NULL = noch nicht rueckgerechnet.';
