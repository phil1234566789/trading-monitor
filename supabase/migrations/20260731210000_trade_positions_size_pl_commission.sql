-- Broker-Ausführungsdetails (Chat 2026-07-31: "wir brauchen noch size, Net P/L, Commission") —
-- bisher landeten die bei per MCP eingetragenen Trades zweckentfremdet im reasoning-Freitext
-- (Lana pastete "Menge 0,5, Netto P/L $27.00" dort rein, siehe z.B. trade_positions 18-20). Jetzt
-- eigene Spalten, damit reasoning wieder nur die eigentliche Begründung enthält.
--
-- size bewusst als einzelnes numerisches Feld ohne Einheiten-Spalte — aktuell immer Forex-Lots
-- (0.01-1+), aber laut Philip könnten später Gold/Crypto mit anderer Größenlogik dazukommen; eine
-- Einheiten-Unterscheidung wird erst nachgerüstet, wenn das tatsächlich ansteht, keine
-- vorweggenommene Spekulation.
-- commission bewusst OHNE Vorzeichen-Constraint — i.d.R. negativ (Gebühr), aber Philip selbst ist
-- sich unsicher, ob es bei Krypto-Perpetuals (Maker-Rebates?) auch mal positiv sein kann.
alter table trade_positions
  add column size numeric,
  add column net_pl numeric,
  add column commission numeric;
