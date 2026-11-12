from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from history_mailbox import HistoryMailbox

FIRST='2026-11-12T21:00:00+00:00'
SECOND='2026-11-12T21:01:00+00:00'


class HistoryMailboxTests(TestCase):
    def test_idle_has_no_work_and_completed_request_is_not_replayed_after_restart(self):
        with TemporaryDirectory() as folder:
            path=Path(folder)/'history.request'
            mailbox=HistoryMailbox(path)
            mailbox.request(None)
            self.assertIsNone(mailbox.pending())
            self.assertFalse(path.exists())
            mailbox.request(FIRST)
            self.assertEqual(mailbox.pending(),FIRST)
            mailbox.finish(FIRST)
            self.assertIsNone(HistoryMailbox(path).pending())
            mailbox.request(FIRST)
            self.assertIsNone(mailbox.pending())

    def test_new_request_during_import_is_not_lost(self):
        with TemporaryDirectory() as folder:
            mailbox=HistoryMailbox(Path(folder)/'history.request')
            mailbox.request(FIRST)
            mailbox.request(SECOND)
            mailbox.finish(FIRST)
            self.assertEqual(mailbox.pending(),SECOND)

    def test_invalid_or_naive_requests_are_rejected(self):
        with TemporaryDirectory() as folder:
            mailbox=HistoryMailbox(Path(folder)/'history.request')
            for value in (42,'bad','2026-11-12T21:00:00'):
                with self.assertRaises(ValueError):mailbox.request(value)
