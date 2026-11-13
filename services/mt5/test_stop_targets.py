import sqlite3
import time
import unittest
from types import SimpleNamespace as NS
from unittest.mock import Mock
from broker import Broker
from target_broker import TargetBroker
from target_worker import TargetEngine
from stop_risk import validate_stop_risk
import test_targets as fixtures
from test_broker import api


def exit_plan(state='pending'):
    row=fixtures.plan(state,native_tp=1.32)
    row['checkpoint'].update(sl=0)
    row['next_stop_index']=0
    row['plan'].update(exit_version=1,risk_mode='risky',native_sl=1.29,stops=[dict(price=1.295,volume=.01),dict(price=1.29,volume=.01)])
    return row


class SplitStopEngineTests(unittest.TestCase):
    def engine(self):
        cloud=Mock();cloud.call.return_value=dict(authorized=True,recorded=True)
        db=sqlite3.connect(':memory:');self.addCleanup(db.close)
        engine=TargetEngine(Mock(),cloud,db,True);engine.broker=Mock()
        engine.broker.position.return_value=fixtures.position(sl=0)
        engine.broker.prepare.return_value={};engine.broker.send.return_value=dict(status='executed',remaining_volume=.01,sl=1.29,tp=1.32,deal=777)
        return engine,cloud

    def test_native_tp_does_not_disable_partial_stops(self):
        engine,cloud=self.engine();row=exit_plan('active');row['checkpoint'].update(sl=1.29,tp=1.32)
        engine.broker.position.return_value=fixtures.position(sl=1.29,tp=1.32)
        engine.consider(row)
        self.assertEqual(engine.broker.send.call_args.args[1:3],('stop_close',0))
        self.assertEqual(cloud.call.call_args.args[1]['exit_plan_version'],1)

    def test_unreached_stop_still_allows_reached_tp_and_never_sends_both(self):
        engine,_=self.engine();row=exit_plan('active');row['plan']['native_tp']=0;row['checkpoint']['sl']=1.29
        engine.broker.position.return_value=fixtures.position()
        def prepare(row,kind,index):
            if kind=='stop_close':raise ValueError('target_not_reached')
            return {}
        engine.broker.prepare.side_effect=prepare;engine.consider(row)
        self.assertEqual(engine.broker.send.call_count,1);self.assertEqual(engine.broker.send.call_args.args[1:3],('close',0))

    def test_changed_position_or_unknown_result_never_retries_partial_sl(self):
        engine,cloud=self.engine();row=exit_plan('active');row['checkpoint']['sl']=1.29
        engine.broker.position.return_value=fixtures.position(volume=.01)
        engine.consider(row);engine.broker.send.assert_not_called()
        row['state']='unknown';engine.consider(row);engine.broker.send.assert_not_called()

    def test_refreshes_authoritative_risk_again_after_a_slow_cloud_claim(self):
        clock=[1000];refreshed=[];cloud=Mock()
        def call(action,body):
            if action=='target_claim':clock[0]+=8
            return dict(authorized=True,recorded=True)
        cloud.call.side_effect=call
        db=sqlite3.connect(':memory:');self.addCleanup(db.close)
        def refresh():refreshed.append(clock[0])
        engine=TargetEngine(Mock(),cloud,db,True,refresh);engine.broker=Mock();engine.broker.position.return_value=fixtures.position(sl=0)
        def prepare(row,kind,index):
            self.assertLess(clock[0]-refreshed[-1],5)
            return {}
        engine.broker.prepare.side_effect=prepare;engine.broker.send.return_value=dict(status='executed',remaining_volume=.02,sl=1.29,tp=1.32)
        engine.consider(exit_plan())
        self.assertEqual(refreshed,[1000,1008]);engine.broker.send.assert_called_once()


