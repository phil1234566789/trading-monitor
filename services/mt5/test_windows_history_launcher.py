import os
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock, patch
from windows_history_launcher import launch

ACCOUNT = '58ef24f2-96d8-464f-9d09-5f00af282f4d'


class HistoryLauncherTests(TestCase):
    def test_history_uses_explicit_account_without_starting_or_enabling_execution(self):
        with TemporaryDirectory() as folder:
            root = Path(folder)
            config = root / 'private' / 'worker.env'
            settings = dict(MT5_TERMINAL_PATH=str(root / 'terminal' / 'terminal64.exe'), MT5_ALLOW_LIVE='true')
            main = Mock(return_value=0)
            with patch('windows_history_launcher.worker_settings', return_value=settings), \
                 patch.dict(os.environ, {}, clear=True), patch('subprocess.Popen') as spawn, \
                 patch.dict('sys.modules', {'certifi': SimpleNamespace(where=lambda: 'trusted.pem'),
                                           'history_worker': SimpleNamespace(main=main)}):
                self.assertEqual(launch(ACCOUNT, config, root), 0)
                self.assertEqual(os.environ['MT5_ALLOW_LIVE'], 'false')
                self.assertEqual(os.environ['MT5_ACCOUNT_ID'], ACCOUNT)
                main.assert_called_once_with()
                spawn.assert_not_called()

    def test_wrong_account_or_terminal_is_rejected_before_reading_history(self):
        with TemporaryDirectory() as folder:
            root = Path(folder)
            for settings in [dict(MT5_ACCOUNT_ID='other', MT5_TERMINAL_PATH=str(root / 'terminal' / 'terminal64.exe')),
                             dict(MT5_TERMINAL_PATH=str(root / 'other' / 'terminal64.exe'))]:
                with patch('windows_history_launcher.worker_settings', return_value=settings):
                    with self.assertRaisesRegex(ValueError, 'history_account_configuration_mismatch'):
                        launch(ACCOUNT, root / 'private' / 'worker.env', root)
