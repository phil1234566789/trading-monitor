-- Test-Trade-Entry auf 10:00 Uhr lokal (08:00 UTC) verschoben. Neuer Entry-Preis =
-- Open der 08:00-UTC-Kerze (63021.1). SL/TP unveraendert; R-Multiple neu berechnet
-- (Risiko 398.9, Reward 427.1 -> ca. +1.07R). TP-Treffer (09:39 UTC) bleibt unveraendert
-- gueltig, da er nach dem neuen Entry liegt und SL (63420) im gesamten Zeitraum nie
-- beruehrt wurde (Hoch max. 63105.6 waehrend der Entry-Stunde).

update signals
set entry_price = 63021.1,
    triggered_at = '2026-07-05T08:00:00Z',
    r_multiple = 1.07
where instrument = 'BTC-USDT'
  and source = 'paper'
  and exit_time = '2026-07-05T09:39:00Z';
