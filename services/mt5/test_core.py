import math
import tempfile
import unittest
from pathlib import Path

from core import Journal, trigger_matches, volume_for_risk, validate_intent


def intent(**changes):
    value = dict(id='c297afbf-172c-4304-99e7-eb1198191050', account_login=42,
                 account_server='Demo', symbol='GBPUSD', direction='short',
                 stop_loss=1.31, take_profit=1.28, risk_amount=2,
                 trigger='m1_close_below', trigger_price=1.30,
                 created_sec=120, expires_sec=600, mode='demo')
    return value | changes


class CoreTests(unittest.TestCase):
    def test_rejects_invalid_numbers_and_missing_risk(self):
        for key in ['stop_loss', 'risk_amount', 'trigger_price']:
            for bad in [None, True, math.nan, math.inf, -1, 0, '2']:
                with self.subTest(key=key, value=bad), self.assertRaises(ValueError):
                    validate_intent(intent(**{key: bad}))

    def test_directional_close_uses_new_closed_red_or_green_candle(self):
        short=intent(trigger='m1_directional_close',trigger_price=None,volume=.01)
        long=short|dict(direction='long')
        red=dict(time=180,open=1.30,close=1.29)
        green=dict(time=180,open=1.28,close=1.29)
        self.assertEqual(validate_intent(short),short)
        self.assertTrue(trigger_matches(short,red,241))
        self.assertFalse(trigger_matches(short,green,241))
        self.assertTrue(trigger_matches(long,green,241))
        self.assertFalse(trigger_matches(long,red,241))
        for candle,now in [(dict(time=180,open=1.29,close=1.29),241),
                           (dict(time=180,close=1.29),241),(red,239),(red,251),
                           (dict(time=60,open=1.3,close=1.29),121)]:
            self.assertFalse(trigger_matches(short,candle,now))

    def test_live_requires_explicit_local_opt_in(self):
        with self.assertRaises(ValueError):
            validate_intent(intent(mode='live'))
        self.assertEqual(validate_intent(intent(mode='live'), allow_live=True)['mode'], 'live')

    def test_trigger_only_uses_fresh_closed_bars_after_activation(self):
        order = intent()
        self.assertTrue(trigger_matches(order, dict(time=180, close=1.29), 241))
        self.assertTrue(trigger_matches(intent(created_sec=200), dict(time=180, close=1.29), 241))
        for candle, now in [(dict(time=60, close=1.29), 121),
                            (dict(time=180, close=1.29), 239),
                            (dict(time=180, close=1.29), 260),
                            (dict(time=540, close=1.29), 600)]:
            self.assertFalse(trigger_matches(order, candle, now))

    def test_demo_next_close_is_not_a_strategy(self):
        order = intent(trigger='test_next_m1_close', trigger_price=None)
        self.assertTrue(trigger_matches(order, dict(time=180, close=1.4), 241))
        with self.assertRaises(ValueError):
            validate_intent(order | dict(mode='live'), allow_live=True)

    def test_long_and_short_price_thresholds(self):
        self.assertTrue(trigger_matches(intent(direction='long', trigger='m1_close_above'),
                                        dict(time=180, close=1.301), 241))
        self.assertFalse(trigger_matches(intent(), dict(time=180, close=1.30), 241))

    def test_lots_round_down_and_never_raise_to_broker_minimum(self):
        self.assertEqual(volume_for_risk(1.51, 100, .01, 10, .01, .01), .01)
        with self.assertRaises(ValueError):
            volume_for_risk(.5, 100, .01, 10, .01, .01)
        self.assertEqual(volume_for_risk(5, 123, .001, 10, .001, .01), .01)

    def test_persisted_reservation_cannot_be_reused_after_restart(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'journal.sqlite3'
            with Journal(path) as first:
                self.assertTrue(first.reserve(intent()['id']))
                self.assertFalse(first.reserve(intent()['id']))
            with Journal(path) as second:
                self.assertFalse(second.reserve(intent()['id']))
                self.assertEqual(second.pending()[0]['id'], intent()['id'])


if __name__ == '__main__':
    unittest.main()
