"""Begrenzter History-Test ohne Datenbank, Upload oder Handelsrequests (SDK Python 3.7)."""
import json
import os
import sys
from datetime import datetime, timedelta, timezone
sys.path.insert(0, '/app')
from collector import read_config
from candles import closed_rows
from forexconnect import ForexConnect

def main():
    config = read_config('/run/secrets/fxcm.env')
    start = datetime(2026, 9, 6, 22, tzinfo=timezone.utc)
    end = datetime(2026, 9, 20, 22, tzinfo=timezone.utc)
    result = {'start_utc': start.isoformat(), 'end_exclusive_utc': end.isoformat(),
              'timeframe': 'H1', 'side': 'Bid', 'instruments': {}, 'offers': {}}
    os.chdir('/tmp')
    with ForexConnect() as fx:
        fx.login(config['FXCM_USERNAME'], config['FXCM_PASSWORD'],
                 'https://www.fxcorporate.com/Hosts.jsp', config.get('FXCM_CONNECTION', 'Demo'))
        for offer in fx.get_table(ForexConnect.OFFERS):
            if offer.instrument in ('XAU/USD', 'GBP/USD'):
                result['offers'][offer.instrument] = {key: getattr(offer, key, None)
                    for key in ('digits', 'point_size', 'subscription_status', 'instrument_type')}
        for symbol in ('XAU/USD', 'GBP/USD'):
            all_rows = []
            chunks = []
            cursor = start
            while cursor < end:
                stop = min(cursor + timedelta(days=7), end)
                history = fx.get_history(symbol, 'H1', cursor, stop)
                rows = closed_rows(symbol.replace('/', ''), '1h', history, end.timestamp())
                all_rows.extend(r for r in rows if start.isoformat() <= r['time'] < end.isoformat())
                chunks.append({'start': cursor.isoformat(), 'end': stop.isoformat(), 'raw_rows': len(history)})
                cursor = stop
            unique = {r['time']: r for r in all_rows}
            result['instruments'][symbol] = {'chunks': chunks, 'duplicate_boundary_rows': len(all_rows)-len(unique),
                'candles': [unique[t] for t in sorted(unique)]}
    print('PROBE_JSON=' + json.dumps(result, allow_nan=False))

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('Probe failed: ' + type(error).__name__)
        sys.exit(1)
