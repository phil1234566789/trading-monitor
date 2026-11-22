-- TSC-Rollen nehmen jedes Registry-Chartobjekt auf (src/chartObjectRegistry.js), gleiche Spalten wie pin_context
-- (20261121130000). Rein additiv: bestehende Zeilen, FK-Arten und ihre Regeln bleiben unverändert; kind='chart_object'
-- ist ein zusätzlicher Wert, price bleibt Pflicht (kommt aus def.line(snapshot).price).
alter table public.trade_evidence
 add column chart_object_type text,
 add column chart_object_key text,
 add column chart_object_instrument text,
 add column chart_object_timeframe text,
 add column chart_object_snapshot jsonb;

alter table public.trade_targets
 add column chart_object_type text,
 add column chart_object_key text,
 add column chart_object_instrument text,
 add column chart_object_timeframe text,
 add column chart_object_snapshot jsonb;

alter table public.dealing_ranges
 add column invalidation_chart_object_type text,
 add column invalidation_chart_object_key text,
 add column invalidation_chart_object_instrument text,
 add column invalidation_chart_object_timeframe text,
 add column invalidation_chart_object_snapshot jsonb;

alter table public.trade_evidence drop constraint trade_evidence_kind_check;
alter table public.trade_evidence add constraint trade_evidence_kind_check
 check (kind in ('pivot', 'ob', 'fib', 'rsi_divergence', 'chart_object'));
alter table public.trade_targets drop constraint trade_targets_kind_check;
alter table public.trade_targets add constraint trade_targets_kind_check check (kind in ('pivot', 'ob', 'chart_object'));

-- Entweder alte Art ohne chart_object-Felder oder chart_object mit vollständigem Objekt und ohne fremde FKs. coalesce, weil ein
-- CHECK bei NULL besteht: ohne ihn käme ein halb gesetztes Objekt (z.B. Snapshot fehlt) durch.
alter table public.trade_evidence add constraint trade_evidence_chart_object_check check (coalesce(

 (kind <> 'chart_object' and chart_object_type is null and chart_object_key is null and chart_object_instrument is null
  and chart_object_timeframe is null and chart_object_snapshot is null)
 or (kind = 'chart_object' and chart_object_type ~ '^[a-z0-9_]+$' and length(chart_object_key) > 0
  and chart_object_instrument is not null and chart_object_timeframe is not null
  and jsonb_typeof(chart_object_snapshot) = 'object' and octet_length(chart_object_snapshot::text) <= 16384
  and ob_zone_id is null and liquidity_level_id is null and source_context is null)
, false)
);
alter table public.trade_targets add constraint trade_targets_chart_object_check check (coalesce(

 (kind <> 'chart_object' and chart_object_type is null and chart_object_key is null and chart_object_instrument is null
  and chart_object_timeframe is null and chart_object_snapshot is null)
 or (kind = 'chart_object' and chart_object_type ~ '^[a-z0-9_]+$' and length(chart_object_key) > 0
  and chart_object_instrument is not null and chart_object_timeframe is not null
  and jsonb_typeof(chart_object_snapshot) = 'object' and octet_length(chart_object_snapshot::text) <= 16384
  and liquidity_level_id is null)
, false)
);
alter table public.dealing_ranges add constraint dealing_ranges_invalidation_chart_object_check check (coalesce(

 (invalidation_chart_object_type is null and invalidation_chart_object_key is null and invalidation_chart_object_instrument is null
  and invalidation_chart_object_timeframe is null and invalidation_chart_object_snapshot is null)
 or (invalidation_chart_object_type ~ '^[a-z0-9_]+$' and length(invalidation_chart_object_key) > 0
  and invalidation_chart_object_instrument is not null and invalidation_chart_object_timeframe is not null
  and jsonb_typeof(invalidation_chart_object_snapshot) = 'object'
  and octet_length(invalidation_chart_object_snapshot::text) <= 16384
  and invalidation_liquidity_level_id is null and invalidation_ob_zone_id is null)
, false)
);
