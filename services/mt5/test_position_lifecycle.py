import unittest
from types import SimpleNamespace as NS
from reconciliation import position_lifecycle

def deal(**values):
    return NS(**(dict(ticket=1,order=123,position_id=123,magic=77,symbol='EURUSD',type=0,entry=0,
      reason=3,volume=.01,price=1.1,time=1000,profit=0,commission=-.05,swap=0,fee=0)|values))

class PositionLifecycleTests(unittest.TestCase):
    def test_tp_is_confirmed_by_closed_broker_deals_with_real_exit_and_net_profit(self):
        rows=[deal(),deal(ticket=2,order=456,type=1,entry=1,reason=5,price=1.101,time=1100,profit=1,commission=0)]
        state=position_lifecycle(dict(order=123,position=123,magic=77,volume=.01),dict(symbol='EURUSD'),[],rows,0,'USD')
        self.assertEqual(state['state'],'closed')
        self.assertEqual(state['close_reason'],'tp')
        self.assertEqual(state['exit_price'],1.101)
        self.assertAlmostEqual(state['net_profit'],.95)
    def test_missing_position_alone_is_never_claimed_as_tp(self):
        state=position_lifecycle(dict(order=123,position=123,magic=77,volume=.01),dict(symbol='EURUSD'),[],[],0,'USD')
        self.assertEqual(state['state'],'unverified')
    def test_live_position_is_open_and_partial_close_is_not_a_full_exit(self):
        result=dict(order=123,position=123,magic=77,volume=.01)
        p=NS(ticket=123,magic=77,symbol='EURUSD',volume=.005)
        self.assertEqual(position_lifecycle(result,dict(symbol='EURUSD'),[p],[],0,'USD')['state'],'open')
        rows=[deal(),deal(ticket=2,order=456,type=1,entry=1,reason=5,volume=.005)]
        self.assertEqual(position_lifecycle(result,dict(symbol='EURUSD'),[],rows,0,'USD')['state'],'unverified')
