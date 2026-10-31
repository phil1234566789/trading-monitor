import json
import sqlite3
import unittest
from unittest.mock import Mock,patch
from types import SimpleNamespace as N
from daily_stop import DailyStopEngine
from guard_broker import GuardBroker
from broker_close import market_close_request


def command(kind='close'):
    return dict(id='e297afbf-172c-4304-99e7-eb1198191050',status='pending',kind=kind,ticket=7,symbol='XAUUSD.gbe',expected_volume=.01,
                checkpoint=dict(account_login=42,account_server='Demo',mode='demo',type=0,magic=3,volume=.01))


class Cloud:
    def __init__(self,rows):
        self.rows=rows;self.fail_result=False;self.calls=[]
    def call(self,action,body):
        self.calls.append((action,body))
        if action=='guard_sync':return dict(latched=True,commands=[dict(r) for r in self.rows])
        row=next(r for r in self.rows if r['id']==body['id'])
        if action=='guard_claim':
            okay=row['status']=='pending';row['status']='sending' if okay else row['status'];return dict(authorized=okay)
        if action=='guard_result':
            if self.fail_result:raise OSError('offline')
            if row['status']!='executed':row.update(status=body['result']['status'])
            return dict(recorded=True)
        raise AssertionError(action)


class DailyStopTests(unittest.TestCase):
    def setup_engine(self,rows):
        broker=Mock(login=42,server='Demo');adapter=Mock();adapter.exposure.return_value=dict(positions=[],orders=[])
        adapter.current.return_value=N(ticket=7);adapter.prepare.return_value={};adapter.send.return_value=dict(status='unknown',reason='network_timeout')
        cloud=Cloud(rows);db=sqlite3.connect(':memory:')
        with patch('daily_stop.GuardBroker',return_value=adapter):engine=DailyStopEngine(broker,cloud,db)
        return engine,adapter,cloud,db,broker
    def test_unknown_close_is_never_resent_after_restart(self):
        row=command();engine,broker,cloud,db,raw=self.setup_engine([row]);engine.cycle({});engine.cycle({})
        with patch('daily_stop.GuardBroker',return_value=broker):restarted=DailyStopEngine(raw,cloud,db)
        restarted.cycle({});self.assertEqual(broker.send.call_count,1);self.assertEqual(row['status'],'unknown')
        broker.current.return_value=None;restarted.cycle({});self.assertEqual(row['status'],'executed');self.assertEqual(broker.send.call_count,1)
    def test_claim_without_local_result_becomes_unknown_without_send(self):
        row=command();row['status']='sending';engine,broker,cloud,db,raw=self.setup_engine([row]);engine.cycle({})
        broker.send.assert_not_called();self.assertEqual(row['status'],'unknown')
    def test_cloud_failure_preserves_broker_result_and_never_resends(self):
        row=command();engine,broker,cloud,db,raw=self.setup_engine([row]);broker.send.return_value=dict(status='executed',reason='broker_exposure_absent')
        cloud.fail_result=True
        with self.assertRaises(OSError):engine.cycle({})
        cloud.fail_result=False;broker.current.return_value=None;engine.cycle({});self.assertEqual(row['status'],'executed');self.assertEqual(broker.send.call_count,1)
    def test_unresolved_position_a_does_not_prevent_close_of_b(self):
        a,b=command(),command();a['status']='unknown';b['id']='ffffffff-0000-0000-0000-000000000001';b['ticket']=8
        engine,broker,cloud,db,raw=self.setup_engine([a,b])
        def current(row):
            if row['ticket']==7:raise ValueError('guard_exposure_changed')
            return N(ticket=8)
        broker.current.side_effect=current;engine.cycle({})
        self.assertEqual(broker.prepare.call_args.args[0]['ticket'],8);broker.send.assert_called_once()
    def test_monitor_does_not_send_or_claim(self):
        engine,broker,cloud,db,raw=self.setup_engine([command()]);engine.execute=False;engine.cycle({});broker.send.assert_not_called()
        self.assertFalse(any(a=='guard_claim' for a,b in cloud.calls))
    def test_cancels_pending_entry_before_closing_position(self):
        close,cancel=command(),command('cancel');cancel['id']='00000000-0000-0000-0000-000000000001'
        engine,broker,cloud,db,raw=self.setup_engine([close,cancel]);engine.cycle({});self.assertEqual(broker.prepare.call_args.args[0]['kind'],'cancel')


class GuardBrokerTests(unittest.TestCase):
    def broker(self):
        api=Mock();api.ACCOUNT_MARGIN_MODE_RETAIL_HEDGING=2;api.ORDER_TYPE_BUY=0;api.ORDER_TYPE_SELL=1
        api.ORDER_FILLING_FOK=0;api.ORDER_FILLING_IOC=1;api.TRADE_ACTION_DEAL=1;api.TRADE_ACTION_REMOVE=8;api.ORDER_TIME_GTC=0;api.TRADE_RETCODE_DONE=10009
        api.symbol_info.return_value=N(volume_min=.01,volume_max=100,volume_step=.01,filling_mode=1)
        api.order_check.return_value=N(retcode=0)
        raw=Mock(login=42,server='Demo',api=api);raw.account.return_value=(N(margin_mode=2,trade_allowed=True,trade_expert=True),N(trade_allowed=True,tradeapi_disabled=False))
        raw.fresh_tick.return_value=(N(bid=4000,ask=4000.2),100)
        p=N(ticket=7,symbol='XAUUSD.gbe',type=0,magic=3,volume=.01,sl=3990,tp=4010)
        api.positions_get.return_value=[p];return GuardBroker(raw),raw,p
    def test_close_is_position_bound_and_does_not_remove_rest_sl(self):
        guard,raw,p=self.broker();request=guard.prepare(command());self.assertEqual(request['position'],7);self.assertEqual(request['volume'],.01)
        self.assertEqual(request['type'],1);self.assertNotIn('sl',request);self.assertEqual(p.sl,3990)
    def test_changed_volume_or_account_never_sends(self):
        guard,raw,p=self.broker();p.volume=.02
        with self.assertRaises(ValueError):guard.prepare(command())
        raw.api.order_send.assert_not_called()
        p.volume=.01;raw.server='Other'
        with self.assertRaises(ValueError):guard.prepare(command())
    def test_missing_broker_query_does_not_mean_closed(self):
        guard,raw,p=self.broker();raw.api.positions_get.return_value=None
        with self.assertRaises(ValueError):guard.current(command())
    def test_close_rechecks_volume_after_precheck_and_never_reverses_netting(self):
        guard,raw,p=self.broker();request=guard.prepare(command());p.volume=.02
        with self.assertRaises(ValueError):guard.send(command(),request)
        raw.api.order_send.assert_not_called()
        raw.account.return_value[0].margin_mode=0
        with self.assertRaises(ValueError):guard.prepare(command())
    def test_native_volume_step_is_enforced_for_every_close(self):
        guard,raw,p=self.broker();p.volume=.03
        with self.assertRaises(ValueError):market_close_request(raw,p,.005,'test')
        self.assertEqual(market_close_request(raw,p,.01,'test')['volume'],.01)


if __name__=='__main__':unittest.main()
