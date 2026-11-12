from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock
from terminal_connection import initialize_terminal


class TerminalConnectionTests(TestCase):
    def test_selects_terminal_positionally_with_explicit_credentials_and_checks_identity(self):
        with TemporaryDirectory() as directory:
            path=Path(directory)/'terminal64.exe'
            api=Mock()
            api.terminal_info.return_value=SimpleNamespace(path=directory,data_path=directory)
            self.assertTrue(initialize_terminal(api,path,portable=True,login=42,server='s',password='test-only'))
            api.initialize.assert_called_once_with(str(path.resolve()),timeout=5000,portable=True,login=42,server='s',password='test-only')
            api.login.assert_not_called()
            api.order_send.assert_not_called()

    def test_wrong_returned_terminal_or_data_directory_is_disconnected_before_trading(self):
        with TemporaryDirectory() as directory:
            path=Path(directory)/'terminal64.exe'
            for terminal in [None,SimpleNamespace(path='wrong',data_path=directory),SimpleNamespace(path=directory,data_path='wrong')]:
                api=Mock();api.terminal_info.return_value=terminal
                with self.assertRaisesRegex(ValueError,'terminal_path_mismatch'):
                    initialize_terminal(api,path,portable=True,login=42,server='s',password='test-only')
                api.login.assert_not_called();api.order_send.assert_not_called();api.shutdown.assert_called_once()
