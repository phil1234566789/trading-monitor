import time
import unittest
from types import SimpleNamespace as NS
from test_broker import api
from test_core import intent
from broker import Broker

class DynamicBrokerRiskTests(unittest.TestCase):
 def configured(self):
  m=api();m.ACCOUNT_MARGIN_MODE_RETAIL_HEDGING=2;m.account_info.return_value.margin_mode=2
  m.history_deals_get.return_value=[]
  m.order_calc_profit.side_effect=lambda side,symbol,volume,entry,exit:(exit-entry)*volume*100000*(1 if side==0 else -1)
  broker=Broker(m,42,'Demo');now=int(time.time())
  policy=dict(revision='c297afbf-172c-4304-99e7-eb1198191050',day='2026-10-31',confirmed_balance=50000,confirmed_equity=50000,risk_base=50000,cost_buffer=10,currency='USD',drawdown_floor=47000,valid_until_sec=now+1000)
  broker.risk_context=dict(policy=policy,day=policy['day'],day_start_sec=now-100,day_end_sec=now+1000,latched=False,daily_stop_ready=True,checked_at_sec=now)
  return broker,m
 def order(self,**extra):return intent(trigger='m1_directional_close',trigger_price=None,volume=.01,risk_amount=1000,risk_mode='risky',risk_policy_revision='c297afbf-172c-4304-99e7-eb1198191050',**extra)
 def test_dynamic_size_recomputed_before_send_and_old_pilot_stays_capped(self):
  broker,m=self.configured();request=broker.prepare(self.order())
  self.assertEqual(request['volume'],.24)
  value=self.order();value['risk_mode']='full';self.assertEqual(broker.prepare(value)['volume'],.44)
  del value['risk_mode'];del value['risk_policy_revision'];self.assertEqual(broker.prepare(value)['volume'],.01)
  m.order_send.assert_not_called()
 def test_existing_risky_leaves_only_joint_market_remainder(self):
  broker,m=self.configured();m.positions_get.return_value=[NS(ticket=1,symbol='GBPUSD.gbe',type=0,volume=.25,sl=1.29,tp=0,profit=0,swap=0,magic=1,price_open=1.3,price_current=1.3,time=int(time.time()))]
  self.assertEqual(broker.prepare(self.order())['volume'],.18)
  m.order_send.assert_not_called()
 def test_async_placeholder_never_bypasses_native_sizing_or_fresh_tick(self):
  broker,m=self.configured();value=self.order();value['volume']=.01
  self.assertEqual(broker.prepare(value)['volume'],.24)
  m.symbol_info_tick.return_value.time=int(time.time())-30
  with self.assertRaisesRegex(ValueError,'quote_stale'):broker.prepare(value)
  m.order_send.assert_not_called()
 def test_all_modes_require_daily_guard_and_no_unbounded_time_context(self):
  for mutation in ['history','latch','stale']:
   broker,m=self.configured();value=self.order();del value['risk_mode'];del value['risk_policy_revision']
   if mutation=='history':m.history_deals_get.return_value=None
   elif mutation=='latch':broker.risk_context['latched']=True
   else:broker.risk_context['checked_at_sec']-=6
   with self.assertRaises(ValueError):broker.prepare(value)
   m.order_send.assert_not_called()
 def test_pilot_cannot_bypass_remaining_daily_budget_or_missing_policy(self):
  for missing in [True,False]:
   broker,m=self.configured();value=self.order();del value['risk_mode'];del value['risk_policy_revision']
   if missing:broker.risk_context['policy']=None
   else:
    m.history_deals_get.return_value=[NS(time_msc=int(time.time())*1000,type=0,profit=-995,commission=0,swap=0,fee=0)]
   with self.assertRaises(ValueError):broker.prepare(value)
   m.order_send.assert_not_called()
 def test_missing_floor_unknown_history_or_latch_never_sizes(self):
  for mutation in ['policy','history','latch']:
   broker,m=self.configured()
   if mutation=='policy':broker.risk_context['policy']=None
   elif mutation=='history':m.history_deals_get.return_value=None
   else:broker.risk_context['latched']=True
   with self.assertRaises(ValueError):broker.prepare(self.order())
   m.order_send.assert_not_called()

if __name__=='__main__':unittest.main()
