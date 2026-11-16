-- jsonb_populate_recordset setzt fehlende Felder auf NULL statt auf den Spalten-Default; computed_at deshalb hier stempeln.
create or replace function public.replace_dob_trade_setups(p_instrument text, p_version text, p_rows jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare inserted integer;
begin
  delete from dob_trade_setups where instrument = p_instrument and version = p_version;
  insert into dob_trade_setups
    select (jsonb_populate_record(null::dob_trade_setups, e || jsonb_build_object('computed_at', now()))).*
    from jsonb_array_elements(p_rows) e
    where e->>'instrument' = p_instrument and e->>'version' = p_version;
  get diagnostics inserted = row_count;
  return inserted;
end $$;
