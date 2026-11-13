import os
from pathlib import Path
import tempfile
import types
import unittest
from contextlib import nullcontext
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
                 patch.dict(os.environ, {}, clear=True), patch('os.chdir') as chdir, patch('time.sleep'), \
                 patch('subprocess.Popen') as spawn, \
                 patch.dict('sys.modules', {'certifi': types.SimpleNamespace(where=lambda: 'trusted.pem'),
                    'worker': types.SimpleNamespace(main=lambda: None),
                    'worker_lock': types.SimpleNamespace(terminal_worker_lock=lambda path: nullcontext(),terminal_lock_path=lambda path:path)}), \
                 patch('sys.argv', []), patch('sys.path', []), patch('windows_account_launcher.__file__',str(root/'releases'/'pinned'/'windows_account_launcher.py')):
                launch(ACCOUNT, execute, root)
                import sys
                return dict(live=os.environ['MT5_ALLOW_LIVE'], argv=list(sys.argv), terminal=spawn.call_args.args[0],cwd=chdir.call_args.args[0],code=sys.path[0],journal=os.environ['MT5_JOURNAL_PATH'])

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

    def test_versioned_code_preserves_private_journal_and_legacy_working_directory(self):
        result=self.invoke(True)
        self.assertEqual(Path(result['code']).parts[-2:],('releases','pinned'))
        self.assertEqual(Path(result['argv'][0]).parent,Path(result['code']))
        self.assertEqual(Path(result['cwd']).parts[-3:],('app','services','mt5'))
        self.assertEqual(Path(result['journal']).parts[-4:],('private','accounts',ACCOUNT,'execution.sqlite3'))


if __name__ == '__main__':
    unittest.main()
