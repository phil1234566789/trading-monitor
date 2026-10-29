import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from core import Journal
from worker import Engine
from test_core import intent


class WorkerTests(unittest.TestCase):
    def test_precheck_rejection_does_not_starve_next_intent(self):
        with tempfile.TemporaryDirectory() as directory, Journal(Path(directory) / 'j.sqlite3') as journal:
            broker, cloud = Mock(), Mock()
            broker.closed_m1.return_value = dict(time=180, close=1.29)
            broker.prepare.side_effect = [ValueError('invalid_stop_side_or_distance'), {}, {}]
            cloud.call.return_value = dict(authorized=True, recorded=True)
            broker.send.return_value = dict(status='executed', deal=123, volume=.01)
            engine=Engine(broker,cloud,journal)
            with patch('worker.time.time',return_value=241):
                engine.consider(intent(),241)
                engine.consider(intent(id='e297afbf-172c-4304-99e7-eb1198191050'),241)
            self.assertEqual(broker.send.call_count,1)
            self.assertEqual(cloud.call.call_args_list[0].args[0],'reject_search')
    def test_trigger_executes_once_and_preserves_result_on_cloud_failure(self):
        with tempfile.TemporaryDirectory() as directory, Journal(Path(directory) / 'j.sqlite3') as journal:
            broker, cloud = Mock(), Mock()
            broker.closed_m1.return_value = dict(time=180, close=1.29)
            broker.send.return_value = dict(status='executed', deal=123, volume=.01)
            cloud.call.return_value = dict(authorized=True)
            engine = Engine(broker, cloud, journal)
            with patch('worker.time.time', return_value=241):
                engine.consider(intent(), 241)
                engine.consider(intent(), 241)
            self.assertEqual(broker.send.call_count, 1)
            self.assertEqual(journal.pending()[0]['result']['deal'], 123)

    def test_no_authorization_no_trigger_no_trade(self):
        with tempfile.TemporaryDirectory() as directory, Journal(Path(directory) / 'j.sqlite3') as journal:
            broker, cloud = Mock(), Mock()
            broker.closed_m1.return_value = dict(time=180, close=1.29)
            cloud.call.return_value = dict(authorized=False)
            Engine(broker, cloud, journal).consider(intent(), 241)
            broker.send.assert_not_called()
            self.assertEqual(journal.pending(), [])

    def test_exception_during_send_stays_unknown_even_if_it_is_a_value_error(self):
        with tempfile.TemporaryDirectory() as directory, Journal(Path(directory) / 'j.sqlite3') as journal:
            broker, cloud = Mock(), Mock()
            broker.closed_m1.return_value = dict(time=180, close=1.29)
            cloud.call.return_value = dict(authorized=True)
            broker.send.side_effect = ValueError('response decoding failed after send')
            with patch('worker.time.time', return_value=241):
                Engine(broker, cloud, journal).consider(intent(), 241)
            self.assertEqual(journal.pending()[0]['result']['status'], 'unknown')

    def test_crash_reservation_reports_unknown_and_never_retries_broker(self):
        with tempfile.TemporaryDirectory() as directory, Journal(Path(directory) / 'j.sqlite3') as journal:
            broker, cloud = Mock(), Mock()
            journal.reserve(intent()['id'])
            cloud.call.return_value = dict(recorded=True)
            Engine(broker, cloud, journal).flush()
            self.assertEqual(cloud.call.call_args.args[1]['result']['status'], 'unknown')
            self.assertEqual(journal.pending(), [])
            self.assertFalse(journal.reserve(intent()['id']))
            broker.send.assert_not_called()


if __name__ == '__main__':
    unittest.main()
