import tempfile
import unittest
from pathlib import Path
from worker_lock import terminal_worker_lock, terminal_lock_path
from unittest.mock import patch


class WorkerLockTests(unittest.TestCase):
    def test_second_worker_is_blocked_and_lock_is_released(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'terminal.lock'
            with terminal_worker_lock(path):
                with self.assertRaisesRegex(ValueError, 'already_running'):
                    with terminal_worker_lock(path):
                        self.fail('duplicate worker entered')
            with terminal_worker_lock(path):
                pass

    def test_program_files_terminal_uses_writable_shared_lock(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict('os.environ',{'LOCALAPPDATA':folder}):
            terminal=Path('C:/Program Files/MT5/terminal64.exe')
            lock=terminal_lock_path(terminal)
            self.assertTrue(lock.is_relative_to(folder))
            self.assertEqual(lock,terminal_lock_path(terminal.parent / '.' / terminal.name))
            self.assertNotEqual(lock,terminal_lock_path('C:/Other/terminal64.exe'))
