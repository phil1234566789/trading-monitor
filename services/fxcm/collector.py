"""Geschlossene Bid-Kerzen: FXCM -> lokaler Puffer -> Supabase-Ingest."""
import argparse
import json
import os
import sqlite3
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, urlopen

from candles import PERIODS, closed_rows


def read_config(path):
    result = {}
    for line in Path(path).read_text(encoding='utf-8-sig').splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key, value = line.split('=', 1)
            result[key.strip()] = value.strip().strip('"').strip("'")
    return result


def upload(db, config):
    if not config.get('FXCM_INGEST_URL'):
        return
    while True:
        pending = db.execute('select instrument, bar, time, payload from candles where uploaded=0 order by time desc limit 500').fetchall()
        if not pending:
            return
        request = Request(config['FXCM_INGEST_URL'],
                          data=json.dumps({'candles': [json.loads(r[3]) for r in pending]}).encode(),
                          headers={'Content-Type': 'application/json', 'X-FXCM-Token': config['FXCM_INGEST_TOKEN']})
        with urlopen(request, timeout=45) as response:
            if response.status != 200:
                raise RuntimeError('Ingest failed')
        with db:
            db.executemany('update candles set uploaded=1 where instrument=? and bar=? and time=?',
                           [r[:3] for r in pending])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--backfill', action='store_true')
    parser.add_argument('--once', action='store_true')
    parser.add_argument('--start', default='2026-01-01')
    parser.add_argument('--end')
    parser.add_argument('--bars', default=','.join(PERIODS))
    args = parser.parse_args()
    config = read_config(os.environ.get('FXCM_CONFIG', '/run/secrets/fxcm.env'))
    db = sqlite3.connect('/data/candles.sqlite', timeout=60)
    db.execute('pragma journal_mode=WAL')
    db.execute('create table if not exists candles (instrument text, bar text, time text, payload text, uploaded integer default 0, primary key(instrument,bar,time))')
    db.execute('create table if not exists checkpoints (instrument text, bar text, time text, primary key(instrument,bar))')
    db.execute('create index if not exists pending_upload on candles(time desc) where uploaded=0')
    from forexconnect import ForexConnect
    os.chdir('/tmp')  # Das SDK legt seine eigenen Logs/History-Dateien im Arbeitsverzeichnis ab.
    with ForexConnect() as fx:
        fx.login(config['FXCM_USERNAME'], config['FXCM_PASSWORD'],
                 'https://www.fxcorporate.com/Hosts.jsp', config.get('FXCM_CONNECTION', 'Demo'),
                 use_table_manager=False)
        while True:
            now = datetime.fromisoformat(args.end).replace(tzinfo=timezone.utc) if args.end else datetime.now(timezone.utc)
            for instrument in ('GBPUSD', 'EURUSD'):
                for bar, (period, seconds) in PERIODS.items():
                    if bar not in args.bars.split(','):
                        continue
                    checkpoint_key = '{}:{}:{}'.format(bar, args.start, args.end or 'live')
                    if args.backfill:
                        saved = db.execute('select time from checkpoints where instrument=? and bar=?', (instrument, checkpoint_key)).fetchone()
                        start = datetime.fromisoformat(saved[0]) if saved else datetime.fromisoformat(args.start).replace(tzinfo=timezone.utc)
                    else:
                        saved = db.execute('select max(time) from candles where instrument=? and bar=?', (instrument, bar)).fetchone()[0]
                        start = datetime.fromisoformat(saved) if saved else now - timedelta(days=7)
                        start -= timedelta(seconds=seconds * 2)
                    # Kleine Zeitfenster begrenzen SDK-Speicher und machen abgebrochene Backfills fortsetzbar.
                    while start < now:
                        end = min(start + timedelta(days=7), now)
                        history = fx.get_history(instrument[:3] + '/' + instrument[3:], period, start, end)
                        rows = closed_rows(instrument, bar, history, now.timestamp() - 10)
                        with db:
                            db.executemany('insert or ignore into candles(instrument,bar,time,payload) values(?,?,?,?)',
                                           [(instrument, bar, r['time'], json.dumps(r)) for r in rows])
                            if args.backfill:
                                # Das letzte Fenster wird überlappend erneut gelesen: seine letzte Kerze kann noch offen sein.
                                checkpoint = end - timedelta(seconds=seconds) if end == now else end
                                db.execute('insert or replace into checkpoints values(?,?,?)', (instrument, checkpoint_key, checkpoint.isoformat()))
                        upload(db, config)
                        print(json.dumps({'instrument': instrument, 'bar': bar, 'rows': len(rows), 'through': end.isoformat()}), flush=True)
                        start = end
            if args.once or args.backfill:
                break
            Path('/data/heartbeat').write_text(str(time.time()))
            time.sleep(max(10, 72 - time.time() % 60))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # SDK-Fehler können Zugangsdaten enthalten; nur den Fehlertyp ins Betriebslog schreiben.
        print('Collector failed: ' + type(error).__name__, flush=True)
        raise SystemExit(1)
