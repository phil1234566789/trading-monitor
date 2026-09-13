-- Dritter, fall-unabhaengiger Watch-Kanal fuer die State Machine: die naechsten ungetouchten
-- 1H/4H-Liquiditaets-Level ueber und unter dem Preis.
--
-- Grund (GBPUSD-Backtest 09.09.2026): docs/attention-levels.md kennt bisher zwei EXKLUSIVE Modi —
-- Fall 3 schaut auf 1H/4H, Fall 1/2 auf M5. Sobald eine Reaktion gefunden ist, laeuft die Maschine
-- dauerhaft im M5-Pfad und sieht HTF-Level gar nicht mehr. Am 09.09. war ab dem ersten Tick um
-- 09:00 durchgehend hasReaction=true; das 4H-Level 1.35652 konnte deshalb nie Watch-Level werden,
-- obwohl der Kurs direkt darauf zulief und es um 09:10 ueberschritt. Inducements sind laut
-- liquidität.md per Definition 1H/4H-Sweeps — man braucht sie also genau dann, wenn eine Dealing
-- Range in Arbeit ist.
--
-- Bewusst getrennte Spalten statt einer Erweiterung von watch_level_above/below: die M5-Level
-- bleiben unveraendert der Aufmerksamkeits-Kanal fuer Fall 1/2, dieser hier laeuft additiv daneben
-- (gleiches Muster wie der "neuer M5-OB"-Trigger vom 10.09.2026).
alter table trading_loop_state
  add column if not exists htf_watch_level_above jsonb,
  add column if not exists htf_watch_level_below jsonb;

comment on column trading_loop_state.htf_watch_level_above is
  'Naechstes ungetouchtes 1H/4H-Liquiditaets-Level ueber dem Preis (LoopLevel-JSON). Fall-unabhaengig, additiv zu watch_level_above.';
comment on column trading_loop_state.htf_watch_level_below is
  'Naechstes ungetouchtes 1H/4H-Liquiditaets-Level unter dem Preis (LoopLevel-JSON). Fall-unabhaengig, additiv zu watch_level_below.';
