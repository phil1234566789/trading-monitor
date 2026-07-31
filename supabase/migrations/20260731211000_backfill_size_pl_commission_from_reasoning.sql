-- Backfill der 15 bereits per MCP eingetragenen Trades, deren size/net_pl/commission bisher im
-- reasoning-Freitext standen (Chat 2026-07-31) — Werte manuell aus dem jeweiligen reasoning-Text
-- geparst (explizite id-Zeilen statt einer generischen Regex, um bei Geld-/Positionsgrößen nichts
-- dem Zufall zu überlassen). reasoning wird auf den tatsächlichen Begründungstext gekürzt, oder
-- null, wo nur die Zahlen drinstanden.

update trade_positions set size = 0.5, net_pl = -13.50,
  reasoning = 'Versehen: wollte GBPUSD öffnen, war auf EURUSD eingestellt, sofort mit Verlust geschlossen.'
  where id = 17;
update trade_positions set size = 0.5, net_pl = 1.00, reasoning = null where id = 18;
update trade_positions set size = 0.2, net_pl = 23.40, reasoning = null where id = 19;
update trade_positions set size = 0.2, net_pl = 27.00, reasoning = null where id = 20;
update trade_positions set size = 0.10, net_pl = -28.40, commission = -0.50,
  reasoning = 'Dummer Short gegen eine von der Strategie bestätigte Long-Dealing-Range.'
  where id = 24;
update trade_positions set size = 0.20, net_pl = -13.80, commission = -1.00,
  reasoning = 'Nachtrag/Re-Entry auf denselben (falschen) Short trotz laufendem Verlust.'
  where id = 25;
update trade_positions set size = 0.20, net_pl = -1.40, commission = -1.00,
  reasoning = 'Short-Korrektur-Idee EURUSD, mehrere Re-Entries nach wiederholten Stop-outs.'
  where id = 27;
update trade_positions set size = 0.20, net_pl = -14.40, commission = -1.00, reasoning = null where id = 28;
update trade_positions set size = 0.03, net_pl = -1.95, commission = -0.15, reasoning = null where id = 29;
update trade_positions set size = 0.30, net_pl = -14.10, commission = -1.50, reasoning = null where id = 30;
update trade_positions set size = 0.20, net_pl = 0.20, commission = -1.00, reasoning = null where id = 31;
update trade_positions set size = 0.01, net_pl = 1.55, commission = -0.05, reasoning = null where id = 32;
update trade_positions set size = 0.10, net_pl = 15.00, commission = -0.50, reasoning = null where id = 33;
update trade_positions set size = 0.01, net_pl = 1.18, commission = -0.05, reasoning = null where id = 34;
update trade_positions set size = 0.10, net_pl = 13.00, commission = -0.50, reasoning = null where id = 35;
