import os
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch
from windows_account_launcher import launch

ACCOUNT = '58ef24f2-96d8-464f-9d09-5f00af282f4d'


class WindowsAccountLauncherTests(unittest.TestCase):
    def invoke(self, execute=False, permitted=True, wrong_account=False):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            config = dict(MT5_ACCOUNT_ID=ACCOUNT if not wrong_account else 'other',
                          MT5_TERMINAL_PATH=str(root / 'accounts' / ACCOUNT / 'terminal64.exe'),
                          MT5_JOURNAL_PATH=str(root / 'private' / 'accounts' / ACCOUNT / 'execution.sqlite3'),
                          MT5_ALLOW_LIVE=str(permitted).lower())
            with patch.object(Path, 'read_text', return_value='\n'.join(k+'='+v for k,v in config.items())), \
                 patch.dict(os.environ, {}, clear=True), patch('os.chdir'), patch('time.sleep'), \
                 patch('subprocess.Popen') as spawn, patch('runpy.run_path') as run, \
                 patch.dict('sys.modules', {'certifi': types.SimpleNamespace(where=lambda: 'trusted.pem')}), \
                 patch('sys.argv', []), patch('sys.path', []):
                launch(ACCOUNT, execute, root)
                import sys
                return dict(live=os.environ['MT5_ALLOW_LIVE'], argv=list(sys.argv), terminal=spawn.call_args.args[0], run=run.called)

    def test_monitor_cannot_trade_even_when_config_permits_live(self):
        result = self.invoke()
        self.assertEqual(result['live'], 'false')
        self.assertIn('--monitor', result['argv'])
        self.assertIn(ACCOUNT, result['terminal'][-1])
        self.assertTrue(result['terminal'][-1].endswith('read-only.ini'))

    def test_execute_needs_private_permission_and_uses_own_terminal(self):
        with self.assertRaisesRegex(ValueError, 'execution_not_enabled'):
            self.invoke(True, False)
        result = self.invoke(True)
        self.assertNotIn('--monitor', result['argv'])
        self.assertTrue(result['terminal'][-1].endswith('trading.ini'))

    def test_wrong_account_configuration_is_rejected_before_start(self):
        with self.assertRaisesRegex(ValueError, 'account_configuration_mismatch'):
            self.invoke(wrong_account=True)


if __name__ == '__main__':
    unittest.main()
