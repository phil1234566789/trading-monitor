"""IQCapital CSV als eigene private Statistikquelle vorbereiten; führt kein SQL aus."""
import argparse
import csv
import hashlib
import io
import json
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo


def number(value):
    result = Decimal(value.replace(',', '.'))
    if not result.is_finite():
        raise ValueError('Ungültige Zahl')
    return result


def timestamp(value):
    local = datetime.strptime(value, '%Y-%m-%d %H:%M:%S')
    zone = ZoneInfo('Europe/Berlin')
    aware = local.replace(tzinfo=zone)
    if aware.utcoffset() != local.replace(tzinfo=zone, fold=1).utcoffset():
        raise ValueError('Mehrdeutige oder fehlende Berliner Ortszeit: ' + value)
    if aware.astimezone(timezone.utc).astimezone(zone).replace(tzinfo=None) != local:
        raise ValueError('Ungültige Berliner Ortszeit')
    return int(aware.timestamp() * 1000)


def parse_export(data, login, currency='USD', provider_account=None):
    rows = list(csv.DictReader(io.StringIO(data.decode('utf-8-sig')), delimiter=';'))
    if not rows:
        raise ValueError('Leere CSV')
    trades, seen = [], set()
    start = number(rows[0]['Start Balance'])
    for row in rows:
        if (row['Provider Account'] != (provider_account or str(login)) or number(row['Start Balance']) != start
                or row.get('Provider') != rows[0].get('Provider')):
            raise ValueError('Gemischte Konten oder Startbeträge')
        trade_id = row['Trade Id']
        if not trade_id.isdigit() or int(trade_id) <= 0 or trade_id in seen:
            raise ValueError('Ungültige oder doppelte Trade-ID')
        seen.add(trade_id)
        quantity, divider = number(row['Quantity']), number(row['Divider'])
        if divider <= 0:
            raise ValueError('Ungültiger Mengendivisor')
        signed_quantity = row.get('Provider') == 'VolumetricaFX'
        volume = (abs(quantity) if signed_quantity else quantity) / divider
        entry, exit_price = number(row['Entry Price']), number(row['Exit Price'])
        opened, closed = timestamp(row['Entry Date/Time']), timestamp(row['Exit Date/Time'])
        if volume <= 0 or entry <= 0 or exit_price <= 0 or closed < opened:
            raise ValueError('Ungültiger Trade')
        trades.append(dict(source_trade_id=trade_id, symbol=row['Contract'], currency=currency,
                           opened_at=opened, closed_at=closed, entry=float(entry), exit=float(exit_price),
                           direction=('long' if quantity > 0 else 'short') if signed_quantity else None,
                           volume=float(volume), net=float(number(row['Net PnL'])),
                           commission=float(number(row['Commissions'])), source_row=row))
    return start, trades


def literal(value):
    return "'" + value.replace("'", "''") + "'"


def prepare_sql(data, filename, login, peak, ending, reason, server='CSV-Archiv', status='breached', note='', provider_account=None):
    if status not in ('breached', 'closed', 'passed'):
        raise ValueError('Ungültiger Archivstatus')
    start, trades = parse_export(data, login, provider_account=provider_account)
    balance, csv_peak = start, start
    for trade in sorted(trades, key=lambda t: (t['closed_at'], int(t['source_trade_id']))):
        balance += number(trade['source_row']['Net PnL'])
        csv_peak = max(csv_peak, balance)
    details = dict(provider='IQCapital', status=status, reason=reason, initial_balance=float(start), currency='USD',
                   platform=trades[0]['source_row'].get('Provider'),
                   provider_account=provider_account or str(login),
                   peak_balance=float(peak), peak_source='Von Philip bestätigt', reported_end_balance=float(ending),
                   csv_end_balance=float(balance), csv_peak_balance=float(csv_peak),
                   source_timezone='Europe/Berlin (angenommen)',
                   reconciliation_note='CSV-Import; ' + ('Long/Short aus signierter VolumetricaFX-Menge. '
                   if all(t['direction'] for t in trades) else 'Long/Short im Export unbekannt. ') + note)
    encode = lambda value: literal(json.dumps(value, ensure_ascii=False, allow_nan=False)) + '::jsonb'
    account = f'(select id from public.mt5_accounts where login={login} and server={literal(server)})'
    columns = ['source_trade_id', 'symbol', 'currency', 'opened_at', 'closed_at', 'entry', 'exit',
               'direction', 'volume', 'net', 'commission', 'source_row']
    fields = ','.join('"'+c+'"' for c in columns)
    types = 'source_trade_id text,symbol text,currency text,opened_at bigint,closed_at bigint,' \
            'entry double precision,exit double precision,direction text,volume double precision,' \
            'net double precision,commission double precision,source_row jsonb'
    sql = f'''begin;
insert into public.mt5_accounts(name,login,server,mode,credentials,archived,archive_details)
values({literal('Konto #'+str(login)+' · '+trades[0]['source_row']['Account'])},{login},{literal(server)},'live','{{}}',true,{encode(details)})
on conflict(login,server) do nothing;
do $$ begin
 if not exists(select 1 from public.mt5_accounts where id={account} and archived)
 or exists(select 1 from public.mt5_broker_deals where account_id={account}) then
 raise exception 'CSV-Import nur in ein archiviertes Konto ohne native Deals'; end if;
end $$;
insert into public.mt5_imported_trades(account_id,source_file,source_hash,{fields})
select {account},{literal(filename)},{literal(hashlib.sha256(data).hexdigest())},{fields}
from jsonb_to_recordset({encode(trades)}) as t({types})
on conflict(account_id,source_trade_id) do nothing;
commit;
'''
    return sql, dict(trades=len(trades), csv_end=str(balance), csv_peak=str(csv_peak),
                     net=str(balance-start), commission=str(sum(number(t['source_row']['Commissions']) for t in trades)))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file', type=Path)
    parser.add_argument('--login', type=int, required=True)
    parser.add_argument('--peak', type=number, required=True)
    parser.add_argument('--ending', type=number, required=True)
    parser.add_argument('--reason', required=True)
    parser.add_argument('--status', choices=['breached', 'closed', 'passed'], default='breached')
    parser.add_argument('--note', default='')
    parser.add_argument('--provider-account', help='Exakte Kennung der CSV, falls sie von der Kontonummer abweicht')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.login <= 0:
        raise ValueError('Ungültige Kontonummer')
    sql, summary = prepare_sql(args.file.read_bytes(), args.file.name, args.login, args.peak, args.ending, args.reason,
                               status=args.status, note=args.note, provider_account=args.provider_account)
    args.output.write_text(sql, encoding='utf-8')
    print(json.dumps(summary))
