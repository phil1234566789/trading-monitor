import unittest
from types import SimpleNamespace as NS
from unittest.mock import Mock
from risk_snapshot import native_daily_risk,native_position

class NativeRiskTests(unittest.TestCase):
 def test_daily_net_counts_trade_costs_and_does_not_use_open_gains(self):
  api=Mock();context=dict(day='2026-10-31',day_start_sec=1000,day_end_sec=2000,latched=False)
  def deal(kind,profit,commission=0,stamp=1200):return NS(time_msc=stamp*1000,type=kind,profit=profit,commission=commission,swap=0,fee=0)
  api.history_deals_get.return_value=[deal(0,-400,-5),deal(1,100,-5),deal(7,-10),deal(2,50000),deal(0,-900,stamp=999)]
  rows=[NS(profit=300,swap=0),NS(profit=-200,swap=-1)]
  result=native_daily_risk(api,rows,context,0,1300)
  self.assertEqual(result['realized_net_day'],-320)
  self.assertEqual(result['open_loss'],-201)
  api.order_send.assert_not_called()
 def test_history_or_day_gap_is_unavailable_not_zero(self):
  api=Mock();api.history_deals_get.return_value=None
  for context in [None,dict(day='2026-10-31',day_start_sec=1000,day_end_sec=2000,latched=False)]:
   with self.assertRaises(ValueError):native_daily_risk(api,[],context,0,1300)
 def test_native_position_keeps_actual_time_and_zeroes_only_confirmed_positive_stop_profit(self):
  api=Mock();api.ORDER_TYPE_BUY=0;api.ORDER_TYPE_SELL=1;api.order_calc_profit.side_effect=[-250,-200]
  p=NS(ticket=1,symbol='XAUUSD.gbe',volume=.25,type=0,sl=4000,tp=4200,profit=50,magic=1,price_open=4100,price_current=4120,time=5000)
  value=native_position(api,p,3600)
  self.assertEqual(value['opened_at_sec'],1400);self.assertEqual(value['risk_to_sl'],250)
  p.sl=0;self.assertIsNone(native_position(api,p,3600)['risk_to_sl'])

if __name__=='__main__':unittest.main()
