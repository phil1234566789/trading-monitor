-- Spread Hour soll fuer die Erkennung so behandelt werden, als gaebe es ihre Kerzen nicht (Philip
-- 2026-09-24). `danger` taugt dafuer nicht als Kriterium: Asia ist genauso 'forbidden', ihre
-- Liquiditaets-Level will er aber behalten. Deshalb ein eigenes Flag je Session.
alter table sessions add column if not exists ignore_liquidity boolean not null default false;
