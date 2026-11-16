-- Konto 2 hat den Max Drawdown gerissen; Konto 3 übernimmt die Hauptkonto-Rolle, Konto 4 bleibt riskant.
do $$
begin
 perform public.mt5_select_test_account('58ef24f2-96d8-464f-9d09-5f00af282f4d');
 update public.mt5_accounts
 set archived=true, trade_role=null,
  archive_details=archive_details || jsonb_build_object('status','breached','reason','Max Drawdown','currency','USD',
   'peak_source','Laut Philip zwischenzeitlich ca. 2.000 USD im Plus; genauer Höchststand nicht bestätigt',
   'breach_note','Position #3164003 lief ohne Broker-SL (SL-Plan pausiert: broker_precheck_failed) und wurde am 16.11.2026 von Hand geschlossen.')
 where id='edc84f4d-4ec1-4d1b-8464-5bc64bc362a5' and login=26781 and server='BeyondIQCapital-Server';
 if not found then raise exception 'Konto 2 nicht gefunden'; end if;
 update public.mt5_accounts set name='Konto 3 Hauptkonto', trade_role='normal'
 where id='58ef24f2-96d8-464f-9d09-5f00af282f4d' and login=28727 and not archived;
 if not found then raise exception 'Konto 3 nicht gefunden'; end if;
end $$;
