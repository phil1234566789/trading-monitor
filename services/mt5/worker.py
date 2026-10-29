"""Ausgehende HTTPS-Verbindung: kein öffentlicher Port auf dem Windows-Rechner."""
import argparse
import json
import os
import time
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, build_opener, HTTPRedirectHandler

from broker import Broker
from core import Journal, trigger_matches, validate_intent, positive
from health import fault_details


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise ValueError('redirect_refused')


class Cloud:
    def __init__(self, url, token):
        parsed = urlparse(url)
        if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError('invalid_worker_url')
        if not token or len(token) < 32:
            raise ValueError('worker_token_missing')
        self.url, self.token = url, token
        self.opener = build_opener(NoRedirect())

    def call(self, action, body):
        request = Request(self.url, data=json.dumps(dict(action=action, **body), allow_nan=False).encode(),
                          headers={'Authorization': 'Bearer ' + self.token, 'Content-Type': 'application/json'})
        with self.opener.open(request, timeout=8) as response:
            data = response.read(128_001)
            if len(data) > 128_000:
                raise ValueError('worker_response_too_large')
            result = json.loads(data)
            if not isinstance(result, dict):
                raise ValueError('invalid_worker_response')
            return result


class Engine:
    def __init__(self, broker, cloud, journal, execute=True):
        self.broker, self.cloud, self.journal = broker, cloud, journal
        self.execute=execute
        self.last_fault=None
        self.last_fault_report=0
        self.pending_notified=set()
        self.next_reconcile={}

    def report_fault(self,error):
        fault=fault_details(error,self.last_fault)
        changed=self.last_fault!=fault
        self.last_fault=fault
        if not changed and time.monotonic()-self.last_fault_report<30:
            return
        self.last_fault_report=time.monotonic()
        print(json.dumps(dict(event='worker_paused',**fault)),flush=True)
        try:
            self.cloud.call('fault',dict(account_login=self.broker.login,account_server=self.broker.server,fault=fault))
        except Exception:
            print(json.dumps(dict(event='fault_report_pending')),flush=True)

    def snapshot(self):
        snapshot=self.broker.snapshot()
        snapshot['quotes']=self.broker.quotes()
        snapshot['execution_ready']=self.execute and self.last_fault is None
        if self.last_fault:snapshot['worker_error']=self.last_fault
        return snapshot

    def flush(self):
        failed=False
        for row in self.journal.pending():
            try:
                result=row['result'] or dict(status='unknown',reason='restart_after_reservation')
                if result['status']=='executed' and (not positive(result.get('price')) or
                    not (positive(result.get('deal')) or positive(result.get('position')))):
                    if time.monotonic()<self.next_reconcile.get(row['id'],0):continue
                    self.next_reconcile[row['id']]=time.monotonic()+2
                    resolved=self.broker.reconcile_result(result)
                    if resolved is None:
                        if row['id'] not in self.pending_notified:
                            self.cloud.call('result',dict(id=row['id'],result=dict(result,status='unknown',reason='broker_fill_pending')))
                            self.pending_notified.add(row['id'])
                        continue
                    result=resolved
                self.journal.finish(row['id'],result)
                if self.cloud.call('result',dict(id=row['id'],result=result)).get('recorded') is True:
                    self.journal.acknowledge(row['id'])
            except Exception as error:
                failed=True
                self.report_fault(error)
        return not failed

    def watch_positions(self,rows):
        okay=True
        for row in rows:
            try:
                state=self.broker.position_lifecycle(row['intent'],row['result'])
                self.cloud.call('position_update',dict(id=row['id'],lifecycle=state))
            except Exception as error:
                okay=False;self.report_fault(error)
        return okay

    def consider(self, intent, now):
        if not self.execute:
            return
        validate_intent(intent, self.broker.allow_live)
        if any(row['id'] == intent['id'] for row in self.journal.pending()):
            return
        candle = {} if intent['trigger']=='market_confirmed' else self.broker.closed_m1(intent['symbol'])
        if candle is None or not trigger_matches(intent, candle, now):
            return
        try:
            request = self.broker.prepare(intent)
        except ValueError as error:
            self.cloud.call('reject_search', dict(id=intent['id'], reason=str(error)[:100]))
            return
        if self.cloud.call('begin', dict(id=intent['id'])).get('authorized') is not True:
            return
        if not self.journal.reserve(intent['id']):
            return
        # Vor dem Brokeraufruf dauerhaft reserviert: ein Prozessabbruch darf nie erneut senden.
        result = dict(status='unknown', reason='send_outcome_unknown')
        try:
            if trigger_matches(intent, candle, time.time()):
                try:
                    request = self.broker.prepare(intent)
                except ValueError as error:
                    result = dict(status='rejected', reason=str(error)[:100])
                else:
                    try:
                        result = self.broker.send(intent, request)
                    except Exception:
                        result = dict(status='unknown', reason='send_outcome_unknown')
            else:
                result = dict(status='rejected', reason='trigger_expired_before_send')
        finally:
            self.journal.finish(intent['id'], result)

    def run(self):
        orders, next_poll, watch_cursor = [], 0.0, None
        while True:
            try:
                checked_cycle=False
                flush_ok=self.flush() if self.execute else True
                if time.monotonic() >= next_poll:
                    snapshot=self.snapshot()
                    response = self.cloud.call('poll', dict(snapshot=snapshot,watch_cursor=watch_cursor))
                    checked_cycle=True
                    watched=response.get('watch_orders',[])
                    if not isinstance(watched,list) or len(watched)>20:raise ValueError('invalid_position_watch')
                    if not self.watch_positions(watched):flush_ok=False
                    watch_cursor=response.get('watch_cursor')
                    orders = response.get('orders')
                    if not isinstance(orders, list) or len(orders) > 100:
                        raise ValueError('invalid_order_list')
                    next_poll = time.monotonic() + 1
                if self.execute and flush_ok and not any(row.get('status') in ('sending', 'unknown') for row in orders):
                    for row in orders:
                        if row.get('status') == 'searching':
                            self.consider(row['intent'], time.time())
            except KeyboardInterrupt:
                return
            except Exception as error:
                self.report_fault(error)
                orders, next_poll, watch_cursor = [], 0.0, None
                time.sleep(2)
            else:
                if flush_ok and checked_cycle:self.last_fault=None
            time.sleep(.2)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--probe', action='store_true', help='Nur lokalen Kontostand lesen; kein Cloudkontakt/Orderversand')
    parser.add_argument('--monitor',action='store_true',help='Nur Kontostand und Kurse synchronisieren; kein Orderversand')
    args = parser.parse_args()
    path = os.environ.get('MT5_TERMINAL_PATH')
    if not path or not Path(path).is_file():
        raise ValueError('terminal_path_missing')
    import MetaTrader5 as mt5
    cloud, config = None, None
    if not args.probe:
        cloud = Cloud(os.environ['MT5_WORKER_URL'], os.environ['MT5_WORKER_TOKEN'])
        config = cloud.call('configuration', {})
        if not args.monitor and config.get('mode') == 'live' and (not config.get('allow_live') or os.environ.get('MT5_ALLOW_LIVE') != 'true'):
            raise ValueError('live_not_enabled_locally_and_remotely')
        if not isinstance(config.get('account_login'), int) or not isinstance(config.get('account_server'), str):
            raise ValueError('invalid_account_configuration')
    connection = dict(login=config['account_login'], server=config['account_server'], password=config['password']) if config else {}
    if not mt5.initialize(path=path, timeout=5000, **connection):
        print(json.dumps(dict(connected=False, error_code=mt5.last_error()[0])))
        return 1
    try:
        account = mt5.account_info()
        if args.probe:
            if account is None:
                print(json.dumps(dict(connected=False, account_available=False)))
                return 1
            broker = Broker(mt5, account.login, account.server, allow_live=True,server_time_offset_seconds=int(os.environ.get('MT5_SERVER_TIME_OFFSET_SEC','0')))
            print(json.dumps(broker.snapshot(), allow_nan=False))
            return 0
        login, server = config['account_login'], config['account_server']
        config.pop('password', None)
        connection.clear()
        broker = Broker(mt5, login, server, allow_live=args.monitor or os.environ.get('MT5_ALLOW_LIVE') == 'true',
                        server_time_offset_seconds=int(os.environ.get('MT5_SERVER_TIME_OFFSET_SEC','0')))
        broker.account(config['mode'])
        journal_path = Path(os.environ.get('MT5_JOURNAL_PATH', Path(__file__).with_name('execution.sqlite3')))
        with Journal(journal_path) as journal:
            Engine(broker, cloud, journal,execute=not args.monitor).run()
        return 0
    finally:
        mt5.shutdown()


if __name__ == '__main__':
    raise SystemExit(main())
