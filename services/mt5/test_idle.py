import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

from core import Journal
from worker import Engine, IDLE_FALLBACK_SEC, IDLE_HEARTBEAT_SEC
from wake_listener import WakeListener


def engine(directory, wake=None, positions=0, orders=0):
    journal = Journal(Path(directory) / 'j.sqlite3').__enter__()
    broker = Mock()
    broker.api.positions_total.return_value = positions
    broker.api.orders_total.return_value = orders
    return Engine(broker, Mock(), journal, wake=wake)


class IdleTests(unittest.TestCase):
    def test_wake_sources(self):
        with tempfile.TemporaryDirectory() as d:
            wake = SimpleNamespace(event=threading.Event(), joined=True)
            e = engine(d, wake)
            e.idle_since = 100
            self.assertFalse(e.wake_due(100 + IDLE_HEARTBEAT_SEC - 1))
            self.assertTrue(e.wake_due(100 + IDLE_HEARTBEAT_SEC))
            wake.event.set()
            self.assertTrue(e.wake_due(101))
            self.assertFalse(wake.event.is_set())
            wake.joined = False
            self.assertTrue(e.wake_due(100 + IDLE_FALLBACK_SEC))
            e.journal.db.close()

    def test_local_exposure_wakes_without_db(self):
        with tempfile.TemporaryDirectory() as d:
            e = engine(d, SimpleNamespace(event=threading.Event(), joined=True), positions=1)
            e.idle_since = 100
            self.assertTrue(e.wake_due(101))
            e.broker.api.positions_total.return_value = None
            self.assertTrue(e.broker_exposed())
            e.cloud.call.assert_not_called()
            e.journal.db.close()

    def test_undelivered_guard_send_keeps_worker_busy(self):
        with tempfile.TemporaryDirectory() as d:
            e = engine(d)
            self.assertFalse(e.local_busy())
            with e.journal.db:
                e.journal.db.execute("INSERT INTO guard_sends(id,row) VALUES ('g','{}')")
            self.assertTrue(e.local_busy())
            e.journal.db.close()

    def test_cycle_sends_local_state_and_keeps_risk_context(self):
        with tempfile.TemporaryDirectory() as d:
            e = engine(d)
            e.daily_stop.broker = Mock(**{'exposure.return_value': dict(positions=[], orders=[])})
            e.cloud.call.return_value = dict(guard=dict(latched=False, commands=[]), plans=[], risk_context='ctx', idle=True)
            e.cycle(dict(), None)
            action, body = e.cloud.call.call_args.args
            self.assertEqual(action, 'cycle')
            self.assertIs(body['local_busy'], False)
            self.assertEqual(e.next_risk_context, 'ctx')
            e.cloud.call.return_value = dict(plans=[])
            with self.assertRaises(ValueError):
                e.cycle(dict(), None)
            e.journal.db.close()


class WakeListenerTests(unittest.TestCase):
    def test_join_and_broadcast(self):
        listener = WakeListener('wss://example.supabase.co/realtime/v1/websocket', 'key', 'topic')
        listener.handle(dict(topic='realtime:other', event='broadcast'))
        self.assertFalse(listener.event.is_set())
        listener.handle(dict(topic='realtime:topic', event='phx_reply', payload=dict(status='ok')))
        self.assertTrue(listener.joined)
        listener.handle(dict(topic='realtime:topic', event='broadcast', payload=dict(event='wake')))
        self.assertTrue(listener.event.is_set())
        with self.assertRaises(ConnectionError):
            listener.handle(dict(topic='realtime:topic', event='phx_error'))

    def test_rejects_plain_websocket(self):
        with self.assertRaises(ValueError):
            WakeListener('ws://example', 'key', 'topic')


if __name__ == '__main__':
    unittest.main()