class SplitStopBrokerTests(unittest.TestCase):
    def setUp(self):
        self.api=api();self.api.TRADE_ACTION_SLTP=6;self.api.TRADE_RETCODE_DONE=10009
        self.api.order_calc_profit.side_effect=None;self.api.order_calc_profit.return_value=-100
        self.position=fixtures.position(sl=0);self.position.price_open=1.3;self.position.price_current=1.3;self.position.profit=0;self.position.swap=0
        self.api.positions_get.return_value=(self.position,)
        self.native=Broker(self.api,42,'Demo');self.broker=TargetBroker(self.native)
        now=time.time();self.snapshot=dict(balance=50000,equity=50000,currency='USD',pending_orders=0,hedging=True,risk_guards_ready=True,
            risk=dict(time=now,day='2026-11-13',latched=False,realized_net_day=0,open_loss=0),
            positions=[dict(ticket=123,symbol='EURUSD',profit=0,swap=0,risk_to_sl=None,remaining_risk_to_sl=None)])
        self.native.guard_snapshot=Mock(return_value=self.snapshot)
        self.native.risk_context=dict(policy=dict(risk_base=50000,cost_buffer=25,drawdown_floor=47000,confirmed_balance=50000,confirmed_equity=51000,currency='USD',day='2026-11-13',valid_until_sec=now+1000))

    def test_installs_one_outer_full_volume_sl_and_reports_unchanged_tp(self):
        row=exit_plan();request=self.broker.prepare(row,'install',-1)
        self.assertEqual(request['sl'],1.29);self.assertEqual(request['tp'],1.32)
        self.api.order_send.return_value=NS(retcode=10009)
        self.api.positions_get.side_effect=[(self.position,),(fixtures.position(sl=1.29,tp=1.32),)]
        self.assertEqual(self.broker.send(row,'install',-1,request),dict(status='executed',remaining_volume=.02,sl=1.29,tp=1.32))

    def test_xau_and_gbp_quotes_keep_native_gain_loss_and_direction_coefficients_distinct(self):
        self.api.symbols_get.return_value=[NS(name='XAUUSD.gbe'),NS(name='GBPUSD.gbe')]
        def profit(side,symbol,volume,entry,exit):
            move=(exit-entry)*(1 if side==0 else -1)
            return move*(100 if symbol.startswith('XAU') else 100000)*volume*(2 if move>0 else 1)*(3 if side==1 else 1)
        self.api.order_calc_profit.side_effect=profit
        quotes=self.native.quotes()
        for quote in quotes:
            base=(100 if quote['symbol'].startswith('XAU') else 100000)*quote['minimum_volume']
            self.assertAlmostEqual(quote['loss_per_unit_long'],base)
            self.assertAlmostEqual(quote['profit_per_unit_long'],2*base)
            self.assertAlmostEqual(quote['loss_per_unit_short'],3*base)
            self.assertAlmostEqual(quote['profit_per_unit_short'],6*base)

    def test_full_outer_risk_is_checked_natively_instead_of_weighted_stop_risk(self):
        self.api.order_calc_profit.return_value=-300
        with self.assertRaisesRegex(ValueError,'stop_risk_budget_exceeded'):self.broker.prepare(exit_plan(),'install',-1)
        self.api.order_send.assert_not_called()

    def test_existing_own_loss_is_not_double_counted_and_open_profit_is_not_daily_budget(self):
        self.snapshot['risk'].update(realized_net_day=-800,open_loss=-100);self.snapshot['positions'][0]['profit']=-100;self.snapshot['equity']=49900
        self.api.order_calc_profit.return_value=-175
        validate_stop_risk(self.native,self.position,exit_plan()['plan'])
        self.snapshot['risk']['open_loss']=0;self.snapshot['positions'][0]['profit']=400;self.snapshot['equity']=50400
        self.api.order_calc_profit.return_value=-176
        with self.assertRaisesRegex(ValueError,'stop_risk_budget_exceeded'):validate_stop_risk(self.native,self.position,exit_plan()['plan'])

    def test_partial_sl_preserves_outer_broker_sl_and_exact_remaining_volume(self):
        row=exit_plan('active');row['checkpoint'].update(sl=1.29,tp=1.32)
        self.api.positions_get.return_value=(fixtures.position(sl=1.29,tp=1.32),)
        self.api.symbol_info_tick.return_value.bid=1.294;self.api.symbol_info_tick.return_value.ask=1.2941
        request=self.broker.prepare(row,'stop_close',0)
        self.assertEqual(request['volume'],.01);self.assertEqual(request['position'],123)
        self.api.order_send.return_value=NS(retcode=10009,deal=777,volume=.01)
        self.api.positions_get.side_effect=[(fixtures.position(sl=1.29,tp=1.32),),(fixtures.position(volume=.01,sl=1.29,tp=1.32),)]
        self.assertEqual(self.broker.send(row,'stop_close',0,request),dict(status='executed',remaining_volume=.01,sl=1.29,tp=1.32,deal=777))

    def test_short_partial_sl_uses_ask_and_buy_close_without_changing_protection(self):
        row=exit_plan('active');row['plan'].update(direction='short',native_sl=1.31,native_tp=1.28,stops=[dict(price=1.305,volume=.01),dict(price=1.31,volume=.01)])
        row['checkpoint'].update(sl=1.31,tp=1.28)
        p=fixtures.position(sl=1.31,tp=1.28);p.type=1
        self.api.positions_get.return_value=(p,)
        tick=self.api.symbol_info_tick.return_value;tick.bid=1.3048;tick.ask=1.3049
        with self.assertRaisesRegex(ValueError,'target_not_reached'):self.broker.prepare(row,'stop_close',0)
        tick.ask=1.3051
        request=self.broker.prepare(row,'stop_close',0)
        self.assertEqual(request['type'],self.api.ORDER_TYPE_BUY);self.assertEqual(request['price'],1.3051);self.assertEqual(request['volume'],.01)
        self.api.order_send.return_value=NS(retcode=10009,deal=777,volume=.01)
        remaining=fixtures.position(volume=.01,sl=1.31,tp=1.28);remaining.type=1
        self.api.positions_get.side_effect=[(p,),(remaining,)]
        self.assertEqual(self.broker.send(row,'stop_close',0,request),dict(status='executed',remaining_volume=.01,sl=1.31,tp=1.28,deal=777))

    def test_unreached_or_stale_stop_cannot_send(self):
        row=exit_plan('active');row['checkpoint']['sl']=1.29;self.api.positions_get.return_value=(fixtures.position(),)
        with self.assertRaisesRegex(ValueError,'target_not_reached'):self.broker.prepare(row,'stop_close',0)
        self.api.symbol_info_tick.return_value.time=0
        with self.assertRaisesRegex(ValueError,'quote_stale'):self.broker.prepare(row,'stop_close',0)
        self.api.order_send.assert_not_called()


if __name__=='__main__':unittest.main()
