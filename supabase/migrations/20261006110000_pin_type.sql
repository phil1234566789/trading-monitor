-- Klassifikation gehört zum Pin, nicht zum unveränderlichen Markt-Snapshot. Alt-Pins bleiben ungeordnet.
alter table public.pin_context
  add column pin_type text check (pin_type in ('observation','bug'));
