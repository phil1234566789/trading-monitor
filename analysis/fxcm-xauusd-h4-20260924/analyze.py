"""Lokale Prüfung des isolierten H4-Abrufs; keinerlei Netz- oder DB-Zugriff."""
import csv
import json
import math
from collections import Counter
from datetime import datetime
from pathlib import Path
from statistics import median
from zoneinfo import ZoneInfo

root = Path(__file__).resolve().parent
raw = next(line[len('PROBE_JSON='):] for line in (root / 'result.txt').read_text().splitlines() if line.startswith('PROBE_JSON='))
data = json.loads(raw)
(root / 'candles.json').write_text(json.dumps(data, indent=2) + '\n')
berlin = ZoneInfo('Europe/Berlin')
summary = {'offers': data['offers'], 'instruments': {}}
tr_by_symbol = {}
for symbol, dataset in data['instruments'].items():
    rows = dataset['candles']
    times = [datetime.fromisoformat(r['time']) for r in rows]
    errors = []
    for i, r in enumerate(rows):
        vals = [r[k] for k in ('open', 'high', 'low', 'close')]
        if not all(math.isfinite(v) and v > 0 for v in vals) or not r['low'] <= min(r['open'], r['close']) <= max(r['open'], r['close']) <= r['high']:
            errors.append(i)
    tr = {r['time']: max(r['high'] - r['low'], abs(r['high'] - rows[i-1]['close']), abs(r['low'] - rows[i-1]['close'])) for i, r in enumerate(rows) if i}
    tr_by_symbol[symbol] = tr
    gaps = [{'from_berlin': a.astimezone(berlin).isoformat(), 'to_berlin': b.astimezone(berlin).isoformat(), 'start_distance_hours': (b-a).total_seconds()/3600} for a,b in zip(times,times[1:]) if (b-a).total_seconds() != 14400]
    digits = data['offers'].get(symbol, {}).get('digits')
    summary['instruments'][symbol] = {
        'count': len(rows), 'first_berlin': times[0].astimezone(berlin).isoformat(), 'last_berlin': times[-1].astimezone(berlin).isoformat(),
        'invalid_ohlc': errors, 'unique_timestamps': len(set(times)) == len(times), 'strictly_sorted': all(a<b for a,b in zip(times,times[1:])),
        'off_hour_timestamps': sum(t.minute != 0 or t.second != 0 for t in times),
        'outside_range_or_open': sum(t < datetime.fromisoformat(data['start_utc']) or t.timestamp()+14400 > datetime.fromisoformat(data['end_exclusive_utc']).timestamp() for t in times),
        'off_precision_grid': sum(abs(v*10**digits-round(v*10**digits))>1e-6 for r in rows for v in [r[k] for k in ('open','high','low','close')]) if digits is not None else None,
        'by_berlin_day': dict(Counter(t.astimezone(berlin).date().isoformat() for t in times)), 'gaps': gaps,
        'median_range': median(r['high']-r['low'] for r in rows), 'median_true_range': median(tr.values()),
        'min_price': min(r['low'] for r in rows), 'max_price': max(r['high'] for r in rows)}
    with (root / (symbol.replace('/','')+'-H4.csv')).open('w',newline='') as f:
        writer = csv.DictWriter(f,fieldnames=list(rows[0])+['time_berlin'])
        writer.writeheader()
        writer.writerows(dict(r,time_berlin=t.astimezone(berlin).isoformat()) for r,t in zip(rows,times))
common = sorted(t for t in set(tr_by_symbol['XAU/USD']) & set(tr_by_symbol['GBP/USD']) if t >= '2026-08-31T22:00:00+00:00')
x = median(tr_by_symbol['XAU/USD'][t] for t in common)
g = median(tr_by_symbol['GBP/USD'][t] for t in common)
summary['matched_h4_scale'] = {'bars':len(common),'gold_median_tr':x,'gbp_median_tr':g,'price_distance_ratio':x/g,
    'gold_h4_fvg_candidate': math.ceil(0.0004*x/g/0.01)*0.01}
(root/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))
