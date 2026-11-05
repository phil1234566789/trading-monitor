"""Getrennte MT5-Leseinstanz; der eigene Cloudzugang kennt keine Handelsaktionen."""
import argparse
import json
import time
from pathlib import Path
from worker import Cloud
from history_worker import sync_history

ACTIONS=frozenset(('configuration','snapshot','history_context','history_start','history_batch','history_complete','history_fault'))
class ReaderCloud(Cloud):
    def call(self,action,body):
        if action not in ACTIONS:raise ValueError('reader_action_forbidden')
        return super().call(action,body)

def read_balance(api,cloud,identity):
    before=api.account_info()
    if before is None or (before.login,before.server)!=(identity['account_login'],identity['account_server']):
        raise ValueError('reader_account_mismatch')
    positions=api.positions_get()
    if positions is None:raise ValueError('reader_positions_unavailable')
    after=api.account_info()
    if after is None or (after.login,after.server)!=(before.login,before.server):raise ValueError('reader_account_changed')
    result=cloud.call('snapshot',dict(**identity,observed_at_sec=int(time.time()),
        snapshot=dict(balance=after.balance,equity=after.equity,currency=after.currency,positions=len(positions))))
    if result.get('recorded') is not True:raise ValueError('reader_snapshot_unconfirmed')

def connect(api,cloud,config):
    path=Path(config['terminal_path']).resolve()
    marker=path.parent/'.mmt-read-only'
    if not path.is_file() or not marker.is_file() or marker.read_text().strip()!=config['account_id']:
        raise ValueError('reader_terminal_not_isolated')
    connection=cloud.call('configuration',dict(account_id=config['account_id']))
    try:
        if not api.initialize(path=str(path),login=connection['account_login'],server=connection['account_server'],
                              password=connection['password'],portable=True,timeout=15000):
            raise ValueError('reader_terminal_unavailable')
        terminal=api.terminal_info()
        if terminal is None or not terminal.connected or terminal.trade_allowed or Path(terminal.path).resolve()!=path.parent or Path(terminal.data_path).resolve()!=path.parent:
            raise ValueError('reader_terminal_not_isolated')
        return dict(account_id=config['account_id'],account_login=connection['account_login'],account_server=connection['account_server'])
    finally:connection.pop('password',None)

def cycle(api,cloud,config):
    identity=connect(api,cloud,config)
    read_balance(api,cloud,identity)
    _,count=sync_history(api,cloud,config.get('server_time_offset_sec',0),config['account_id'])
    return count

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--config',required=True);parser.add_argument('--once',action='store_true')
    args=parser.parse_args()
    import msvcrt
    lock=open(args.config+'.lock','a+b');lock.write(b'0');lock.flush();lock.seek(0)
    try:msvcrt.locking(lock.fileno(),msvcrt.LK_NBLCK,1)
    except OSError:return
    config=json.loads(Path(args.config).read_text(encoding='utf-8-sig'))
    offset=config.get('server_time_offset_sec',0)
    if type(offset) is not int or abs(offset)>14*3600 or offset%900:raise ValueError('invalid_server_time_offset')
    cloud=ReaderCloud(config['url'],config['token'])
    import MetaTrader5 as api
    while True:
        try:
            count=cycle(api,cloud,config)
            print(json.dumps(dict(event='reader_synced',account_id=config['account_id'],deals=count)),flush=True)
        except KeyboardInterrupt:return
        except Exception:
            print(json.dumps(dict(event='reader_sync_failed',account_id=config['account_id'])),flush=True)
            try:
                context=cloud.call('history_context',dict(account_id=config['account_id']))
                cloud.call('history_fault',dict(account_id=config['account_id'],account_login=context['account_login'],account_server=context['account_server']))
            except Exception:pass
            if args.once:raise SystemExit(1)
        finally:api.shutdown()
        if args.once:return
        time.sleep(30)
if __name__=='__main__':main()
