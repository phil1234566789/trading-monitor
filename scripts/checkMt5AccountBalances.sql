-- Innerhalb einer Transaktion ausführen und anschließend rollback: keine Brokerkonten aktivieren.
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); value public.mt5_account_balances%rowtype;
begin
 if has_table_privilege('anon','public.mt5_account_balances','select')
  or has_table_privilege('authenticated','public.mt5_account_balances','select') then raise exception 'private data exposed'; end if;
 insert into public.mt5_accounts(id,name,login,server,mode,credentials) values
  (a,'balance-test',900000001,'balance-test','demo','{}'),(b,'balance-test',900000002,'balance-test','demo','{}');
 insert into public.mt5_account_balances(account_id,loss_floor,target,limits_at,limits_source)
  values(a,47000,54000,'2026-10-30','test');
 create temporary table balance_test_bridge(snapshot jsonb,heartbeat_at timestamptz);
 create trigger balance_test_trigger after insert on balance_test_bridge for each row execute function public.mt5_remember_account_balance();
 insert into balance_test_bridge values
  ('{"account_login":900000001,"account_server":"balance-test","balance":50000,"equity":49000,"currency":"USD","positions":[]}', '2026-10-31T10:00:00Z'),
  ('{"account_login":900000002,"account_server":"balance-test","balance":51000,"equity":51000,"currency":"USD","positions":[]}', '2026-10-31T10:00:00Z'),
  ('{"account_login":900000001,"account_server":"balance-test","balance":46000,"equity":45000,"currency":"USD","positions":[]}', '2026-10-31T11:00:00Z'),
  ('{"account_login":900000001,"account_server":"balance-test","balance":60000,"equity":60000,"currency":"USD","positions":[]}', '2026-10-31T09:00:00Z'),
  ('{"account_login":900000001,"account_server":"balance-test","balance":0,"equity":0,"currency":"USD","positions":[],"worker_error":{"code":"fault"}}', '2026-10-31T12:00:00Z');
 select * into value from public.mt5_account_balances where account_id=a;
 if value.balance<>46000 or value.equity<>45000 or value.loss_floor<>47000 or value.target<>54000
  or value.limits_at<>'2026-10-30'::timestamptz or value.balance_at<>'2026-10-31T11:00:00Z'::timestamptz then raise exception 'incorrect balance or trailing limit'; end if;
 if (select balance from public.mt5_account_balances where account_id=b)<>51000 then raise exception 'account isolation failed'; end if;
end $$;
