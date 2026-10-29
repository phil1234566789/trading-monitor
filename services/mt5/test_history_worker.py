import unittest
from types import SimpleNamespace as NS
from collections import namedtuple
from unittest.mock import Mock,patch
from history_worker import sync_history
Deal=namedtuple('Deal','ticket position_id time_msc type entry symbol volume price profit commission swap fee')
class HistoryTests(unittest.TestCase):
 def setup_sync(self):
  api=Mock();api.account_info.return_value=NS(login=42,server='Demo',currency='USD')
  api.history_deals_get.return_value=[Deal(1,2,10900000,1,0,'XAUUSD.gbe',.01,4020,0,-.05,0,0)]
  cloud=Mock()
  def call(action,body):
   if action=='history_context':return dict(account_login=42,account_server='Demo',full_due=True,since_sec=0)
   if action=='history_batch':return dict(recorded=len(body['deals']))
   return dict(recorded=True)
  cloud.call.side_effect=call
  return api,cloud
 def test_reads_and_normalises_without_orders(self):
  api,cloud=self.setup_sync()
  with patch('history_worker.time.time',return_value=100):sync_history(api,cloud,10800)
  batch=next(c.args[1] for c in cloud.call.call_args_list if c.args[0]=='history_batch')
  self.assertEqual(batch['deals'][0]['time_msc'],100000)
  self.assertEqual(cloud.call.call_args_list[-1].args[0],'history_complete')
  api.order_send.assert_not_called();api.login.assert_not_called()
 def test_account_change_and_failed_reads_never_mark_complete(self):
  for kind in ('switch','read'):
   api,cloud=self.setup_sync()
   if kind=='switch':api.account_info.side_effect=[NS(login=42,server='Demo',currency='USD'),NS(login=43,server='Demo')]
   else:api.history_deals_get.return_value=None
   with self.assertRaises(ValueError):sync_history(api,cloud,10800)
   self.assertNotIn('history_complete',[c.args[0] for c in cloud.call.call_args_list])
