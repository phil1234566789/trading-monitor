-- Rückwirkend verknüpfte invalidierte OBs bleiben dokumentierbar, ohne als GO zu gelten.
alter table public.trade_evidence
  add column historical_only boolean not null default false,
  add constraint trade_evidence_historical_ob_only check (not historical_only or kind = 'ob');

comment on column public.trade_evidence.historical_only is
  'Historical evidence from an already invalidated OB; must not count as an active confirmation/GO.';
