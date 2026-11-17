-- v3 Gegen-DOB als Konfig statt Lauf (Philip: TP-Regeln sind Konfig): Status je Trade im Lauf, Modus je Instrument.
-- none = kein Gegen-DOB seit Quellen-Retest, dead = nur tote, live = mind. ein lebender; null = Lauf ohne Gegen-DOB-Gate.
alter table public.dob_trade_setups add column if not exists counter_dob_status text
  check (counter_dob_status in ('none', 'dead', 'live'));
-- block_all = jeder sperrt (Default), live_block_dead_5r = lebende sperren, nur tote TP 5R, off = ignorieren.
alter table public.dob_guardrails add column if not exists counter_dob_mode text not null default 'block_all'
  check (counter_dob_mode in ('block_all', 'live_block_dead_5r', 'off'));
