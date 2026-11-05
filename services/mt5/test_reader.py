import unittest
from unittest.mock import Mock
from types import SimpleNamespace as NS
from reader import ReaderCloud,read_balance,connect
from tempfile import TemporaryDirectory
from pathlib import Path
class ReaderTests(unittest.TestCase):
    def test_no_trading_actions_even_before_network(self):
        cloud=ReaderCloud('https://example.test', 'x'*32)
        for action in ('poll','result','select_account','target_claim','guard_sync'):
            with self.assertRaises(ValueError):cloud.call(action,{})
    def test_native_snapshot_and_identity_are_checked_without_orders(self):
        api,cloud=Mock(),Mock();identity=dict(account_id='a',account_login=42,account_server='s')
        api.account_info.return_value=NS(login=42,server='s',balance=50000,equity=49990,currency='USD')
        api.positions_get.return_value=[];cloud.call.return_value={'recorded':True}
        read_balance(api,cloud,identity)
        self.assertEqual(cloud.call.call_args.args[0],'snapshot')
        self.assertEqual(cloud.call.call_args.args[1]['snapshot']['balance'],50000)
        api.order_send.assert_not_called();api.login.assert_not_called()
        cloud.reset_mock();api.account_info.return_value=NS(login=43,server='s')
        with self.assertRaises(ValueError):read_balance(api,cloud,identity)
        cloud.call.assert_not_called()

    def test_connect_requires_private_terminal_and_matching_portable_data_directory(self):
        api,cloud=Mock(),Mock()
        with TemporaryDirectory() as folder:
            path=Path(folder)/'terminal64.exe';path.write_bytes(b'test fixture')
            config=dict(account_id='test-account',terminal_path=str(path))
            with self.assertRaises(ValueError):connect(api,cloud,config)
            api.initialize.assert_not_called()
            (path.parent/'.mmt-read-only').write_text('test-account')
            cloud.call.side_effect=lambda *args:dict(account_login=42,account_server='Demo',password='test-only')
            api.initialize.return_value=True
            api.terminal_info.return_value=NS(connected=True,trade_allowed=False,path=folder,data_path=folder)
            self.assertEqual(connect(api,cloud,config)['account_login'],42)
            self.assertTrue(api.initialize.call_args.kwargs['portable'])
            api.terminal_info.return_value.data_path='C:/another-terminal'
            with self.assertRaises(ValueError):connect(api,cloud,config)
            api.order_send.assert_not_called();api.login.assert_not_called()
