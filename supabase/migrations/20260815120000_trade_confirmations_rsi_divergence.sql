-- milk-city Task "Divergenzen zur Dealing Range verknüpfen (klickbar)" (2026-08-15): vierte
-- Bestätigungs-Art neben 'pivot'/'ob'/'fib' — eine im Chart erkannte RSI-Divergenz (src/rsi.js:
-- detectRsiDivergence/-History) soll wie Sweep/OB/Fib per Klick im Bestätigungs-Modus zu einer
-- dealing_range oder trade_position hinzufügbar sein. Divergenzen werden (wie schon bei
-- laniakea_context_rsi_divergence.sql, gleicher Präzedenzfall) NIE aus Kerzen live nachvollzogen
-- persistiert, sondern als Rohdaten-Snapshot der beiden Bein-Endpunkte übernommen: price bleibt
-- der Endpunkt-Preis (toPrice, wie 'ob' den nahen Zonen-Rand als price führt), source_time/
-- touched_time werden mit fromTime/toTime belegt (ergibt denselben Zeit-Spannen-Effekt wie bei
-- einem Pivot, dessen Linie von der Entstehung bis zum späteren Touch läuft — hier: von der
-- Referenz- bis zur geprüften Divergenz-Schwungmarke). from_price/from_rsi/to_rsi und
-- divergence_type sind eigene Spalten (analog zu range_low/range_high bei 'fib'), sonst wäre die
-- Divergenz später nicht mehr aus den gespeicherten Werten nachvollziehbar/zeichenbar.
alter table trade_confirmations drop constraint trade_confirmations_kind_check;
alter table trade_confirmations add constraint trade_confirmations_kind_check check (kind in ('pivot', 'ob', 'fib', 'rsi_divergence'));

alter table trade_confirmations
  add column divergence_type text check (divergence_type in ('bearish', 'bullish')),
  add column from_price numeric,
  add column from_rsi numeric,
  add column to_rsi numeric;
