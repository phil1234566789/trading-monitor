-- Bestandene TS1.1-Quelle je Urteil (LS des DOB-LQ-Sweep-POI statt der Primär-LS der trade_setups-Zeile).
-- {} = bestanden ohne eigene Quelle, null = nicht bestanden oder Urteil von vor dieser Spalte (dob-watcher rechnet es neu).
alter table public.trade_setup_ts11_verdicts add column if not exists witness jsonb;
