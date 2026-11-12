"""Lesender Historienprozess: keine Logins, Orders oder Kontowechsel."""
import os
import time
from pathlib import Path
from worker import Cloud
from history_mailbox import HistoryMailbox

def normalise_deal(deal,offset):
    d=deal._asdict()
    return dict(ticket=int(d['ticket']),position_id=int(d['position_id']),
                time_msc=int(d['time_msc'])-offset*1000,type=int(d['type']),entry=int(d['entry']),
                symbol=d['symbol'],volume=float(d['volume']),price=float(d['price']),
                profit=float(d['profit']),commission=float(d['commission']),swap=float(d['swap']),fee=float(d['fee']))

def sync_history(api,cloud,offset,reader_id=None,requested_at=None):
    context=cloud.call('history_context',dict(account_id=reader_id) if reader_id else {})
    if context.get('archived'):raise ValueError('archived_account')
    identity=dict(account_login=context['account_login'],account_server=context['account_server'])
    if reader_id:identity['account_id']=reader_id
    account=api.account_info()
    if account is None or (account.login,account.server)!=(identity['account_login'],identity['account_server']):raise ValueError('history_account_mismatch')
    cloud.call('history_start',identity)
    until=int(time.time());full=context['full_due'];since=0 if full else max(0,context['since_sec']-7*86400)
    deals=api.history_deals_get(since+offset if since else 0,until+offset+60)
    if deals is None:raise ValueError('history_unavailable')
    rows=[normalise_deal(d,offset) for d in deals]
    # Ein zwischenzeitlicher manueller Kontowechsel darf keine fremden Deals zuordnen.
    after=api.account_info()
    if after is None or (after.login,after.server)!=(account.login,account.server):raise ValueError('history_account_changed')
    for start in range(0,len(rows),100):
        batch=rows[start:start+100]
        result=cloud.call('history_batch',dict(**identity,currency=account.currency,deals=batch))
        if result.get('recorded')!=len(batch):raise ValueError('history_batch_unconfirmed')
    cloud.call('history_complete',dict(**identity,currency=account.currency,until_sec=until,full=full,**(dict(requested_at=requested_at) if requested_at else {})))
    return identity,len(rows)

def main():
    from terminal_connection import initialize_terminal
    import MetaTrader5 as api
    path=os.environ['MT5_TERMINAL_PATH']
    if not Path(path).is_file():raise ValueError('terminal_path_missing')
    offset=int(os.environ.get('MT5_SERVER_TIME_OFFSET_SEC','0'))
    if abs(offset)>14*3600 or offset%900:raise ValueError('invalid_server_time_offset')
    cloud=Cloud(os.environ['MT5_WORKER_URL'],os.environ['MT5_WORKER_TOKEN'])
    mailbox=HistoryMailbox()
    while True:
        requested=mailbox.pending()
        if not requested:
            time.sleep(1)
            continue
        identity=None
        try:
            c=cloud.call('history_context',{})
            identity=dict(account_login=c['account_login'],account_server=c['account_server'])
            if not initialize_terminal(api,path,timeout=5000,portable=bool(os.environ.get('MT5_ACCOUNT_ID'))):raise ValueError('terminal_unavailable')
            _,count=sync_history(api,cloud,offset,requested_at=requested)
            print('history_synced deals='+str(count),flush=True)
        except Exception:
            print('history_sync_failed',flush=True)
            if identity:
                try:cloud.call('history_fault',dict(**identity,requested_at=requested))
                except Exception:pass
        finally:
            api.shutdown()
            mailbox.finish(requested)
if __name__=='__main__':main()
