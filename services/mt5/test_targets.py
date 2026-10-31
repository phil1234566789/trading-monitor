import sqlite3
import unittest
from types import SimpleNamespace as NS
from unittest.mock import Mock
from target_worker import TargetEngine
from target_broker import TargetBroker
from test_broker import api
from broker import Broker


def plan(state='pending',targets=None,native_tp=0):
    return dict(order_id='e297afbf-172c-4304-99e7-eb1198191050',revision='71d185ed-66d8-4ef7-a34a-3935726e774b',state=state,next_index=0,
        checkpoint=dict(volume=.02,sl=1.29,tp=0),plan=dict(account_login=42,account_server='Demo',mode='demo',position=123,symbol='EURUSD',direction='long',magic=77,
        entry_price=1.3,initial_sl=1.29,filled_volume=.02,native_tp=native_tp,targets=targets or [dict(price=1.31,volume=.01),dict(price=1.32,volume=.01)]))


def position(volume=.02,sl=1.29,tp=0):
    return NS(ticket=123,symbol='EURUSD',type=0,magic=77,volume=volume,sl=sl,tp=tp)


class TargetEngineTests(unittest.TestCase):
    def engine(self):
        cloud=Mock();cloud.call.return_value=dict(authorized=True,recorded=True)
        db=sqlite3.connect(':memory:');self.addCleanup(db.close)
        engine=TargetEngine(Mock(),cloud,db,True)
        engine.broker=Mock();engine.broker.position.return_value=position()
        engine.broker.prepare.return_value={};engine.broker.send.return_value=dict(status='executed',remaining_volume=.02,sl=1.29,tp=0)
        return engine,cloud,db

    def test_pending_installs_after_explicit_save_and_never_mutates_sl(self):
        engine,cloud,_=self.engine();engine.consider(plan())
        self.assertEqual(cloud.call.call_args.args[0],'target_claim')
        self.assertEqual(cloud.call.call_args.kwargs,{})
        self.assertEqual(engine.broker.send.call_args.args[1:3],('install',-1))
        engine.flush();self.assertEqual(cloud.call.call_args.args[1]['result']['sl'],1.29)

    def test_changed_manual_volume_or_sl_pauses_instead_of_closing(self):
        for field,value in [('volume',.01),('sl',1.295),('tp',1.32)]:
            engine,cloud,_=self.engine();p=position();setattr(p,field,value);engine.broker.position.return_value=p
            engine.consider(plan('active'));engine.broker.send.assert_not_called()
            self.assertEqual(cloud.call.call_args.args[1]['reason'],'broker_position_changed')

    def test_restart_after_reservation_reports_unknown_without_close_retry(self):
        engine,cloud,db=self.engine()
        body='{"order_id":"x","revision":"y"}'
        db.execute("INSERT INTO target_sends(id,body) VALUES ('reserved',?)",(body,));db.commit()
        engine.flush();engine.broker.send.assert_not_called()
        self.assertEqual(cloud.call.call_args.args[1]['result']['status'],'unknown')
        self.assertEqual(db.execute('SELECT delivered FROM target_sends').fetchone()[0],1)

    def test_lost_cloud_ack_replays_result_only(self):
        engine,cloud,db=self.engine();engine.consider(plan())
        cloud.call.side_effect=OSError('network')
        with self.assertRaises(OSError):engine.flush()
        cloud.call.side_effect=None;cloud.call.return_value=dict(recorded=True)
        engine.flush();self.assertEqual(engine.broker.send.call_count,1)

    def test_reservation_rejection_and_unknown_state_never_send(self):
        engine,cloud,_=self.engine();cloud.call.return_value=dict(authorized=False)
        engine.consider(plan());engine.consider(plan('unknown'));engine.broker.send.assert_not_called()

    def test_second_precheck_failure_does_not_send(self):
        engine,cloud,_=self.engine();engine.broker.prepare.side_effect=[{},ValueError('manual close')]
        engine.consider(plan());engine.broker.send.assert_not_called();engine.flush()
        self.assertEqual(cloud.call.call_args.args[1]['result']['status'],'rejected')

    def test_native_tp_is_broker_managed_and_monitor_has_no_send_path(self):
        engine,cloud,_=self.engine();row=plan('active',native_tp=1.32);row['checkpoint']['tp']=1.32;engine.broker.position.return_value=position(tp=1.32)
        engine.consider(row);engine.broker.prepare.assert_not_called()
        engine.execute=False;engine.consider(plan());engine.broker.send.assert_not_called()


class TargetBrokerTests(unittest.TestCase):
    def setUp(self):
        self.api=api();self.api.TRADE_ACTION_SLTP=6;self.api.TRADE_RETCODE_DONE=10009
        self.api.positions_get.return_value=(position(),)
        self.broker=TargetBroker(Broker(self.api,42,'Demo'))

    def test_tp_install_keeps_real_broker_sl(self):
        row=plan(native_tp=1.32);row['plan']['targets']=[dict(price=1.32,volume=.02)]
        request=self.broker.prepare(row,'install',-1)
        self.assertEqual(request,dict(action=6,position=123,symbol='EURUSD',sl=1.29,tp=1.32))

    def test_partial_close_has_position_ticket_and_native_step(self):
        self.api.symbol_info_tick.return_value.bid=1.315
        self.api.symbol_info_tick.return_value.ask=1.3151
        request=self.broker.prepare(plan('active'),'close',0)
        self.assertEqual(request['position'],123);self.assertEqual(request['type'],1);self.assertEqual(request['volume'],.01)
        row=plan('active');row['plan']['targets'][0]['volume']=.005
        with self.assertRaisesRegex(ValueError,'close_volume_changed'):self.broker.prepare(row,'close',0)

    def test_manual_change_after_prepare_is_rejected_without_broker_send(self):
        for changed in (position(sl=1.295),position(volume=.01),position(tp=1.33)):
            row=plan(native_tp=1.32);request=self.broker.prepare(row,'install',-1)
            self.api.positions_get.return_value=(changed,)
            result=self.broker.send(row,'install',-1,request)
            self.assertEqual(result['status'],'rejected');self.api.order_send.assert_not_called()
            self.api.positions_get.return_value=(position(),)

    def test_partial_fill_or_missing_deal_is_unknown_not_retryable(self):
        self.api.order_send.return_value=NS(retcode=10009,deal=999,volume=.005)
        self.assertEqual(self.broker.send(plan('active'),'close',0,{'position':123})['status'],'unknown')

    def test_verified_close_result_keeps_remaining_stop(self):
        self.api.order_send.return_value=NS(retcode=10009,deal=999,volume=.01)
        self.api.positions_get.side_effect=[(position(),),(position(volume=.01),)]
        self.assertEqual(self.broker.send(plan('active'),'close',0,{}),dict(status='executed',deal=999,remaining_volume=.01,sl=1.29,tp=0))

if __name__=='__main__':unittest.main()
