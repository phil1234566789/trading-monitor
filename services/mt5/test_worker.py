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

    def test_confirmed_market_needs_no_candle_and_executes_only_once(self):
        with tempfile.TemporaryDirectory() as directory, Journal(Path(directory)/'j.sqlite3') as journal:
            broker,cloud=Mock(),Mock()
            cloud.call.return_value=dict(authorized=True)
            broker.send.return_value=dict(status='executed',deal=123,volume=.01)
            order=intent(trigger='market_confirmed',reference_price=1.3,volume=.01,created_sec=240,expires_sec=270)
            engine=Engine(broker,cloud,journal)
            with patch('worker.time.time',return_value=241):
                engine.consider(order,241)
                engine.consider(order,241)
            broker.closed_m1.assert_not_called()
            broker.send.assert_called_once()

    def test_monitor_never_prepares_or_sends_an_order(self):
        with tempfile.TemporaryDirectory() as directory,Journal(Path(directory)/'j.sqlite3') as journal:
            broker,cloud=Mock(),Mock()
            Engine(broker,cloud,journal,execute=False).consider(intent(),241)
            broker.prepare.assert_not_called();broker.send.assert_not_called();cloud.call.assert_not_called()

    def test_directional_search_waits_for_matching_closed_color(self):
        with tempfile.TemporaryDirectory() as directory,Journal(Path(directory)/'j.sqlite3') as journal:
            broker,cloud=Mock(),Mock()
            cloud.call.return_value=dict(authorized=True)
            broker.send.return_value=dict(status='executed',deal=123,volume=.01)
            broker.closed_m1.return_value=dict(time=180,open=1.28,close=1.29)
            engine=Engine(broker,cloud,journal)
            order=intent(trigger='m1_directional_close',trigger_price=None,volume=.01)
            with patch('worker.time.time',return_value=241):
                engine.consider(order,241)
                broker.send.assert_not_called()
                broker.closed_m1.return_value=dict(time=180,open=1.30,close=1.29)
                engine.consider(order,241)
                engine.consider(order,241)
            broker.send.assert_called_once()
            self.assertEqual(journal.pending()[0]['result']['status'],'executed')

    def test_incomplete_success_is_reconciled_without_another_send(self):
        with tempfile.TemporaryDirectory() as directory,Journal(Path(directory)/'j.sqlite3') as journal:
            broker,cloud=Mock(),Mock()
            raw=dict(status='executed',retcode=10009,order=123,deal=0,price=0,volume=.01,magic=77)
            journal.reserve('order');journal.finish('order',raw)
            resolved=dict(raw,position=123,price=1.23456,confirmation_source='position_snapshot')
            broker.reconcile_result.side_effect=[None,resolved]
            cloud.call.return_value=dict(recorded=True)
            engine=Engine(broker,cloud,journal)
            with patch('worker.time.monotonic',return_value=10):engine.flush()
            self.assertEqual(cloud.call.call_args.args[1]['result']['status'],'unknown')
            self.assertEqual(len(journal.pending()),1)
            with patch('worker.time.monotonic',return_value=12):engine.flush()
            self.assertEqual(journal.pending(),[])
            self.assertEqual(cloud.call.call_args.args[1]['result']['price'],1.23456)
            broker.send.assert_not_called()

    def test_reported_fault_is_visible_and_disables_ready_without_leaking_text(self):
        with tempfile.TemporaryDirectory() as directory,Journal(Path(directory)/'j.sqlite3') as journal:
            broker,cloud=Mock(),Mock();broker.login=42;broker.server='Demo'
            broker.snapshot.return_value={};broker.quotes.return_value=[]
            engine=Engine(broker,cloud,journal)
            with patch('builtins.print'):
                engine.report_fault(AttributeError('password=private'))
            snapshot=engine.snapshot()
            self.assertFalse(snapshot['execution_ready'])
            self.assertEqual(snapshot['worker_error']['code'],'AttributeError')
            self.assertNotIn('private',str(cloud.call.call_args))
            self.assertEqual(cloud.call.call_args.args[0],'fault')

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
