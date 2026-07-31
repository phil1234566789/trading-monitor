-- Backfill für den einzigen bestehenden OB-Target mit rangeLow/rangeHigh (id 22, dealing_range 18)
-- — Zeitebene bereits bekannt aus der ob_zones-Zuordnung vom selben Bug-Report (1H, siehe
-- Migration 20260731170000). Die anderen beiden OB-Targets (17/18) und OB-Bestätigungen (10/11)
-- haben kein range_low/range_high (Alt-Daten vor jener Migration) und erreichen den Box-Zweig
-- in refreshTradeTargetLinksInternal/-ConfirmationLinksInternal gar nicht, brauchen also keine
-- timeframe.
update trade_targets set timeframe = '1H' where id = 22;
