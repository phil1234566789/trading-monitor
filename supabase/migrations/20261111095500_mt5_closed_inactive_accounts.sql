-- IQCapital hat diese beiden Konten wegen Inaktivität geschlossen; Historie und Zugangsdaten bleiben erhalten.
do $$
begin
 perform pg_advisory_xact_lock(29092026,1);
 if exists(select 1 from public.mt5_execution_settings
   where id='primary' and active_account_id in ('7f25e038-1924-44d2-a642-4062769affea','4b147af6-18ee-48aa-9ace-3c692819b791')) then
  raise exception 'Cannot archive the selected trading account';
 end if;
 update public.mt5_accounts
 set archived=true, trade_role=null,
  archive_details=archive_details || jsonb_build_object('status','closed',
   'reason','Von IQCapital wegen Inaktivität deaktiviert. Reaktivierung beim Support angefragt.')
 where (id='7f25e038-1924-44d2-a642-4062769affea' and login=26784
     or id='4b147af6-18ee-48aa-9ace-3c692819b791' and login=26783)
  and server='BeyondIQCapital-Server';
end $$;
