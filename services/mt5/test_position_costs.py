import unittest
import time
from threading import Event
from unittest.mock import Mock
from types import SimpleNamespace as NS
from position_costs import PositionCosts

class PositionCostsTests(unittest.TestCase):
    def setUp(self):
        self.broker=Mock(login=42,server='Demo',server_time_offset_seconds=3600)
        account=NS(login=42,server='Demo',currency='USD');self.broker.account.return_value=(account,None)
        self.broker.api.positions_get.return_value=(NS(ticket=123,identifier=120,symbol='XAUUSD',type=0,volume=1),)
        self.deal=NS(_asdict=lambda:dict(ticket=7,position_id=120,time_msc=4000000,type=0,entry=0,symbol='XAUUSD',volume=1,price=3900,profit=0,commission=-5,swap=0,fee=0))
        self.broker.api.history_deals_get.return_value=(self.deal,)
        self.cloud=Mock();self.cloud.call.return_value={'recorded':1};self.costs=PositionCosts(self.broker,self.cloud);self.addCleanup(self.costs.uploads.shutdown)
    def test_new_position_read_is_targeted_once_cached_and_does_not_mark_history_complete(self):
        self.costs.sync();self.costs.pending[1].result(timeout=1);self.costs.sync()
        self.broker.api.history_deals_get.assert_called_once_with(position=120)
        self.cloud.call.assert_called_once()
        action,body=self.cloud.call.call_args.args
        self.assertEqual(action,'history_batch');self.assertEqual(body['deals'][0]['time_msc'],400000)
        self.assertEqual(body['deals'][0]['commission'],-5)
    def test_missing_deals_back_off_without_treating_unknown_fees_as_zero(self):
        self.broker.api.history_deals_get.return_value=None;self.costs.sync();self.costs.sync()
        self.broker.api.history_deals_get.assert_called_once();self.cloud.call.assert_not_called();self.assertNotIn(120,self.costs.done)
    def test_changed_account_never_uploads_deals(self):
        self.broker.account.side_effect=[(NS(login=42,server='Demo',currency='USD'),None),(NS(login=99,server='Demo'),None)]
        with self.assertRaisesRegex(ValueError,'position_cost_account_changed'):self.costs.sync()
        self.cloud.call.assert_not_called()

    def test_slow_https_cost_upload_does_not_delay_the_next_protection_cycle(self):
        blocked=Event();started=Event()
        def upload(*args):started.set();blocked.wait(2);return {'recorded':1}
        self.cloud.call.side_effect=upload
        try:
            self.costs.sync();self.assertTrue(started.wait(1));start=time.monotonic()
            for _ in range(10):self.costs.sync()
            self.assertLess(time.monotonic()-start,.1)
            self.assertNotIn(120,self.costs.done)
            self.broker.api.history_deals_get.assert_called_once_with(position=120)
        finally:blocked.set()

    def test_partial_deal_visibility_is_not_cached_as_complete(self):
        self.broker.api.positions_get.return_value=(NS(ticket=123,identifier=120,symbol='XAUUSD',type=0,volume=2),)
        self.costs.sync();self.cloud.call.assert_not_called();self.assertNotIn(120,self.costs.done)
        self.assertGreater(self.costs.retry_at[120],time.monotonic())
