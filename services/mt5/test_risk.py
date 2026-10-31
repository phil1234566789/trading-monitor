import math
import unittest
from risk import risk_budget, risk_volume

class RiskTests(unittest.TestCase):
    def test_joint_market_and_daily_budget(self):
        policy=dict(day='2026-10-31',confirmed_balance=50000,confirmed_equity=50000,risk_base=50000,cost_buffer=10,currency='USD',drawdown_floor=47000,valid_until_sec=1060,revision='rev')
        snapshot=dict(balance=50000,equity=50000,currency='USD',hedging=True,pending_orders=0,risk_guards_ready=True,
                      risk=dict(day='2026-10-31',time=1000,realized_net_day=0,open_loss=0,latched=False),
                      positions=[dict(symbol='GBPUSD.gbe',risk_to_sl=240,remaining_risk_to_sl=240)])
        self.assertAlmostEqual(risk_budget('full','GBPUSD.gbe',snapshot,policy,1000)['available'],190)
        self.assertAlmostEqual(risk_budget('full','XAUUSD.gbe',snapshot,policy,1000)['available'],440)
        self.assertEqual(risk_budget('risky','XAUUSD.gbe',snapshot,policy,1000)['requested'],250)
        with self.assertRaisesRegex(ValueError,'risk_limits_unconfirmed'):
            risk_budget('full','XAUUSD.gbe',snapshot,{**policy,'risk_base':51000},1000)
        snapshot['risk']['realized_net_day']=-700
        self.assertAlmostEqual(risk_budget('full','GBPUSD.gbe',snapshot,policy,1000)['available'],40)
        snapshot['risk']['latched']=True
        with self.assertRaises(ValueError):risk_budget('full','GBPUSD.gbe',snapshot,policy,1000)
    def test_native_step(self):
        self.assertEqual(risk_volume(250,1000,.01,100,.01),.25)
        with self.assertRaises(ValueError):risk_volume(1,1000,.01,100,.01)

if __name__=='__main__':unittest.main()
