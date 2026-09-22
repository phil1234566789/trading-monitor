import unittest
from candles import closed_rows


class ClosedCandlesTest(unittest.TestCase):
    def candle(self, stamp='2026-09-16T06:00:00.000000000', **changes):
        return dict(Date=stamp, BidOpen=1.34909, BidHigh=1.34980,
                    BidLow=1.34802, BidClose=1.34827, Volume=1476, **changes)

    def test_current_bar_is_excluded_until_close(self):
        from datetime import datetime, timezone
        start = datetime(2026, 9, 16, 6, tzinfo=timezone.utc).timestamp()
        self.assertEqual([], closed_rows('GBPUSD', '5m', [self.candle()], start + 299))
        rows = closed_rows('GBPUSD', '5m', [self.candle()], start + 300)
        self.assertEqual(1.34980, rows[0]['high'])
        self.assertEqual('2026-09-16T06:00:00+00:00', rows[0]['time'])

    def test_invalid_prices_fail_without_uploading(self):
        item = self.candle()
        item['BidHigh'] = float('nan')
        with self.assertRaises(ValueError):
            closed_rows('GBPUSD', '5m', [item], 2000000000)

    def test_sdk_duplicates_are_deduplicated(self):
        self.assertEqual(1, len(closed_rows('GBPUSD', '5m', [self.candle(), self.candle()], 2000000000)))


if __name__ == '__main__':
    unittest.main()
