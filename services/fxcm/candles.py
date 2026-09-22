"""Normalisierung der nativen FXCM-Bid-Kerzen, unabhängig vom SDK testbar."""
import math
from datetime import datetime, timezone

PERIODS = {'1m': ('m1', 60), '3m': ('m3', 180), '5m': ('m5', 300), '15m': ('m15', 900),
           '1h': ('H1', 3600), '4h': ('H4', 14400), '1D': ('D1', 86400)}


def closed_rows(instrument, bar, history, now):
    seconds = PERIODS[bar][1]
    rows = {}
    for item in history:
        stamp = str(item['Date']).replace('Z', '+00:00')
        # numpy liefert Nanosekunden; datetime verarbeitet Mikrosekunden.
        start = datetime.fromisoformat(stamp[:26]).replace(tzinfo=timezone.utc)
        timestamp = int(start.timestamp())
        if timestamp + seconds > now:
            continue
        values = [float(item[k]) for k in ('BidOpen', 'BidHigh', 'BidLow', 'BidClose', 'Volume')]
        o, h, low, c, volume = values
        if not all(math.isfinite(v) for v in values) or low <= 0 or volume < 0 or not low <= min(o, c) <= max(o, c) <= h:
            raise ValueError('Invalid FXCM candle')
        rows[timestamp] = dict(instrument=instrument, bar=bar, time=start.isoformat(),
                               open=o, high=h, low=low, close=c, volume=volume)
    return [rows[t] for t in sorted(rows)]
